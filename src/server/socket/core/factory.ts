import { SERVER_ENV } from '@/app/env.server';
import type { Music } from '@/shared/stores/musicStore';
import type { Server as HttpServer } from 'node:http';
import type { Server as IOServer } from 'socket.io';
import type ConfigService from '../../config/configService';
import logger from '../../logger';
import type { Store } from '../../persistence';
import { WindowCloseManager } from '../../services/windowCloseManager';
import { YouTubeService } from '../../services/youtubeService';
import { safeNumber } from '../../utils/configUtils';
import ServiceResolver from '../../utils/serviceResolver';
import { TimerManager } from '../../utils/timerManager';
import type { ConnectionHandlerFactory } from '../handlers/connectionHandler';
import { SocketRuntime } from '../managers/runtime';
import { registerSocketIdentityMiddleware } from '../middleware/socketIdentityMiddleware';
import { createSocketIo } from './socketIo';

export interface RuntimeOptions {
    debounceMs: number;
    graceMs: number;
    inactivityMs: number;
    inactivityMsPlaying?: number;
    inactivityMsPaused?: number;
}

export interface InitSocketServerResult {
    io: IOServer;
    runtime: SocketRuntime;
    socketPath: string;
}
export async function initSocketServer(
    server: HttpServer,
    deps: {
        musicDB: Map<string, Music>;
        fileStore?: Store;
        youtubeService?: YouTubeService;
        adminHash?: string;
        opts: RuntimeOptions;
        // SocketServerInstance owns these: it reports their stats via getDiagnostics() and
        // tears them down in close(). Creating separate ones here left those calls pointing
        // at idle objects while the real timers kept running.
        timerManager?: TimerManager;
        windowCloseManager?: WindowCloseManager;
    },
): Promise<InitSocketServerResult> {
    const { musicDB, fileStore, youtubeService, adminHash, opts } = deps;

    const serviceResolver = ServiceResolver.getInstance();
    const effectiveFileStore = fileStore ?? serviceResolver.resolve<Store>('fileStore');
    const effectiveYoutube = youtubeService ?? serviceResolver.resolve<YouTubeService>('youtubeService');
    // No 'adminHash' token is ever registered, so the old container fallback here always
    // resolved to undefined. The caller is the only real source.
    const effectiveAdminHash = adminHash;

    const created = createSocketIo(server);
    if (!created.io) throw new Error('failed to initialize socket.io');
    const io = created.io;
    registerSocketIdentityMiddleware(io);

    const persistedData = (() => {
        try {
            return effectiveFileStore ? effectiveFileStore.load() : [];
        } catch (error) {
            logger.warn('failed to restore persisted musics', { error: error });
            return [];
        }
    })();
    const configService = serviceResolver.resolve<ConfigService>('configService');
    const timerManager = deps.timerManager ?? new TimerManager();

    for (const m of persistedData) musicDB.set(m.id, m);
    logger.info('restored persisted musics', { count: persistedData.length });

    const windowCloseManager = deps.windowCloseManager
        ?? new WindowCloseManager(
            safeNumber(
                configService?.getNumber('WINDOW_CLOSE_DEBOUNCE_MS'),
                safeNumber(SERVER_ENV.WINDOW_CLOSE_DEBOUNCE_MS, 500),
            ),
        );

    const yt = effectiveYoutube ?? new YouTubeService();
    if (!effectiveFileStore) throw new Error('fileStore is required (register it in DI or pass it via deps)');
    const fsToUse = effectiveFileStore;

    const runtime = new SocketRuntime(
        () => io,
        musicDB,
        yt,
        fsToUse,
        timerManager,
        windowCloseManager,
        opts,
    );

    const mod = (await import('../handlers/connectionHandler')) as Partial<{
        default: ConnectionHandlerFactory;
        makeConnectionHandler: ConnectionHandlerFactory;
    }>;
    const makeConnectionHandler: ConnectionHandlerFactory = mod.default
        ?? (mod.makeConnectionHandler as ConnectionHandlerFactory);

    const socketConfig = configService?.getSocketConfig() ?? {
        rateLimitMaxAttempts: 10,
        rateLimitWindowMs: 60_000,
    };

    const handler = makeConnectionHandler({
        adminHash: effectiveAdminHash ?? '',
        createManager: () => runtime.createManager(),
        fileStore: fsToUse,
        getIo: () => io,
        getManager: () => runtime.getManager(),
        getMusicService: () => runtime.getMusicService(),
        musicDB,
        rateLimitConfig: {
            maxAttempts: socketConfig.rateLimitMaxAttempts,
            windowMs: socketConfig.rateLimitWindowMs,
        },
        rateLimiter: serviceResolver.resolve('rateLimiter'),
        timerManager,
        windowCloseManager,
        youtubeService: yt,
    });

    io.on('connection', handler);

    return { io, runtime, socketPath: created.socketPath };
}

export default initSocketServer;
