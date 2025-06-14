import type { Server, Socket } from "socket.io";
import type { C2S, S2C } from "~/socket";
import { musics, currentState } from "../youtubeState";

export function registerConnectionHandlers(
  io: Server<C2S, S2C>,
  socket: Socket<C2S, S2C>,
  clients: Map<string, any>
) {
  // 接続時の初期化
  console.log(`🔗 Client connected: ${socket.id.substring(0, 8)}...`);
  clients.set(socket.id, {});
  socket.emit("initMusics", musics);

  if (currentState.lastYoutubeStatus) {
    setTimeout(() => {
      socket.emit("current_youtube_status", currentState.lastYoutubeStatus);
    }, 10);
  }

  // 切断処理
  socket.on("disconnect", (reason) => {
    console.log(`❌ Client disconnected: ${socket.id.substring(0, 8)}... (${reason})`);
    clients.delete(socket.id);
  });

  // エラー処理
  socket.on("error", (err) => {
    console.error(`⚠️  Socket error [${socket.id.substring(0, 8)}...]:`, err.message);
  });
}
