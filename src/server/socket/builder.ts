import type { Music, RemoteStatus } from '@/shared/stores/musicStore';
import { createAdminHash, withErrorHandler } from '@/shared/utils/errors';
import { getConfigService } from '../config/configService';
import type ConfigService from '../config/configService';
import type { Store } from '../persistence';
import { RateLimiter } from '../services/rateLimiter';
import { RateLimiterManager } from '../services/rateLimiterManager';
import { WindowCloseManager } from '../services/windowCloseManager';
import type { YouTubeService } from '../services/youtubeService';
import ServiceResolver from '../utils/serviceResolver';

export interface SocketServerConfig {
    youtubeService?: YouTubeService;
    fileStore?: Store;
    musicDB?: Map<string, Music>;
    remoteStatus?: RemoteStatus;
}

export class SocketServerBuilder {
    private config: SocketServerConfig = {};
    private configService = getConfigService();
    private serviceResolver = ServiceResolver.getInstance();

    withYouTubeService(service?: YouTubeService): this {
        if (service) this.config.youtubeService = service;
        return this;
    }

    withFileStore(store?: Store): this {
        if (store) this.config.fileStore = store;
        return this;
    }

    withMusicDB(musicDB: Map<string, Music>): this {
        this.config.musicDB = musicDB;
        return this;
    }

    withRemoteStatus(status: RemoteStatus): this {
        this.config.remoteStatus = status;
        return this;
    }

    build(): SocketServerComponents {
        const result = withErrorHandler(() => {
            const resolver = this.serviceResolver;
            const youtubeService = this.config.youtubeService
                ?? resolver.resolveRequired<YouTubeService>('youtubeService');
            const fileStore = this.config.fileStore ?? resolver.resolveRequired<Store>('fileStore');

            const socketConfig = this.configService.getSocketConfig();
            const adminConfig = this.configService.getAdminConfig();

            const adminHash = createAdminHash(adminConfig.secret);
            const windowCloseManager = new WindowCloseManager(
                socketConfig.windowCloseDebounce,
            );
            const rateLimiter = new RateLimiter(
                socketConfig.rateLimitMaxAttempts,
                socketConfig.rateLimitWindowMs,
            );
            const httpRateLimiter = new RateLimiter(
                socketConfig.rateLimitMaxAttempts,
                socketConfig.rateLimitWindowMs,
            );

            const rateLimiterManager = RateLimiterManager.getInstance();
            rateLimiterManager.register('socket', rateLimiter);
            rateLimiterManager.register('http', httpRateLimiter);
            rateLimiterManager.scheduleCleanup();

            // Register rateLimiter in DI container for factory access
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { container } = require('../di/container') as {
                container: {
                    register: (token: string, factory: () => unknown) => void;
                };
            };
            container.register('rateLimiter', () => rateLimiter);
            container.register('httpRateLimiter', () => httpRateLimiter);

            return {
                youtubeService,
                fileStore,
                musicDB: this.config.musicDB ?? new Map(),
                remoteStatus: this.config.remoteStatus ?? { type: 'closed' },
                adminHash,
                windowCloseManager,
                rateLimiter,
                httpRateLimiter,
                rateLimiterManager,
                socketConfig,
            };
        }, 'SocketServerBuilder.build')();

        if (!result) throw new Error('SocketServerBuilder.build failed');

        return result;
    }
}

export interface SocketServerComponents {
    youtubeService: YouTubeService;
    fileStore: Store;
    musicDB: Map<string, Music>;
    remoteStatus: RemoteStatus;
    adminHash: string;
    windowCloseManager: WindowCloseManager;
    rateLimiter: RateLimiter;
    httpRateLimiter: RateLimiter;
    rateLimiterManager: RateLimiterManager;
    socketConfig: ReturnType<ConfigService['getSocketConfig']>;
}

export function createSocketServerBuilder(): SocketServerBuilder {
    return new SocketServerBuilder();
}
