import logger from "@/server/logger";
import type { Socket } from "socket.io";
import type { Music } from "~/stores/musicStore";
import { withErrorHandler } from "../utils/errorHandler";
import { wrapAsync } from "../utils/errorHandlers";
import type MetricsManager from "../utils/metricsManager";
import ServiceResolver from "../utils/serviceResolver";
import { registerTypedHandler } from "../utils/socketHelpers";

export default function registerGetAllMusics(
  socket: Socket,
  musicDB: Map<string, Music>,
) {
  const serviceResolver = ServiceResolver.getInstance();
  const metricsManager =
    serviceResolver.resolve<MetricsManager>("metricsManager");

  registerTypedHandler(
    socket,
    "getAllMusics",
    wrapAsync((callback: (musics: Music[]) => void) => {
      const start = Date.now();
      const hasError = false;
      const result = withErrorHandler(() => {
        const list = Array.from(musicDB.values());
        logger.info("getAllMusics handler invoked", {
          socketId: socket.id,
          count: list.length,
        });
        return list;
      }, "getAllMusics data retrieval");

      if (metricsManager)
        metricsManager.updateRpcGetAllMusics(Date.now() - start, hasError);

      const musicList = typeof result === "function" ? result() : result;
      callback(musicList ?? []);
    }, "getAllMusics handler"),
  );
}
