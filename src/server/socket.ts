import type { C2S, S2C } from "@/shared/types/socket";
import { google } from "googleapis";
import { Server as HttpServer } from "http";
import { randomUUID } from "crypto";
import type { Socket } from "socket.io";
import type { ReplyOptions } from "node_modules/@conform-to/dom/dist/submission";
import { Server } from "socket.io";
import { SERVER_ENV } from "~/env.server";
import type { Music, RemoteStatus } from "~/stores/musicStore";
import { YouTubeService } from "./youtubeService";
import { extractYoutubeId } from "@/shared/libs/youtube";
import logger from "./logger";

export class SocketServerInstance {
    musicDB: Map<string, Music> = new Map();
    remoteStatus: RemoteStatus = {
        type: "closed",
    };

    io: Server<C2S, S2C>;
    youtubeService = new YouTubeService();

    constructor(server: HttpServer) {
        this.io = new Server<C2S, S2C>(server);
        this.io.on("connection", (socket) => {
            const requestId = randomUUID();
            const ctx = { socketId: socket.id, requestId };
            this.setupSocketHandlers(socket as Socket<C2S, S2C>);
            logger.info("socket connected", ctx);
        });
    }

    private setupSocketHandlers(socket: Socket<C2S, S2C>) {
        this.registerGetAllMusics(socket);
        this.registerGetRemoteStatus(socket);
    }

    private registerGetAllMusics(socket: Socket<C2S, S2C>) {
        socket.on("getAllMusics", (callback: (musics: Music[]) => void) => {
            callback(Array.from(this.musicDB.values()));
        });
    }

    private registerGetRemoteStatus(socket: Socket<C2S, S2C>) {
        socket.on("getRemoteStatus", (callback: (state: RemoteStatus) => void) => {
            callback(this.remoteStatus);
        });
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
            logger.warn("youtube metadata fetch failed", { id, reason: metaRes.error });
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

        return {};
    }
}
