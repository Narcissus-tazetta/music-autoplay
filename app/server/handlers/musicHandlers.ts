import type { Server, Socket } from "socket.io";
import type { C2S, S2C } from "~/socket";
import type { Music } from "~/stores/musicStore";
import { musics } from "../youtubeState";
import { extractYouTubeId } from "../utils";
import { log } from "../logger";

export function registerMusicHandlers(
  io: Server<C2S, S2C>,
  socket: Socket<C2S, S2C>
) {
  socket.on("addMusic", (music: Music, callback) => {
    // YouTube動画IDで重複判定（現在のmusicsのみ）
    const newId = extractYouTubeId(music.url);
    const exists = musics.some((m) => extractYouTubeId(m.url) === newId);

    if (!exists) {
      log.info(`🎵 Added: "${music.title}" (${musics.length + 1} total)`);
      musics.push(music);
      io.emit("url_list", musics);

      // 成功時はエラーなしでコールバック実行
      if (typeof callback === "function") {
        callback();
      }
    } else {
      // エラー時はエラーメッセージでコールバック実行
      if (typeof callback === "function") {
        callback("この楽曲はすでにリクエストされています");
      }
    }
  });

  socket.on("deleteMusic", (url: string) => {
    const idx = musics.findIndex((m) => m.url === url);
    if (idx !== -1) {
      const removed = musics.splice(idx, 1)[0];
      log.info(`🗑️  Removed: "${removed.title}" (${musics.length} total)`);
      io.emit("deleteMusic", removed.url);
    }
  });

  // 初期リスト送信
  log.socket(`📋 Sent ${musics.length} songs to ${socket.id.substring(0, 8)}...`);
  socket.emit("url_list", musics);

  socket.on("get_urls", () => {
    log.socket(`📋 Sent ${musics.length} songs to ${socket.id.substring(0, 8)}...`);
    socket.emit("url_list", musics);
  });

  socket.on("submit_url", (url: string) => {
    if (!url || musics.some((item) => item.url === url)) return;
    const videoData = { url, title: "", thumbnail: "" };
    musics.push(videoData);
    log.info(`📎 URL submitted: ${musics.length} total`);
    io.emit("url_list", musics);
    io.emit("new_url", videoData);
  });

  socket.on("delete_url", (data: string | { url: string }) => {
    const url = typeof data === "string" ? data : data.url;
    const targetId = extractYouTubeId(url);

    const index = musics.findIndex(
      (item) => extractYouTubeId(item.url) === targetId
    );
    if (index !== -1) {
      const removed = musics.splice(index, 1)[0];
      log.info(`🗑️  Deleted: "${removed.title}" (${musics.length} total)`);
      io.emit("url_list", musics);
      io.emit("delete_url", url);
      io.emit("new_url", musics[0] || null);
    }
  });
}
