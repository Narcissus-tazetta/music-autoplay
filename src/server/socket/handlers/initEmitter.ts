import { withErrorHandler } from "@/shared/utils/errors";
import type { Socket } from "socket.io";
import type ConfigService from "../../config/configService";
import type { AppLogger } from "../../logger";
import type { MusicService } from "../../music/musicService";
import ServiceResolver from "../../utils/serviceResolver";

export function emitInitialData(
  socket: Socket,
  log: AppLogger,
  getMusicService: () => MusicService,
) {
  withErrorHandler(() => {
    const compatList = getMusicService().buildCompatList();
    log.info("emitting init lists to socket", {
      socketId: socket.id,
      count: compatList.length,
    });
    socket.emit("initMusics", compatList);
    socket.emit("url_list", compatList);
    const resolver = ServiceResolver.getInstance();
    const configService = resolver.resolve<ConfigService>("configService");
    let nodeEnv = "development";
    if (configService && typeof configService.getString === "function")
      nodeEnv = configService.getString("NODE_ENV") ?? "development";
    if (nodeEnv !== "production") {
      log.info("emitted init events to socket", {
        socketId: socket.id,
        count: compatList.length,
      });
    }
  }, "socket init emit")();
}
