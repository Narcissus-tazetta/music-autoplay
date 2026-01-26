// socket runtimeは型のない外部の engine/request オブジェクトを扱うため、防御的なチェックが必要です。
import type { Music, RemoteStatus } from '@/shared/stores/musicStore';
import type { C2S, S2C } from '@/shared/types/socket';
import { withErrorHandler } from '@/shared/utils/errors';
import { isObject } from '@/shared/utils/typeGuards';
import type { Server as HttpServer } from 'node:http';
import type { Server } from 'socket.io';
import type { Server as IOServer } from 'socket.io';
import { container } from './di/container';
import logger from './logger';
import type { MusicService } from './music/musicService';
import { createMusicService } from './music/musicServiceFactory';
import type { Store } from './persistence';
import type { RateLimiter } from './services/rateLimiter';
import { RateLimiterManager } from './services/rateLimiterManager';
import type { WindowCloseManager } from './services/windowCloseManager';
import type { YouTubeService } from './services/youtubeService';
import { createSocketServerBuilder } from './socket/builder';
import type { SocketManager } from './socket/managers/manager';
import type { SocketRuntime } from './socket/managers/runtime';
import type { ReplyOptions } from './socket/types';
import type { EngineLike, RequestLike } from './socket/types';
import { createSocketEmitter } from './utils/safeEmit';
import { TimerManager } from './utils/timerManager';

export class SocketServerInstance {
    musicDB: Map<string, Music> = new Map();
    remoteStatus: RemoteStatus = {
        type: 'closed',
    };
    private adminHash: string;

    io?: Server<C2S, S2C>;
    youtubeService: YouTubeService;
    fileStore: Store;
    private remoteStatusUpdatedAt = 0;
    private remoteStatusDebounceMs: number;
    private remoteStatusGraceMs: number;
    private remoteStatusInactivityMs: number;
    private remoteStatusInactivityMsPlaying: number;
    private remoteStatusInactivityMsPaused: number;
    private timerManager = new TimerManager();
    private windowCloseManager: InstanceType<typeof WindowCloseManager>;
    private manager?: SocketManager;
    private musicService?: MusicService;
    private runtime?: SocketRuntime;
    private rateLimiter: RateLimiter;
    private httpRateLimiter: RateLimiter;
    static isEngineLike(v: unknown): v is EngineLike {
        if (!isObject(v)) return false;
        const maybe = v as { on?: unknown; httpServer?: unknown };
        return (
            typeof maybe.on === 'function' || typeof maybe.httpServer !== 'undefined'
        );
    }
    static getEngineFromIo(io: unknown): unknown {
        if (!isObject(io)) return undefined;
        const rec = io as { engine?: unknown };
        return rec.engine;
    }
    static isObject: (v: unknown) => v is Record<string, unknown> = isObject;
    private getOriginFromReq(req: unknown): string | undefined {
        try {
            if (!isObject(req)) return undefined;
            const headers = (req as RequestLike).headers;
            if (isObject(headers) && typeof headers.origin === 'string') return headers.origin;
            if (isObject(req) && typeof (req as RequestLike).url === 'string') return undefined;
            return undefined;
        } catch (error) {
            logger.debug('getOriginFromReq failed', { error: error });
            return undefined;
        }
    }

    constructor(
        youtubeService?: YouTubeService,
        fileStore?: Store,
    ) {
        const components = createSocketServerBuilder()
            .withYouTubeService(youtubeService)
            .withFileStore(fileStore)
            .withMusicDB(this.musicDB)
            .withRemoteStatus(this.remoteStatus)
            .build();

        this.youtubeService = components.youtubeService;
        this.fileStore = components.fileStore;
        this.musicDB = components.musicDB;
        this.remoteStatus = components.remoteStatus;
        this.adminHash = components.adminHash;
        this.windowCloseManager = components.windowCloseManager;
        this.rateLimiter = components.rateLimiter;
        this.httpRateLimiter = components.httpRateLimiter;
        this.remoteStatusDebounceMs = components.socketConfig.remoteStatusDebounceMs;
        this.remoteStatusGraceMs = components.socketConfig.remoteStatusGraceMs;
        this.remoteStatusInactivityMs = components.socketConfig.remoteStatusInactivityMs;
        this.remoteStatusInactivityMsPlaying = components.socketConfig.remoteStatusInactivityMsPlaying;
        this.remoteStatusInactivityMsPaused = components.socketConfig.remoteStatusInactivityMsPaused;
        try {
            container.register('socketServer', () => this);
        } catch (error) {
            void error;
        }
    }
    async init(server: HttpServer): Promise<void> {
        if (this.io) return;
        logger.info('SocketServerInstance.init starting');
        await this.initializeSocket(server);
        logger.info('SocketServerInstance.init completed');
    }

    getIoForBroker(): IOServer | null {
        return this.io ?? null;
    }

    getRuntimeForBroker(): SocketRuntime | undefined {
        return this.runtime;
    }

    getOrCreateManagerForBroker(): SocketManager | undefined {
        if (!this.runtime) return undefined;
        return this.runtime.getManager() ?? this.runtime.createManager();
    }

    getMusicServiceForBroker(): MusicService {
        return this.getMusicService();
    }

    private async initializeSocket(server: HttpServer): Promise<void> {
        logger.info('initializeSocket starting');
        const { initSocketServer } = await import('./socket/core/factory');
        logger.info('initSocketServer imported');
        const res = await initSocketServer(server, {
            adminHash: this.adminHash,
            fileStore: this.fileStore,
            musicDB: this.musicDB,
            opts: {
                debounceMs: this.remoteStatusDebounceMs,
                graceMs: this.remoteStatusGraceMs,
                inactivityMs: this.remoteStatusInactivityMs,
                inactivityMsPlaying: this.remoteStatusInactivityMsPlaying,
                inactivityMsPaused: this.remoteStatusInactivityMsPaused,
            },
            youtubeService: this.youtubeService,
        });
        logger.info('initSocketServer completed');
        this.io = res.io as Server<C2S, S2C>;
        this.runtime = res.runtime;
        return Promise.resolve();
    }

    getHttpRateLimiter(): RateLimiter {
        return this.httpRateLimiter;
    }

    async close(): Promise<void> {
        if (!this.io) return;

        RateLimiterManager.getInstance().stopCleanup();

        await new Promise<void>(resolve => {
            const io = this.getIo();
            const closeResult = io.close(() => {
                logger.info('socket.io closed');
                resolve();
            });
            if (typeof (closeResult as { then?: unknown }).then === 'function') {
                void (closeResult as Promise<unknown>).catch(error => {
                    logger.warn('socket.io close error', { error: error });
                    resolve();
                });
            }
        });
    }
    public emit(...args: unknown[]): void;
    public emit(
        ...args: Parameters<IOServer['emit']>
    ): ReturnType<IOServer['emit']> | undefined {
        const result = withErrorHandler(() => {
            const ioServer = this.getIo();
            return ioServer.emit(...args);
        }, 'SocketServerInstance.emit')();
        return result;
    }

    private getIo(): IOServer {
        if (!this.io) throw new Error('SocketServerInstance not initialized (call init first)');
        return this.io;
    }

    private getMusicService(): MusicService {
        if (!this.musicService) {
            const emitter = createSocketEmitter(() => this.getIo());
            this.musicService = createMusicService({
                emitFn: (ev, payload, opts?) => emitter.emit(ev, payload, opts),
                fileStore: this.fileStore,
                musicDB: this.musicDB,
                youtubeService: this.youtubeService,
            });
        }
        return this.musicService;
    }
    async addMusic(
        url: string,
        requesterHash?: string,
        requesterName?: string,
    ): Promise<ReplyOptions> {
        const result = await this.getMusicService().addMusic({
            requesterHash,
            requesterName,
            url,
        });
        if (result.ok) return {};
        return { formErrors: [result.error.message] };
    }

    async removeMusic(url: string, requesterHash: string): Promise<ReplyOptions> {
        const result = await this.getMusicService().removeMusic({
            requesterHash,
            url,
        });
        if (result.ok) return {};
        return { formErrors: [result.error.message] };
    }
}
