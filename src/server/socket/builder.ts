import { createAdminHash, withErrorHandler } from "@/shared/utils/errorUtils";
import type { Music, RemoteStatus } from "~/stores/musicStore";
import { getConfigService } from "../config/configService";
import type ConfigService from "../config/configService";
import type { Store } from "../persistence";
import { RateLimiter } from "../services/rateLimiter";
import { WindowCloseManager } from "../services/windowCloseManager";
import type { YouTubeService } from "../services/youtubeService";
import ServiceResolver from "../utils/serviceResolver";

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
      const youtubeService =
        this.config.youtubeService ??
        resolver.resolveRequired<YouTubeService>("youtubeService");
      const fileStore =
        this.config.fileStore ?? resolver.resolveRequired<Store>("fileStore");

      const socketConfig = this.configService.getSocketConfig();
      const adminConfig = this.configService.getAdminConfig();

      const adminHash = createAdminHash(adminConfig.secret);
      const windowCloseManager = new WindowCloseManager(
        socketConfig.windowCloseDebounce,
      );
      const adminRateLimiter = new RateLimiter(
        socketConfig.adminMaxAttempts,
        socketConfig.adminWindowMs,
      );

      return {
        youtubeService,
        fileStore,
        musicDB: this.config.musicDB ?? new Map(),
        remoteStatus: this.config.remoteStatus ?? { type: "closed" },
        adminHash,
        windowCloseManager,
        adminRateLimiter,
        socketConfig,
      };
    }, "SocketServerBuilder.build")();

    if (!result) throw new Error("SocketServerBuilder.build failed");

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
  adminRateLimiter: RateLimiter;
  socketConfig: ReturnType<ConfigService["getSocketConfig"]>;
}

export function createSocketServerBuilder(): SocketServerBuilder {
  return new SocketServerBuilder();
}
