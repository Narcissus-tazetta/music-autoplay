import {
  AddMusicSchema,
  RemoveMusicSchema,
  YouTubeMetaSchema,
} from "@/shared/schemas/music";
import type { Server as IOServer, Socket } from "socket.io";
import type { Music } from "~/stores/musicStore";
import { extractYoutubeId } from "../../shared/libs/youtube";
import logger, { logMetric, withContext } from "../logger";
import type { Store } from "../persistence";
import { persistAdd, persistRemove } from "../persistence/storeHelpers";
import type { ReplyOptions } from "../socket/types";
import { withAsyncErrorHandler, withErrorHandler } from "../utils/errorHandler";
import { wrapAsync } from "../utils/errorHandlers";
import {
  createErrorReply,
  createServerErrorReply,
  createValidationErrorReply,
} from "../utils/errorHandling";
import { normalizeYoutubeMeta } from "../utils/normalizeYoutubeMeta";
import ServiceResolver from "../utils/serviceResolver";
import type { ServiceDependencies } from "../utils/serviceResolver";
import { registerTypedHandler } from "../utils/socketHelpers";
import type { YouTubeService } from "../youtubeService";

type Deps = {
  musicDB: Map<string, Music>;
  io?: IOServer;
  emit?: (
    ev: string,
    payload: unknown,
    opts?: { context?: unknown },
  ) => boolean;
  youtubeService?: YouTubeService;
  fileStore?: Store;
  isAdmin?: (requesterHash?: string) => boolean;
};

export default function createMusicHandlers(deps: Deps) {
  const {
    musicDB,
    emit,
    youtubeService: providedYoutube,
    fileStore: providedFileStore,
    isAdmin,
  } = deps;

  // Use provided services directly if available, otherwise resolve from container
  let youtubeService: YouTubeService | undefined = providedYoutube;
  let fileStore: Store | undefined = providedFileStore;

  // Only try to resolve from container if services aren't provided
  if (!youtubeService || !fileStore) {
    try {
      const serviceResolver = ServiceResolver.getInstance();
      const resolvedDeps = serviceResolver.resolveDependencies({
        youtubeService: providedYoutube,
        fileStore: providedFileStore,
      }) as Partial<ServiceDependencies> | undefined;
      if (
        !youtubeService &&
        resolvedDeps &&
        typeof resolvedDeps.youtubeService !== "undefined"
      )
        youtubeService = resolvedDeps.youtubeService as YouTubeService;
      if (
        !fileStore &&
        resolvedDeps &&
        typeof resolvedDeps.fileStore !== "undefined"
      )
        fileStore = resolvedDeps.fileStore as Store;
    } catch (error) {
      // In test environments, we might not have container setup
      if (!youtubeService || !fileStore) throw error;
    }
  }

  const localEmit = withErrorHandler(
    (ev: string, payload: unknown, opts?: { context?: unknown }) => {
      if (typeof emit === "function") return emit(ev, payload, opts);
      if (deps.io && typeof deps.io.emit === "function") {
        deps.io.emit(ev, payload);
        return true;
      }
      return false;
    },
    "localEmit",
  );

  const addMusic = withAsyncErrorHandler(
    async (
      url: string,
      requesterHash?: string,
      ctx?: { socketId?: string; requestId?: string },
    ): Promise<ReplyOptions> => {
      const l = ctx ? withContext(ctx) : logger;

      const parsedPayload = AddMusicSchema.safeParse({ url, requesterHash });
      if (!parsedPayload.success) {
        return createValidationErrorReply({
          url: parsedPayload.error.errors
            .filter((e) => e.path.includes("url"))
            .map((e) => e.message),
          requesterHash: parsedPayload.error.errors
            .filter((e) => e.path.includes("requesterHash"))
            .map((e) => e.message),
        });
      }

      const id = extractYoutubeId(url);
      if (!id) return createErrorReply("URLからIDを取得できませんでした。");
      if (musicDB.has(id)) {
        let idx = 0;
        for (const key of musicDB.keys()) {
          if (key === id) break;
          idx++;
        }
        return createErrorReply(
          `この楽曲はすでに${idx + 1}番目に登録されています。`,
        );
      }
      if (!youtubeService) {
        l.warn("youtubeService unavailable");
        return createServerErrorReply("Internal server error");
      }
      const metaRes = await youtubeService.getVideoDetails(id);
      if (!metaRes.ok) {
        l.warn("youtube metadata fetch failed", {
          id,
          reason: metaRes.error,
        });
        let maybeYoutubeErrMsg =
          "\u52d5\u753b\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3067\u3057\u305f\u3002";
        const errVal: unknown = metaRes.error as unknown;
        if (typeof errVal === "string") maybeYoutubeErrMsg = errVal;
        else if (errVal && typeof errVal === "object") {
          const errObj = errVal as Record<string, unknown>;
          if (typeof errObj.message === "string")
            maybeYoutubeErrMsg = errObj.message;
        }
        return createErrorReply(maybeYoutubeErrMsg);
      }
      const meta = metaRes.value;
      const normalized = normalizeYoutubeMeta(id, meta);
      if (!normalized) {
        l.warn("youtube metadata shape mismatch", { id, meta });
        return createErrorReply("動画メタデータの取得に失敗しました。");
      }
      const parsedMeta = YouTubeMetaSchema.safeParse(normalized);
      if (!parsedMeta.success) {
        l.warn("youtube metadata shape mismatch", {
          id,
          errors: parsedMeta.error.errors,
          meta,
        });
        return createErrorReply("動画メタデータの取得に失敗しました。");
      }
      const validatedMeta = parsedMeta.data;
      if (validatedMeta.isAgeRestricted)
        return createErrorReply("年齢制限付き動画は登録できません。");

      try {
        const music: Music = {
          title: validatedMeta.title,
          channelName: validatedMeta.channelTitle,
          id,
          channelId: validatedMeta.channelId,
          duration: validatedMeta.duration ?? "PT0S",
          requesterHash: requesterHash ? requesterHash : undefined,
        };

        musicDB.set(id, music);
        l.info("music added", { id, title: music.title, requesterHash });
        localEmit("musicAdded", music, {
          context: { operation: "addMusic", identifiers: { musicId: id } },
        });
        try {
          logMetric(
            "musicAdded",
            { source: "socket" },
            { id, title: music.title },
          );
        } catch (e: unknown) {
          l.warn("failed to log metric musicAdded", { error: e, id });
        }
        if (!fileStore) {
          l.warn("fileStore unavailable");
          return createServerErrorReply("Internal server error");
        }
        await persistAdd(fileStore, music);

        return {};
      } catch (error: unknown) {
        l.warn("addMusic: final step failed", { id, error });
        return createServerErrorReply("Internal server error");
      }
    },
    "addMusic",
  );

  const register = withErrorHandler(
    (socket: Socket, ctx?: { socketId?: string; requestId?: string }) => {
      const l = ctx ? withContext(ctx) : logger;
      registerTypedHandler(
        socket,
        "addMusic",
        wrapAsync(
          async (
            url: string,
            requesterHash?: string,
            cb?: (res: ReplyOptions) => void,
          ) => {
            const validation = AddMusicSchema.safeParse({ url, requesterHash });
            if (!validation.success) {
              if (cb) {
                cb(
                  createValidationErrorReply({
                    url: validation.error.errors
                      .filter((e) => e.path.includes("url"))
                      .map((e) => e.message),
                    requesterHash: validation.error.errors
                      .filter((e) => e.path.includes("requesterHash"))
                      .map((e) => e.message),
                  }),
                );
              }
              return;
            }
            const res = await addMusic(url, requesterHash, ctx);
            if (cb) cb(res ?? createServerErrorReply("Internal server error"));
          },
          "addMusic handler",
        ),
      );

      registerTypedHandler(
        socket,
        "removeMusic",
        (
          url: string,
          requesterHash?: string,
          cb?: (res: ReplyOptions) => void,
        ) => {
          try {
            const v = RemoveMusicSchema.safeParse({ url });
            if (!v.success) {
              const result = createValidationErrorReply({
                url: v.error.errors.map((e) => e.message),
              });
              if (cb) cb(result);
              return;
            }
            const id = extractYoutubeId(url);
            if (!id) {
              const result = createErrorReply(
                "URLからIDを取得できませんでした。",
              );
              if (cb) cb(result);
              return;
            }
            if (!musicDB.has(id)) {
              const result = createErrorReply("この楽曲は登録されていません。");
              if (cb) cb(result);
              return;
            }
            const existing = musicDB.get(id);
            if (!existing) {
              const result = createErrorReply("この楽曲は登録されていません。");
              if (cb) cb(result);
              return;
            }
            if (!existing.requesterHash) {
              if (!isAdmin || !isAdmin(requesterHash)) {
                const result = createErrorReply("この楽曲は削除できません。");
                if (cb) cb(result);
                return;
              }
            }

            if (String(existing.requesterHash) !== String(requesterHash)) {
              if (!isAdmin || !isAdmin(requesterHash)) {
                const result = createErrorReply(
                  "この楽曲はあなたがリクエストしたものではありません。",
                );
                if (cb) cb(result);
                return;
              }
            }

            musicDB.delete(id);
            l.info("music removed", { id, requesterHash });
            localEmit("musicRemoved", id, {
              context: {
                operation: "removeMusic",
                identifiers: { musicId: id },
              },
            });
            try {
              logMetric("musicRemoved", { source: "socket" }, { id });
            } catch (e: unknown) {
              l.warn("failed to log metric musicRemoved", { error: e, id });
            }
            void persistRemove(fileStore, id);

            if (cb) cb({} as ReplyOptions);
          } catch (error: unknown) {
            l.warn("removeMusic handler failed", { error });
            if (cb) cb(createServerErrorReply("Internal server error"));
          }
        },
      );
    },
    "register handlers",
  );

  return { register, addMusic };
}
