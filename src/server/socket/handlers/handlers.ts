import type { Music } from '@/shared/types/music';
import type { Socket } from 'socket.io';
import type { Server as IOServer } from 'socket.io';
import { getHistoryService } from '../../history/historyService';
import type { MusicService } from '../../music/musicService';
import type { Store } from '../../persistence';
import type { RateLimiter } from '../../services/rateLimiter';
import type { YouTubeService } from '../../services/youtubeService';
import type { EmitOptions } from '../../utils/safeEmit';
import type { SocketManager } from '../managers/manager';
import { registerBatchHandlers } from './eventHandler';
import { createMusicHandlers } from './musicHandlers';
import { createGetAllMusicsHandler, createGetHistoryHandler, createGetRemoteStatusHandler } from './standardHandlers';

export interface HandlerDeps {
    musicDB: Map<string, Music>;
    io: IOServer;
    emit?: (ev: string, payload: unknown, opts?: EmitOptions) => boolean;
    youtubeService?: YouTubeService;
    manager: SocketManager;
    fileStore?: Store;
    isAdmin: (h?: string) => boolean;
    adminHash?: string;
    /** Shared instance owned by SocketRuntime; see musicHandlers' Deps.musicService. */
    musicService?: MusicService;
    rateLimiter?: RateLimiter;
    rateLimitConfig?: {
        maxAttempts: number;
        windowMs: number;
    };
}

export function registerSocketHandlers(
    socket: Socket,
    ctx: { socketId: string; connectionId: string; requestId?: string },
    deps: HandlerDeps,
) {
    const getAllMusicsHandler = createGetAllMusicsHandler(deps.musicDB);
    const getHistoryHandler = createGetHistoryHandler(getHistoryService());

    const getRemoteStatusHandler = createGetRemoteStatusHandler(() => deps.manager.getSnapshot());

    const { fileStore, youtubeService } = deps;

    if (!youtubeService || !fileStore) throw new Error('youtubeService and fileStore are required');

    const musicHandlers = createMusicHandlers({
        fileStore,
        io: deps.io,
        isAdmin: deps.isAdmin,
        musicDB: deps.musicDB,
        musicService: deps.musicService,
        rateLimiter: deps.rateLimiter,
        youtubeService,
    });

    const handlers = [
        { event: 'getAllMusics', handler: getAllMusicsHandler },
        { event: 'getHistory', handler: getHistoryHandler },
        { event: 'getRemoteStatus', handler: getRemoteStatusHandler },
    ];

    registerBatchHandlers(socket, { handlers }, ctx);

    musicHandlers.register(socket, ctx);

    socket.on(
        'admin_youtube_control',
        (_payload: unknown, callback?: (result: { success: boolean; error: string }) => void) => {
            callback?.({ success: false, error: '再生操作は管理者APIから実行してください' });
        },
    );
}
