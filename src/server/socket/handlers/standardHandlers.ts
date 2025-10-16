import type { Music, RemoteStatus } from "~/stores/musicStore";
import logger from "../../logger";
import type MetricsManager from "../../services/metricsManager";
import ServiceResolver from "../../utils/serviceResolver";
import { createSocketEventHandler } from "./eventHandler";

export function createGetAllMusicsHandler(musicDB: Map<string, Music>) {
  const metricsManager =
    ServiceResolver.getInstance().resolve<MetricsManager>("metricsManager");

  return createSocketEventHandler({
    event: "getAllMusics",
    handler: async (
      _payload: unknown,
      context: { socketId: string },
    ): Promise<Music[]> => {
      const start = Date.now();
      let hasError = false;

      try {
        const list = Array.from(musicDB.values());

        logger.info("getAllMusics handler invoked", {
          socketId: context.socketId,
          count: list.length,
        });

        if (metricsManager)
          metricsManager.updateRpcGetAllMusics(Date.now() - start, hasError);

        return list;
      } catch (error: unknown) {
        hasError = true;

        if (metricsManager)
          metricsManager.updateRpcGetAllMusics(Date.now() - start, hasError);

        logger.error("getAllMusics handler error", {
          socketId: context.socketId,
          error,
        });

        return [];
      }
    },
    logPayload: false,
    logResponse: false,
  });
}

type RemoteStatusSupplier = RemoteStatus | (() => RemoteStatus);

export function createGetRemoteStatusHandler(
  remoteStatusOrSupplier: RemoteStatusSupplier,
) {
  return createSocketEventHandler({
    event: "getRemoteStatus",
    handler: async (): Promise<RemoteStatus> => {
      try {
        if (typeof remoteStatusOrSupplier === "function") {
          const fn = remoteStatusOrSupplier as () => RemoteStatus;
          return fn();
        } else {
          return remoteStatusOrSupplier;
        }
      } catch (error: unknown) {
        logger.warn("getRemoteStatus handler failed", { error });
        return { type: "closed" };
      }
    },
    logPayload: false,
    logResponse: false,
  });
}
