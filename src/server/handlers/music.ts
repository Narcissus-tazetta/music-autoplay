import type { Socket, Server as IOServer } from "socket.io";
type ReplyOptions = { formErrors?: string[] } | Record<string, unknown>;
import type { Music } from "~/stores/musicStore";
import type { YouTubeService } from "../youtubeService";
import type { Store } from "../musicPersistence";
import { extractYoutubeId } from "../../shared/libs/youtube";
import { AddMusicSchema, RemoveMusicSchema, YouTubeMetaSchema } from "@/shared/schemas/music";
import { normalizeYoutubeMeta } from "../utils/normalizeYoutubeMeta";
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

    async function addMusic(
        url: string,
        requesterHash?: string,
        ctx?: { socketId?: string; requestId?: string }
    ): Promise<ReplyOptions> {
        const l = ctx ? withContext(ctx) : logger;
        const parsedPayload = AddMusicSchema.safeParse({ url, requesterHash });
        if (!parsedPayload.success) {
            return { formErrors: parsedPayload.error.errors.map((e) => e.message) };
        }

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
        const normalized = normalizeYoutubeMeta(id, meta);
        if (!normalized) {
            l.warn("youtube metadata shape mismatch", { id, meta });
            return { formErrors: ["動画メタデータの取得に失敗しました。"] };
        }
        const parsedMeta = YouTubeMetaSchema.safeParse(normalized);
        if (!parsedMeta.success) {
            l.warn("youtube metadata shape mismatch", { id, errors: parsedMeta.error.errors, meta });
            return { formErrors: ["動画メタデータの取得に失敗しました。"] };
        }
        const validatedMeta = parsedMeta.data;
        if (validatedMeta.isAgeRestricted) return { formErrors: ["年齢制限付き動画は登録できません。"] };

        const music: Music = {
            title: validatedMeta.title,
            channelName: validatedMeta.channelTitle,
            id,
            channelId: validatedMeta.channelId,
            duration: validatedMeta.duration ?? "PT0S",
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
            const maybe = (fileStore as unknown as { add?: (m: Music) => unknown }).add?.(music);
            if (maybe && typeof (maybe as { then?: unknown }).then === "function") {
                await (maybe as Promise<void>);
            }
        } catch (e: unknown) {
            l.warn("failed to persist music add", { error: e, id });
        }

        return {};
    }

    function register(socket: Socket, ctx?: { socketId?: string; requestId?: string }) {
        const l = ctx ? withContext(ctx) : logger;
        registerHandler(socket, "addMusic", (url: string, requesterHash?: string, cb?: (res: ReplyOptions) => void) => {
            (async () => {
                try {
                    const validation = AddMusicSchema.safeParse({ url, requesterHash });
                    if (!validation.success) {
                        if (cb) cb({ formErrors: validation.error.errors.map((e) => e.message) });
                        return;
                    }
                    const res = await addMusic(url, requesterHash, ctx);
                    if (cb) cb(res);
                } catch (err: unknown) {
                    l.warn("addMusic handler failed", { error: err });
                    try {
                        if (cb) cb({ formErrors: ["Internal error"] });
                    } catch {}
                }
            })().catch((err: unknown) => {
                l.warn("addMusic handler unhandled rejection", { error: err });
            });
        });

        registerHandler(
            socket,
            "removeMusic",
            (url: string, requesterHash?: string, cb?: (res: ReplyOptions) => void) => {
                const v = RemoveMusicSchema.safeParse({ url });
                if (!v.success) {
                    if (cb) cb({ formErrors: v.error.errors.map((e) => e.message) });
                    return;
                }
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
                                formErrors: ["この楽曲はあなたがリクエストしたものではありません。"],
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
                    const maybeRem = (fileStore as unknown as { remove?: (id: string) => unknown }).remove?.(id);
                    if (maybeRem && typeof (maybeRem as { then?: unknown }).then === "function") {
                        (maybeRem as Promise<void>).catch((err: unknown) =>
                            l.warn("failed to persist music removal", { error: err, id })
                        );
                    }
                } catch (e: unknown) {
                    l.warn("failed to persist music removal", { error: e, id });
                }
                if (cb) cb({});
            }
        );
    }

    return { register, addMusic };
}
