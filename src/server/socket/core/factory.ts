import { SERVER_ENV } from '@/app/env.server';
import type { Music } from '@/shared/stores/musicStore';
import type { Server as HttpServer } from 'http';
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
import { createSocketIo } from './socketIo';

export type RuntimeOptions = {
    debounceMs: number;
    graceMs: number;
    inactivityMs: number;
};

export type InitSocketServerResult = {
    io: IOServer;
    runtime: SocketRuntime;
    socketPath: string;
};
/**
 * socket.io を初期化し、永続化されたデータを復元し、ランタイムを設定して接続ハンドラを登録しています。
 */
export async function initSocketServer(
    server: HttpServer,
    deps: {
        musicDB: Map<string, Music>;
        fileStore?: Store;
        youtubeService?: YouTubeService;
        adminHash?: string;
        opts: RuntimeOptions;
    },
): Promise<InitSocketServerResult> {
    const { musicDB, fileStore, youtubeService, adminHash, opts } = deps;

    const serviceResolver = ServiceResolver.getInstance();
    const effectiveFileStore = fileStore ?? serviceResolver.resolve<Store>('fileStore');
    const effectiveYoutube = youtubeService ?? serviceResolver.resolve<YouTubeService>('youtubeService');
    const effectiveAdminHash = adminHash ?? serviceResolver.resolve<string>('adminHash');

    const created = createSocketIo(server);
    if (!created.io) throw new Error('failed to initialize socket.io');
    const io = created.io;

    const [persistedData, timerManager, configService] = await Promise.all([
        Promise.resolve(
            (() => {
                try {
                    const persisted = effectiveFileStore ? effectiveFileStore.load() : [];
                    return persisted;
                } catch (err: unknown) {
                    logger.warn('failed to restore persisted musics', { error: err });
                    return [];
                }
            })(),
        ),
        Promise.resolve(new TimerManager()),
        Promise.resolve(serviceResolver.resolve<ConfigService>('configService')),
    ]);

    for (const m of persistedData) musicDB.set(m.id, m);
    logger.info('restored persisted musics', { count: persistedData.length });

    const windowCloseDebounce = safeNumber(
        configService?.getNumber('WINDOW_CLOSE_DEBOUNCE_MS'),
        safeNumber(SERVER_ENV.WINDOW_CLOSE_DEBOUNCE_MS, 500),
    );
    const windowCloseManager = new WindowCloseManager(windowCloseDebounce);

    const { defaultFileStore } = await import('../../persistence');
    const yt = effectiveYoutube ?? new YouTubeService();
    const fsToUse = effectiveFileStore ?? defaultFileStore;

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
        rateLimitWindowMs: 60000,
    };

    const handler = makeConnectionHandler({
        getIo: () => io,
        getMusicService: () => runtime.getMusicService(),
        getManager: () => runtime.getManager(),
        createManager: () => runtime.createManager(),
        musicDB,
        youtubeService: yt,
        fileStore: effectiveFileStore ?? fsToUse,
        adminHash: effectiveAdminHash ?? '',
        rateLimiter: serviceResolver.resolve('rateLimiter'),
        rateLimitConfig: {
            maxAttempts: socketConfig.rateLimitMaxAttempts,
            windowMs: socketConfig.rateLimitWindowMs,
        },
        timerManager,
        windowCloseManager,
    });

    io.on('connection', handler);

    return { io, runtime, socketPath: created.socketPath };
}

export default initSocketServer;
