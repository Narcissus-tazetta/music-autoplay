import type { Server, Socket } from "socket.io";
import type { C2S, S2C } from "~/socket";
import { musics, currentState } from "../youtubeState";
import { log } from "../logger";
import type { ClientsMap } from "../types";

export function registerConnectionHandlers(
  io: Server<C2S, S2C>,
  socket: Socket<C2S, S2C>,
  clients: ClientsMap
) {
  log.socket(`🔗 Connected: ${socket.id.substring(0, 8)}...`);
  clients.set(socket.id, {
    connectedAt: new Date(),
    userAgent: socket.handshake.headers["user-agent"],
    ipAddress: socket.handshake.address,
  });
  socket.emit("initMusics", musics);

  if (currentState.lastYoutubeStatus) {
    setTimeout(() => {
      if (currentState.lastYoutubeStatus) {
        socket.emit("current_youtube_status", currentState.lastYoutubeStatus);
      }
    }, 10);
  }

  socket.on("disconnect", (reason) => {
    log.socket(`❌ Disconnected: ${socket.id.substring(0, 8)}... (${reason})`);
    clients.delete(socket.id);
  });

  socket.on("error", (err) => {
    log.error(
      `⚠️  Socket error [${socket.id.substring(0, 8)}...]:`,
      err instanceof Error ? err : new Error(String(err))
    );
  });
}
