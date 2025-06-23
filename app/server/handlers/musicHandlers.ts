import type { Server, Socket } from "socket.io";
import type { C2S, S2C } from "~/socket";
import type { Music } from "~/stores/musicStore";
import { musics } from "../youtubeState";
import { extractYouTubeId } from "../utils";
import { log } from "../logger";
import { saveMusicRequests } from "../musicPersistence";
import {
  validateMusicData,
  validateUrlForDelete,
  validatePlaylistSize,
  logValidationEvent,
} from "../middleware/validation";

export function registerMusicHandlers(io: Server<C2S, S2C>, socket: Socket<C2S, S2C>) {
  /**
   * 管理者認証ハンドラー
   * 環境変数ADMIN_SECRETと照合して管理者権限を付与
   */
  socket.on("adminAuth", (code: string, callback) => {
    const adminSecret = process.env.ADMIN_SECRET;

    if (!adminSecret) {
      log.error("管理者認証: ADMIN_SECRET環境変数が設定されていません");
      if (typeof callback === "function") {
        callback({ success: false, error: "管理者認証が利用できません" });
      }
      return;
    }

    if (code === adminSecret) {
      log.info(`管理者認証成功: ${socket.id.substring(0, 8)}...`);
      if (typeof callback === "function") {
        callback({ success: true });
      }
    } else {
      log.warn(`管理者認証失敗: ${socket.id.substring(0, 8)}... - 無効なコード`);
      if (typeof callback === "function") {
        callback({ success: false, error: "無効な管理者コードです" });
      }
    }
  });

  socket.on("addMusic", (music: Music, callback) => {
    const validation = validateMusicData(music);
    if (!validation.isValid) {
      logValidationEvent("addMusic", socket.id, validation.error, music);
      if (typeof callback === "function") {
        callback(validation.error);
      }
      return;
    }

    const sizeValidation = validatePlaylistSize(musics.length);
    if (!sizeValidation.isValid) {
      logValidationEvent("addMusic", socket.id, sizeValidation.error);
      if (typeof callback === "function") {
        callback(sizeValidation.error);
      }
      return;
    }

    const sanitizedMusic = validation.sanitized!;
    const newId = extractYouTubeId(sanitizedMusic.url);
    const exists = musics.some((m) => extractYouTubeId(m.url) === newId);

    if (!exists) {
      log.info(`🎵 Added: "${sanitizedMusic.title}" (${musics.length + 1} total)`);

      // メモリ配列に追加
      musics.push(sanitizedMusic);
      // JSONファイルに保存
      saveMusicRequests(musics);

      io.emit("url_list", musics);
      logValidationEvent("addMusic", socket.id);

      if (typeof callback === "function") {
        callback();
      }
    } else {
      const errorMsg = "この楽曲はすでにリクエストされています";
      logValidationEvent("addMusic", socket.id, errorMsg);
      if (typeof callback === "function") {
        callback(errorMsg);
      }
    }
  });

  socket.on("deleteMusic", (url: string) => {
    const validation = validateUrlForDelete(url);
    if (!validation.isValid) {
      logValidationEvent("deleteMusic", socket.id, validation.error, url);
      return;
    }

    const sanitizedUrl = validation.sanitizedUrl!;
    const idx = musics.findIndex((m) => m.url === sanitizedUrl);
    if (idx !== -1) {
      const removed = musics.splice(idx, 1)[0];
      log.info(`🗑️  Removed: "${removed.title}" (${musics.length} total)`);

      // JSONファイルからも削除
      saveMusicRequests(musics);

      io.emit("deleteMusic", removed.url);
      logValidationEvent("deleteMusic", socket.id);
    } else {
      logValidationEvent("deleteMusic", socket.id, "楽曲が見つかりません", url);
    }
  });

  // 初回接続時の楽曲リスト送信
  socket.emit("url_list", musics);

  socket.on("get_urls", () => {
    socket.emit("url_list", musics);
  });

  socket.on("submit_url", (url: string) => {
    const validation = validateUrlForDelete(url);
    if (!validation.isValid) {
      logValidationEvent("submit_url", socket.id, validation.error, url);
      return;
    }

    const sanitizedUrl = validation.sanitizedUrl!;

    if (!sanitizedUrl || musics.some((item) => item.url === sanitizedUrl)) {
      logValidationEvent("submit_url", socket.id, "URLが空または重複しています", url);
      return;
    }

    const sizeValidation = validatePlaylistSize(musics.length);
    if (!sizeValidation.isValid) {
      logValidationEvent("submit_url", socket.id, sizeValidation.error);
      return;
    }

    const videoData = {
      url: sanitizedUrl,
      title: "",
      thumbnail: "",
      channel: "",
      duration: "",
      addedAt: new Date().toISOString(),
    };

    // メモリとJSONファイルの両方に追加
    musics.push(videoData);
    saveMusicRequests(musics);

    log.info(`📎 URL submitted: ${musics.length} total`);
    io.emit("url_list", musics);
    io.emit("new_url", videoData);
    logValidationEvent("submit_url", socket.id);
  });

  socket.on("delete_url", (data: string | { url: string }) => {
    const validation = validateUrlForDelete(data);
    if (!validation.isValid) {
      logValidationEvent("delete_url", socket.id, validation.error, data);
      return;
    }

    const sanitizedUrl = validation.sanitizedUrl!;
    const targetId = extractYouTubeId(sanitizedUrl);

    const index = musics.findIndex((item) => extractYouTubeId(item.url) === targetId);
    if (index !== -1) {
      const removed = musics.splice(index, 1)[0];
      log.info(`🗑️  Deleted: "${removed.title}" (${musics.length} total)`);

      // JSONファイルからも削除
      saveMusicRequests(musics);

      io.emit("url_list", musics);
      io.emit("delete_url", sanitizedUrl);
      io.emit("new_url", musics[0] || null);
      logValidationEvent("delete_url", socket.id);
    } else {
      logValidationEvent("delete_url", socket.id, "楽曲が見つかりません", data);
    }
  });
}
