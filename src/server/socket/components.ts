import type { Music, RemoteStatus } from '@/shared/types/music';
import { createAdminHash } from '@/shared/utils/errors';
import { SERVER_ENV } from '~/env.server';
import { socketConfig } from '../config';
import type { Store } from '../persistence';
import { RateLimiter } from '../services/rateLimiter';
import { RateLimiterManager } from '../services/rateLimiterManager';
import { WindowCloseManager } from '../services/windowCloseManager';
import type { YouTubeService } from '../services/youtubeService';

export interface SocketServerComponents {
    youtubeService: YouTubeService;
    fileStore: Store;
    musicDB: Map<string, Music>;
    remoteStatus: RemoteStatus;
    adminHash: string;
    windowCloseManager: WindowCloseManager;
    rateLimiter: RateLimiter;
    httpRateLimiter: RateLimiter;
    socketConfig: typeof socketConfig;
}

/**
 * Builds the collaborators SocketServerInstance owns.
 *
 * This replaces SocketServerBuilder, whose four `withX()` setters were only ever called
 * once each, back to back, from the single call site. The builder also wrapped its body in
 * withErrorHandler(), which swallowed the original exception and rethrew a generic
 * "build failed", and reached for the DI container through createRequire() to dodge a
 * circular import that only existed because of the container.
 */
export function createSocketServerComponents(deps: {
    youtubeService: YouTubeService;
    fileStore: Store;
    musicDB: Map<string, Music>;
    remoteStatus: RemoteStatus;
}): SocketServerComponents {
    const rateLimiter = new RateLimiter(socketConfig.rateLimitMaxAttempts, socketConfig.rateLimitWindowMs);
    const httpRateLimiter = new RateLimiter(socketConfig.rateLimitMaxAttempts, socketConfig.rateLimitWindowMs);

    const rateLimiterManager = RateLimiterManager.getInstance();
    rateLimiterManager.register('socket', rateLimiter);
    rateLimiterManager.register('http', httpRateLimiter);
    rateLimiterManager.scheduleCleanup();

    return {
        adminHash: createAdminHash(SERVER_ENV.ADMIN_SECRET),
        fileStore: deps.fileStore,
        httpRateLimiter,
        musicDB: deps.musicDB,
        rateLimiter,
        remoteStatus: deps.remoteStatus,
        socketConfig,
        windowCloseManager: new WindowCloseManager(socketConfig.windowCloseDebounce),
        youtubeService: deps.youtubeService,
    };
}
