import type { Music, RemoteStatus } from "~/stores/musicStore";
import type { Store } from "../persistence";
import ConfigManager from "../utils/configManager";
import { createAdminHash, withErrorHandler } from "../utils/errorHandler";
import ServiceResolver from "../utils/serviceResolver";
import { WindowCloseManager } from "../utils/windowCloseManager";
import type { YouTubeService } from "../youtubeService";
import { RateLimiter } from "./utils";

export interface SocketServerConfig {
  youtubeService?: YouTubeService;
  fileStore?: Store;
  musicDB?: Map<string, Music>;
  remoteStatus?: RemoteStatus;
}

export class SocketServerBuilder {
  private config: SocketServerConfig = {};
  private configManager = ConfigManager.getInstance();
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
      const dependencies =
        this.config.youtubeService && this.config.fileStore
          ? {
              youtubeService: this.config.youtubeService,
              fileStore: this.config.fileStore,
            }
          : ServiceResolver.getInstance().resolveDependencies({});

      const socketConfig = this.configManager.getSocketConfig();

      const adminConfig = this.configManager.getAdminConfig();

      const adminHash = createAdminHash(adminConfig.secret);
      const windowCloseManager = new WindowCloseManager(
        socketConfig.windowCloseDebounce,
      );
      const adminRateLimiter = new RateLimiter(
        socketConfig.adminMaxAttempts,
        socketConfig.adminWindowMs,
      );

      return {
        youtubeService: dependencies.youtubeService,
        fileStore: dependencies.fileStore,
        musicDB: this.config.musicDB ?? new Map(),
        remoteStatus: this.config.remoteStatus ?? { type: "closed" },
        adminHash,
        windowCloseManager,
        adminRateLimiter,
        socketConfig,
      };
    }, "SocketServerBuilder.build")();

    if (!result) throw new Error("SocketServerBuilder.build failed");

    return result as SocketServerComponents;
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
  socketConfig: ReturnType<ConfigManager["getSocketConfig"]>;
}

export function createSocketServerBuilder(): SocketServerBuilder {
  return new SocketServerBuilder();
}
