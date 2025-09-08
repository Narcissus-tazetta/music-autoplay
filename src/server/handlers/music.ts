import type { Socket } from "socket.io";
import type { ReplyOptions } from "node_modules/@conform-to/dom/dist/submission";
import type { Music } from "~/stores/musicStore";
import type { YouTubeService } from "../youtubeService";
import type FileStore from "../musicPersistence";
import { extractYoutubeId } from "../../shared/libs/youtube";
import logger, { withContext } from "../logger";

type Deps = {
    musicDB: Map<string, Music>;
    io: Socket["server"];
    youtubeService: YouTubeService;
    fileStore: FileStore;
};

export default function createMusicHandlers(deps: Deps) {
    const { musicDB, io, youtubeService, fileStore } = deps;

    async function addMusic(
        url: string,
        requesterHash?: string,
        ctx?: { socketId?: string; requestId?: string }
    ): Promise<ReplyOptions<string[]>> {
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
        if (meta.isAgeRestricted) return { formErrors: ["年齢制限付き動画は登録できません。"] };

        const music: Music = {
            title: meta.title,
            channelName: meta.channelTitle,
            id,
            channelId: meta.channelId,
            duration: meta.duration,
            requesterHash,
        };

        musicDB.set(id, music);
        l.info("music added", { id, title: music.title, requesterHash });
        io.emit("musicAdded", music);
        try {
            const res = (fileStore as any).add(music as any);
            if (res && typeof res.then === "function") await res;
        } catch (e) {
            l.warn("failed to persist music add", { error: e, id });
        }

        return {};
    }

    function register(socket: Socket, ctx?: { socketId?: string; requestId?: string }) {
        const l = ctx ? withContext(ctx) : logger;

        socket.on("addMusic", async (url: string, requesterHash: string, cb: (res: ReplyOptions<string[]>) => void) => {
            const res = await addMusic(url, requesterHash, ctx);
            cb(res);
        });

        socket.on(
            "removeMusic",
            async (url: string, requesterHash: string, cb: (res: ReplyOptions<string[]>) => void) => {
                const id = extractYoutubeId(url);
                if (!id) return cb({ formErrors: ["URLからIDを取得できませんでした。"] });
                if (!musicDB.has(id)) return cb({ formErrors: ["この楽曲は登録されていません。"] });
                const existing = musicDB.get(id)!;
                if (existing.requesterHash !== requesterHash)
                    return cb({
                        formErrors: ["この楽曲はあなたがリクエストしたものではありません。"],
                    });

                musicDB.delete(id);
                l.info("music removed", { id, requesterHash });
                io.emit("musicRemoved", id);
                try {
                    const res = (fileStore as any).remove(id);
                    if (res && typeof res.then === "function") await res;
                } catch (e) {
                    l.warn("failed to persist music removal", { error: e, id });
                }
                cb({});
            }
        );
    }

    return { register, addMusic /* exported for unit testing */ };
}
