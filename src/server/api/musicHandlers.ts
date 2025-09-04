/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { Server, Socket } from "socket.io";
import type { Music } from "../../shared/types/music";
import type { C2S, S2C } from "../../types/socket";
import { log } from "../logger";
import { createSocketRateLimit } from "../middleware/rateLimit";
import {
  logValidationEvent,
  validateMusicData,
  validatePlaylistSize,
  validateUrlForDelete,
} from "../middleware/validation";
import { saveMusicRequests } from "../musicPersistence";
import { extractYouTubeId } from "../utils";
import { musics } from "../youtubeState";

const adminAuthLimit = createSocketRateLimit({
  windowMs: 1000,
  maxRequests: 1,
  message: "認証試行が制限されています。",
});

const musicActionLimit = createSocketRateLimit({
  windowMs: 1000,
  maxRequests: 1,
  message: "楽曲操作が制限されています。",
});

export function registerMusicHandlers(
  io: Server<C2S, S2C>,
  socket: Socket<C2S, S2C>,
) {
  socket.on("adminAuth", (code: string, callback) => {
    const adminSecret = process.env.ADMIN_SECRET;

    if (!adminSecret) {
      log.error("管理者認証: ADMIN_SECRET環境変数が設定されていません");
      if (typeof callback === "function")
        callback({ success: false, error: "管理者認証が利用できません" });
      return;
    }

    if (code === adminSecret) {
      log.info(`管理者認証成功: ${socket.id.substring(0, 8)}...`);
      if (typeof callback === "function") callback({ success: true });
    } else {
      log.warn(
        `管理者認証失敗: ${socket.id.substring(0, 8)}... - 無効なコード`,
      );
      if (typeof callback === "function")
        callback({ success: false, error: "無効な管理者コードです" });
    }
  });

  socket.on("adminAuthByQuery", (queryParam: string, callback) => {
    if (!adminAuthLimit(socket.id)) {
      if (typeof callback === "function")
        callback({
          success: false,
          error: "認証試行が制限されています。1秒後にお試しください。",
        });
      return;
    }

    const adminSecret = process.env.ADMIN_SECRET;

    if (!adminSecret) {
      log.error("URL管理者認証: ADMIN_SECRET環境変数が設定されていません");
      if (typeof callback === "function")
        callback({ success: false, error: "管理者認証が利用できません" });
      return;
    }

    if (queryParam === adminSecret) {
      log.info(`URL管理者認証成功: ${socket.id.substring(0, 8)}...`);
      if (typeof callback === "function") callback({ success: true });
    } else {
      log.warn(
        `URL管理者認証失敗: ${socket.id.substring(0, 8)}... - 無効なクエリパラメータ`,
      );
      if (typeof callback === "function")
        callback({ success: false, error: "無効な管理者クエリパラメータです" });
    }
  });

  socket.on("addMusic", (music: Music, callback) => {
    if (!musicActionLimit(socket.id)) {
      if (typeof callback === "function")
        callback("楽曲追加が制限されています。1秒後にお試しください。");
      return;
    }

    const validation = validateMusicData(music);
    if (!validation.isValid) {
      logValidationEvent("addMusic", socket.id, validation.error, music);
      if (typeof callback === "function") callback(validation.error);
      return;
    }

    const sizeValidation = validatePlaylistSize(musics.length);
    if (!sizeValidation.isValid) {
      logValidationEvent("addMusic", socket.id, sizeValidation.error);
      if (typeof callback === "function") callback(sizeValidation.error);
      return;
    }

    const sanitizedMusic = validation.sanitized!;
    const newId = extractYouTubeId(sanitizedMusic.url);
    const exists = musics.some(
      (m) => extractYouTubeId(m.url) === newId || m.id === newId,
    );

    if (!exists) {
      log.info(
        `🎵 Added: "${sanitizedMusic.title}" (${musics.length + 1} total)`,
      );

      // メモリ配列に追加（サーバ側で一意の id を付与）
      const musicWithId: Music = { ...sanitizedMusic, id: newId || undefined };
      musics.push(musicWithId);
      // JSONファイルに保存
      saveMusicRequests(musics);

      io.emit("url_list", musics);
      logValidationEvent("addMusic", socket.id);

      if (typeof callback === "function") callback();
    } else {
      const errorMsg = "この楽曲はすでにリクエストされています";
      logValidationEvent("addMusic", socket.id, errorMsg);
      if (typeof callback === "function") callback(errorMsg);
    }
  });

  socket.on("deleteMusic", (urlOrId: string) => {
    // backward-compatible: if argument looks like an URL, validate and use URL; otherwise treat as id
    const isUrl = typeof urlOrId === "string" && urlOrId.startsWith("http");
    if (isUrl) {
      const validation = validateUrlForDelete(urlOrId);
      if (!validation.isValid) {
        logValidationEvent("deleteMusic", socket.id, validation.error, urlOrId);
        return;
      }
      const sanitizedUrl = validation.sanitizedUrl!;
      const idx = musics.findIndex((m) => m.url === sanitizedUrl);
      if (idx !== -1) {
        const removed = musics.splice(idx, 1)[0];
        log.info(`🗑️  Removed: "${removed.title}" (${musics.length} total)`);

        saveMusicRequests(musics);
        io.emit("deleteMusic", removed.url);
        logValidationEvent("deleteMusic", socket.id);
        return;
      }
      logValidationEvent(
        "deleteMusic",
        socket.id,
        "楽曲が見つかりません",
        urlOrId,
      );
      return;
    }

    // treat as id
    const id = urlOrId;
    const idxById = musics.findIndex(
      (m) => (m.id || extractYouTubeId(m.url)) === id,
    );
    if (idxById !== -1) {
      const removed = musics.splice(idxById, 1)[0];
      log.info(
        `🗑️  Removed by id: "${removed.title}" (${musics.length} total)`,
      );

      saveMusicRequests(musics);
      io.emit("deleteMusic", removed.url);
      logValidationEvent("deleteMusic", socket.id);
    } else {
      logValidationEvent(
        "deleteMusic",
        socket.id,
        "楽曲が見つかりません (by id)",
        id,
      );
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
      logValidationEvent(
        "submit_url",
        socket.id,
        "URLが空または重複しています",
        url,
      );
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

    const index = musics.findIndex(
      (item) => extractYouTubeId(item.url) === targetId,
    );
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
