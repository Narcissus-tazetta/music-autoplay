import type { Music } from "~/stores/musicStore";
import type { YouTubeService } from "../youtubeService";
import type { Store } from "../musicPersistence";
import { extractYoutubeId } from "@/shared/libs/youtube";
import { watchUrl } from "@/shared/libs/youtube";
import { YouTubeMetaSchema } from "@/shared/schemas/music";
import { normalizeYoutubeMeta } from "../utils/normalizeYoutubeMeta";
import logger, { logMetric } from "../logger";

type ReplyOptions = { formErrors?: string[] } | Record<string, unknown>;

export default class MusicService {
    constructor(
        public musicDB: Map<string, Music>,
        private youtubeService: YouTubeService,
        private fileStore: Store,
        private emitFn: (ev: string, payload: unknown) => void
    ) {}

    buildCompatList(): (Music & { url: string })[] {
        try {
            return Array.from(this.musicDB.values()).map((m) => ({
                ...m,
                url: watchUrl(m.id),
            }));
        } catch {
            return [] as (Music & { url: string })[];
        }
    }

    async addMusic(url: string, requesterHash?: string): Promise<ReplyOptions> {
        const id = extractYoutubeId(url);
        if (!id) {
            return { formErrors: ["URLからIDを取得できませんでした。"] };
        }

        if (this.musicDB.has(id)) {
            const idx = Array.from(this.musicDB.keys()).indexOf(id);
            return {
                formErrors: [`この楽曲はすでに${idx + 1}番目に登録されています。`],
            };
        }

        const metaRes = await this.youtubeService.getVideoDetails(id);
        if (!metaRes.ok) {
            logger.warn("youtube metadata fetch failed", {
                id,
                reason: metaRes.error,
            });
            return {
                formErrors: [String(metaRes.error || "動画が見つかりませんでした。")],
            };
        }
        const meta = metaRes.value;
        // normalize external response into canonical shape
        const normalized = normalizeYoutubeMeta(id, meta);
        if (!normalized) {
            logger.warn("youtube metadata shape mismatch (service)", { id, meta });
            return { formErrors: ["動画メタデータの取得に失敗しました。"] };
        }
        const parsedMeta = YouTubeMetaSchema.safeParse(normalized);
        if (!parsedMeta.success) {
            logger.warn("youtube metadata shape mismatch (service)", { id, errors: parsedMeta.error.errors, meta });
            return { formErrors: ["動画メタデータの取得に失敗しました。"] };
        }
        const validatedMeta = parsedMeta.data;
        if (validatedMeta.isAgeRestricted) return { formErrors: ["年齢制限付き動画は登録できません。"] };

        try {
            const parts = String(meta.duration)
                .split(":")
                .map((p) => Number(p));
            let seconds = 0;
            if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
            else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
            else if (parts.length === 1) seconds = parts[0];
            const MAX_SECONDS = 20 * 60;
            if (seconds > MAX_SECONDS) return { formErrors: ["20分より長い動画は登録できません。"] };
        } catch (e) {
            logger.debug("failed to parse duration for server-side limit check", {
                duration: meta.duration,
                error: e,
            });
        }

        const music: Music = {
            title: validatedMeta.title,
            channelName: validatedMeta.channelTitle,
            id,
            channelId: validatedMeta.channelId,
            duration: validatedMeta.duration ?? "PT0S",
            requesterHash,
        };

        this.musicDB.set(id, music);
        logger.info("music added", { id, title: music.title, requesterHash });
        try {
            this.emitFn("musicAdded", music);
        } catch (e) {
            logger.warn("failed to emit musicAdded", { error: e, id });
        }

        try {
            const compat = {
                ...music,
                url: watchUrl(music.id),
            };
            try {
                this.emitFn("addMusic", compat);
                this.emitFn("url_list", this.buildCompatList());
            } catch (e) {
                logger.warn("failed to emit legacy add events", { error: e, id });
            }
        } catch (e) {
            logger.warn("failed to emit legacy add events", { error: e, id });
        }

        try {
            this.fileStore.add(music);
        } catch (e) {
            logger.warn("failed to persist music add", { error: e, id });
        }

        try {
            logMetric("musicAdded", { source: "service" }, { id, title: music.title });
        } catch {
            // ignore metric failures
        }

        return {};
    }

    removeMusic(url: string, requesterHash?: string): ReplyOptions {
        const id = extractYoutubeId(url);
        if (!id) return { formErrors: ["URLからIDを取得できませんでした。"] };

        if (!this.musicDB.has(id)) return { formErrors: ["この楽曲は登録されていません。"] };

        const existing = this.musicDB.get(id);
        if (!existing) return { formErrors: ["この楽曲は登録されていません。"] };
        const isAdminBySecret = Boolean(requesterHash && String(requesterHash) === process.env.ADMIN_SECRET);
        if (!existing.requesterHash && !isAdminBySecret) return { formErrors: ["この楽曲は削除できません。"] };
        const isOriginalRequester = String(existing.requesterHash) === String(requesterHash);
        if (!isOriginalRequester && !isAdminBySecret)
            return {
                formErrors: ["この楽曲はあなたがリクエストしたものではありません。"],
            };

        this.musicDB.delete(id);
        logger.info("music removed", {
            id,
            requesterHash,
            isAdmin: isAdminBySecret,
        });
        try {
            this.emitFn("musicRemoved", id);
        } catch (e) {
            logger.warn("failed to emit musicRemoved", { error: e, id });
        }

        try {
            const urlStr = watchUrl(id);
            try {
                this.emitFn("deleteMusic", urlStr);
                this.emitFn("url_list", this.buildCompatList());
            } catch (e) {
                logger.warn("failed to emit legacy delete events", { error: e, id });
            }
        } catch (e) {
            logger.warn("failed to emit legacy delete events", { error: e, id });
        }

        try {
            this.fileStore.remove(id);
        } catch (e) {
            logger.warn("failed to persist music removal", { error: e, id });
        }

        try {
            logMetric("musicRemoved", { source: "service" }, { id });
        } catch {
            // ignore metric failures
        }

        return {};
    }
}
