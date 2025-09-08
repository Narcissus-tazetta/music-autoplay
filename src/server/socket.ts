import type { C2S, S2C } from "@/shared/types/socket";
import { Server as HttpServer } from "http";
import { randomUUID } from "crypto";
import type { Socket } from "socket.io";
import type { ReplyOptions } from "node_modules/@conform-to/dom/dist/submission";
import { Server } from "socket.io";
import type { Music, RemoteStatus } from "~/stores/musicStore";
import { YouTubeService } from "./youtubeService";
import FileStore, { defaultFileStore } from "./musicPersistence";
import { extractYoutubeId } from "@/shared/libs/youtube";
import logger from "./logger";
import registerGetAllMusics from "./handlers/getAllMusics";
import registerGetRemoteStatus from "./handlers/getRemoteStatus";
import createMusicHandlers from "./handlers/music";

export class SocketServerInstance {
    musicDB: Map<string, Music> = new Map();
    remoteStatus: RemoteStatus = {
        type: "closed",
    };

    io: Server<C2S, S2C>;
    youtubeService: YouTubeService;
    fileStore: FileStore;
    constructor(server: HttpServer, youtubeService?: YouTubeService, fileStore: FileStore = defaultFileStore) {
        this.io = new Server<C2S, S2C>(server);
        this.youtubeService = youtubeService ?? new YouTubeService();
        this.fileStore = fileStore;
        try {
            const persisted = this.fileStore.load();
            for (const m of persisted) this.musicDB.set(m.id, m);
            logger.info("restored persisted musics", { count: persisted.length });
        } catch (e) {
            logger.warn("failed to restore persisted musics", { error: e });
        }

        this.io.on("connection", (socket) => {
            const requestId = randomUUID();
            const ctx = { socketId: socket.id, requestId };
            this.setupSocketHandlers(socket as Socket<C2S, S2C>, ctx);
            logger.info("socket connected", ctx);
        });
    }

    private setupSocketHandlers(socket: Socket<C2S, S2C>, ctx: { socketId: string; requestId: string }) {
        registerGetAllMusics(socket, this.musicDB);
        registerGetRemoteStatus(socket, this.remoteStatus);
        const musicHandlers = createMusicHandlers({
            musicDB: this.musicDB,
            io: this.io,
            youtubeService: this.youtubeService,
            fileStore: this.fileStore,
        });
        musicHandlers.register(socket as Socket<C2S, S2C>, ctx);
    }

    async addMusic(url: string, requesterHash?: string): Promise<ReplyOptions<string[]>> {
        const id = extractYoutubeId(url);
        if (!id) {
            return {
                formErrors: ["URLからIDを取得できませんでした。"],
            };
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
        if (meta.isAgeRestricted) {
            return {
                formErrors: ["年齢制限付き動画は登録できません。"],
            };
        }

        const music: Music = {
            title: meta.title,
            channelName: meta.channelTitle,
            id,
            channelId: meta.channelId,
            duration: meta.duration,
            requesterHash,
        };

        this.musicDB.set(id, music);
        logger.info("music added", { id, title: music.title, requesterHash });
        this.io.emit("musicAdded", music);
        try {
            this.fileStore.add(music);
        } catch (e) {
            logger.warn("failed to persist music add", { error: e, id });
        }

        return {};
    }
    removeMusic(url: string, requesterHash: string): ReplyOptions<string[]> {
        const id = extractYoutubeId(url);
        if (!id) {
            return {
                formErrors: ["URLからIDを取得できませんでした。"],
            };
        }

        if (!this.musicDB.has(id)) {
            return {
                formErrors: ["この楽曲は登録されていません。"],
            };
        }

        const existing = this.musicDB.get(id)!;
        if (existing.requesterHash !== requesterHash) {
            return {
                formErrors: ["この楽曲はあなたがリクエストしたものではありません。"],
            };
        }

        this.musicDB.delete(id);
        logger.info("music removed", { id, requesterHash });
        this.io.emit("musicRemoved", id);
        try {
            this.fileStore.remove(id);
        } catch (e) {
            logger.warn("failed to persist music removal", { error: e, id });
        }

        return {};
    }
}
