declare global {
  var __simpleMetrics:
    | {
        apiMusics: { calls: number; errors: number; totalMs: number };
        rpcGetAllMusics: { calls: number; errors: number; totalMs: number };
      }
    | undefined;
}
import { container } from "./di/container";
import logger from "./logger";
import FileStore from "./persistence";
import CacheService from "./services/cacheService";
import ConfigService from "./services/configService";
import ErrorService from "./services/errorService";
import retry from "./services/retryService";
import { SocketServerInstance } from "./socket";
import MetricsManager from "./utils/metricsManager";
import { YouTubeService } from "./youtubeService";
export type Metrics = {
  apiMusics: { calls: number; errors: number; totalMs: number };
  rpcGetAllMusics: { calls: number; errors: number; totalMs: number };
};

export type BootstrapResult = {
  appShutdownHandlers: Array<() => Promise<void> | void>;
  fileStore: InstanceType<typeof FileStore>;
  socketServer: InstanceType<typeof SocketServerInstance>;
  metricsManager: MetricsManager;
};

export async function bootstrap(): Promise<BootstrapResult> {
  const configService = new ConfigService();
  const errorService = new ErrorService();
  const cacheService = new CacheService();

  const [youtubeService, fileStore, metricsManager] = await Promise.all([
    Promise.resolve(new YouTubeService(undefined, configService, cacheService)),
    Promise.resolve(new FileStore()),
    Promise.resolve(new MetricsManager()),
  ]);

  const socketServer = new SocketServerInstance(youtubeService, fileStore);

  container.register("fileStore", () => fileStore);
  container.register("socketServer", () => socketServer);
  container.register("youtubeService", () => youtubeService);
  container.register("configService", () => configService);
  container.register("errorService", () => errorService);
  container.register("cacheService", () => cacheService);
  container.register("retryService", () => retry);
  container.register("metricsManager", () => metricsManager);

  const appShutdownHandlers: Array<() => Promise<void> | void> = [];
  appShutdownHandlers.push(async () => {
    try {
      await fileStore.flush();
      logger.info("filestore flushed");
    } catch (e: unknown) {
      logger.warn("fileStore.flush failed, attempting sync close", {
        error: e,
      });
      try {
        fileStore.closeSync();
      } catch (err: unknown) {
        logger.warn("fileStore.closeSync failed", { error: err });
      }
    }
  });

  return { appShutdownHandlers, fileStore, socketServer, metricsManager };
}
