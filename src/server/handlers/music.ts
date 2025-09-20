import type { Socket, Server as IOServer } from "socket.io";
// Minimal local ReplyOptions used for add/remove responses
type ReplyOptions = { formErrors?: string[] } | Record<string, unknown>;
import type { Music } from "~/stores/musicStore";
import type { YouTubeService } from "../youtubeService";
import type { Store } from "../musicPersistence";
import { extractYoutubeId } from "../../shared/libs/youtube";
import logger, { withContext, logMetric } from "../logger";
import { registerHandler } from "../utils/socketHelpers";

type Deps = {
  musicDB: Map<string, Music>;
  io: IOServer;
  youtubeService: YouTubeService;
  fileStore: Store;
  isAdmin?: (requesterHash?: string) => boolean;
};

export default function createMusicHandlers(deps: Deps) {
  const { musicDB, io, youtubeService, fileStore, isAdmin } = deps;

  // helper removed: use Promise.resolve to normalize sync/async returns

  async function addMusic(
    url: string,
    requesterHash?: string,
    ctx?: { socketId?: string; requestId?: string },
  ): Promise<ReplyOptions> {
    const l = ctx ? withContext(ctx) : logger;
    const id = extractYoutubeId(url);
    if (!id) return { formErrors: ["URLからIDを取得できませんでした。"] };
    if (musicDB.has(id)) {
      let idx = 0;
      for (const key of musicDB.keys()) {
        if (key === id) break;
        idx++;
      }
      return {
        formErrors: [`この楽曲はすでに${idx + 1}番目に登録されています。`],
      };
    }

    const metaRes = await youtubeService.getVideoDetails(id);
    if (!metaRes.ok) {
      l.warn("youtube metadata fetch failed", {
        id,
        reason: metaRes.error,
      });
      return {
        formErrors: [String(metaRes.error || "動画が見つかりませんでした。")],
      };
    }
    const meta = metaRes.value;
    if (meta.isAgeRestricted)
      return { formErrors: ["年齢制限付き動画は登録できません。"] };

    const music: Music = {
      title: meta.title,
      channelName: meta.channelTitle,
      id,
      channelId: meta.channelId,
      duration: meta.duration,
      requesterHash: requesterHash ? String(requesterHash) : undefined,
    };

    musicDB.set(id, music);
    l.info("music added", { id, title: music.title, requesterHash });
    io.emit("musicAdded", music);
    try {
      logMetric("musicAdded", { source: "socket" }, { id, title: music.title });
    } catch (e: unknown) {
      l.warn("failed to log metric musicAdded", { error: e, id });
    }
    try {
      // fileStore.add may be sync or return a Promise; await only if it's thenable
      const maybe = (
        fileStore as unknown as { add?: (m: Music) => unknown }
      ).add?.(music);
      if (maybe && typeof (maybe as { then?: unknown }).then === "function") {
        await (maybe as Promise<void>);
      }
    } catch (e: unknown) {
      l.warn("failed to persist music add", { error: e, id });
    }

    return {};
  }

  function register(
    socket: Socket,
    ctx?: { socketId?: string; requestId?: string },
  ) {
    const l = ctx ? withContext(ctx) : logger;
    registerHandler(
      socket,
      "addMusic",
      (
        url: string,
        requesterHash?: string,
        cb?: (res: ReplyOptions) => void,
      ) => {
        (async () => {
          try {
            const res = await addMusic(url, requesterHash, ctx);
            if (cb) cb(res);
          } catch (err: unknown) {
            l.warn("addMusic handler failed", { error: err });
            try {
              if (cb) cb({ formErrors: ["Internal error"] });
            } catch {
              // ignore callback errors
            }
          }
        })().catch((err: unknown) => {
          // ensure any unhandled rejection is logged
          l.warn("addMusic handler unhandled rejection", { error: err });
        });
      },
    );

    registerHandler(
      socket,
      "removeMusic",
      (
        url: string,
        requesterHash?: string,
        cb?: (res: ReplyOptions) => void,
      ) => {
        const id = extractYoutubeId(url);
        if (!id) {
          if (cb) cb({ formErrors: ["URLからIDを取得できませんでした。"] });
          return;
        }
        if (!musicDB.has(id)) {
          if (cb) cb({ formErrors: ["この楽曲は登録されていません。"] });
          return;
        }
        const existing = musicDB.get(id);
        if (!existing) {
          if (cb) cb({ formErrors: ["この楽曲は登録されていません。"] });
          return;
        }
        if (!existing.requesterHash) {
          if (!isAdmin || !isAdmin(requesterHash)) {
            if (cb) cb({ formErrors: ["この楽曲は削除できません。"] });
            return;
          }
        }

        if (String(existing.requesterHash) !== String(requesterHash)) {
          if (!isAdmin || !isAdmin(requesterHash)) {
            if (cb)
              cb({
                formErrors: [
                  "この楽曲はあなたがリクエストしたものではありません。",
                ],
              });
            return;
          }
        }

        musicDB.delete(id);
        l.info("music removed", { id, requesterHash });
        io.emit("musicRemoved", id);
        try {
          logMetric("musicRemoved", { source: "socket" }, { id });
        } catch (e: unknown) {
          l.warn("failed to log metric musicRemoved", { error: e, id });
        }
        try {
          const maybeRem = (
            fileStore as unknown as { remove?: (id: string) => unknown }
          ).remove?.(id);
          if (
            maybeRem &&
            typeof (maybeRem as { then?: unknown }).then === "function"
          ) {
            (maybeRem as Promise<void>).catch((err: unknown) =>
              l.warn("failed to persist music removal", { error: err, id }),
            );
          }
        } catch (e: unknown) {
          l.warn("failed to persist music removal", { error: e, id });
        }
        if (cb) cb({});
      },
    );
  }

  return { register, addMusic };
}
