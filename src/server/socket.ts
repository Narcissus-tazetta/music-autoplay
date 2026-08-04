import type { Music, RemoteStatus } from '@/shared/types/music';
import type { C2S, S2C } from '@/shared/types/socket';
import type { Server as HttpServer } from 'node:http';
import type { Server } from 'socket.io';
import type { Server as IOServer } from 'socket.io';
import logger from './logger';
import type { MusicService } from './music/musicService';
import { createMusicService } from './music/musicServiceFactory';
import type { Store } from './persistence';
import type { RateLimiter } from './services/rateLimiter';
import { RateLimiterManager } from './services/rateLimiterManager';
import type { WindowCloseManager } from './services/windowCloseManager';
import type { YouTubeService } from './services/youtubeService';
import { createSocketServerComponents } from './socket/components';
import type { SocketManager } from './socket/managers/manager';
import type { ReplyOptions } from './socket/types';
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
    private rateLimiter: RateLimiter;
    private httpRateLimiter: RateLimiter;

    constructor(youtubeService: YouTubeService, fileStore: Store) {
        const components = createSocketServerComponents({
            fileStore,
            musicDB: this.musicDB,
            remoteStatus: this.remoteStatus,
            youtubeService,
        });

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
    }
    async init(server: HttpServer): Promise<void> {
        if (this.io) return;
        logger.info('SocketServerInstance.init starting');
        await this.initializeSocket(server);
        logger.info('SocketServerInstance.init completed');
    }

    private async initializeSocket(server: HttpServer): Promise<void> {
        logger.info('initializeSocket starting');
        const { initSocketServer } = await import('./socket/core/factory');
        logger.info('initSocketServer imported');
        const res = await initSocketServer(server, {
            adminHash: this.adminHash,
            fileStore: this.fileStore,
            musicDB: this.musicDB,
            rateLimiter: this.rateLimiter,
            opts: {
                debounceMs: this.remoteStatusDebounceMs,
                graceMs: this.remoteStatusGraceMs,
                inactivityMs: this.remoteStatusInactivityMs,
                inactivityMsPlaying: this.remoteStatusInactivityMsPlaying,
                inactivityMsPaused: this.remoteStatusInactivityMsPaused,
            },
            timerManager: this.timerManager,
            windowCloseManager: this.windowCloseManager,
            youtubeService: this.youtubeService,
        });
        logger.info('initSocketServer completed');
        this.io = res.io as Server<C2S, S2C>;
        return Promise.resolve();
    }

    getHttpRateLimiter(): RateLimiter {
        return this.httpRateLimiter;
    }

    getDiagnostics(): {
        musicDBSize: number;
        remoteStatusType: RemoteStatus['type'];
        connectedSockets: number;
        roomCount: number;
        timerCount: number;
        windowClose: { lastEventCount: number; timerCount: number };
        rateLimiter: {
            socket: { totalKeys: number; totalAttempts: number };
            http: { totalKeys: number; totalAttempts: number };
        };
    } {
        const io = this.io;
        const socketMap = io?.sockets?.sockets;
        const roomMap = io?.sockets?.adapter?.rooms;
        return {
            musicDBSize: this.musicDB.size,
            remoteStatusType: this.remoteStatus.type,
            connectedSockets: socketMap ? socketMap.size : 0,
            roomCount: roomMap ? roomMap.size : 0,
            timerCount: this.timerManager.getSize(),
            windowClose: this.windowCloseManager.getStats(),
            rateLimiter: {
                socket: this.rateLimiter.getStats(),
                http: this.httpRateLimiter.getStats(),
            },
        };
    }

    async close(): Promise<void> {
        if (!this.io) return;

        RateLimiterManager.getInstance().stopCleanup();
        this.windowCloseManager.destroy();
        this.timerManager.clearAll();

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
        insertAfterId?: string,
    ): Promise<ReplyOptions> {
        const result = await this.getMusicService().addMusic({
            insertAfterId,
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

    async reorderMusic(
        id: string,
        afterId: string,
        requesterHash: string,
    ): Promise<ReplyOptions> {
        const result = await this.getMusicService().reorderMusic({
            afterId,
            id,
            requesterHash,
        });
        if (result.ok) return {};
        return { formErrors: [result.error.message] };
    }
}
