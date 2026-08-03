import type { Music } from '@/shared/stores/musicStore';
import type { Server as HttpServer } from 'node:http';
import type { Server as IOServer } from 'socket.io';
import { socketConfig } from '../../config';
import logger from '../../logger';
import type { Store } from '../../persistence';
import type { RateLimiter } from '../../services/rateLimiter';
import { WindowCloseManager } from '../../services/windowCloseManager';
import { YouTubeService } from '../../services/youtubeService';
import { TimerManager } from '../../utils/timerManager';
import { makeConnectionHandler } from '../handlers/connectionHandler';
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
        fileStore: Store;
        opts: RuntimeOptions;
        youtubeService?: YouTubeService;
        adminHash?: string;
        rateLimiter?: RateLimiter;
        // SocketServerInstance owns these: it reports their stats via getDiagnostics() and
        // tears them down in close(). Creating separate ones here left those calls pointing
        // at idle objects while the real timers kept running.
        timerManager?: TimerManager;
        windowCloseManager?: WindowCloseManager;
    },
): Promise<InitSocketServerResult> {
    const { adminHash, fileStore, musicDB, opts, rateLimiter } = deps;

    const created = createSocketIo(server);
    if (!created.io) throw new Error('failed to initialize socket.io');
    const io = created.io;
    registerSocketIdentityMiddleware(io);

    const persistedData = (() => {
        try {
            return fileStore.load();
        } catch (error) {
            logger.warn('failed to restore persisted musics', { error: error });
            return [];
        }
    })();
    for (const m of persistedData) musicDB.set(m.id, m);
    logger.info('restored persisted musics', { count: persistedData.length });

    const timerManager = deps.timerManager ?? new TimerManager();
    const windowCloseManager = deps.windowCloseManager ?? new WindowCloseManager(socketConfig.windowCloseDebounce);
    const youtubeService = deps.youtubeService ?? new YouTubeService();

    const runtime = new SocketRuntime(
        () => io,
        musicDB,
        youtubeService,
        fileStore,
        timerManager,
        windowCloseManager,
        opts,
    );

    io.on(
        'connection',
        makeConnectionHandler({
            adminHash: adminHash ?? '',
            createManager: () => runtime.createManager(),
            fileStore,
            getIo: () => io,
            getManager: () => runtime.getManager(),
            getMusicService: () => runtime.getMusicService(),
            musicDB,
            rateLimitConfig: {
                maxAttempts: socketConfig.rateLimitMaxAttempts,
                windowMs: socketConfig.rateLimitWindowMs,
            },
            rateLimiter,
            timerManager,
            windowCloseManager,
            youtubeService,
        }),
    );

    return { io, runtime, socketPath: created.socketPath };
}

export default initSocketServer;
