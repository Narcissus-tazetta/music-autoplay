import type { C2S as _C2S, S2C as _S2C } from "~/shared/types/socket";
import convertISO8601Duration from "convert-iso8601-duration";
import { google } from "googleapis";
import type { Server as HttpServer } from "http";
// ReplyOptions is a tiny shape we need for form errors; avoid importing from node_modules path
type ReplyOptions<T = string[]> = { formErrors?: T; fieldErrors?: Record<string, T> };
import { Server } from "socket.io";
import { SERVER_ENV } from "../env.server";
// Local copies of the shapes used by this module to avoid cross-module type resolution issues
type MusicShape = {
    url: string;
    title: string;
    thumbnail?: string;
    channelName?: string;
    channelId?: string;
    requesterHash?: string;
    duration?: string;
    addedAt?: string;
    id?: string;
};

type RemoteStatusShape = { type: "open" | "closed" | "playing" | "paused"; nowPlayingId?: string };

import type { Music } from "~/shared/types/music";

const slicer = [/https:\/\/www.youtube.com\/watch\?v=([^&/]+)/, /https:\/\/youtu.be\/(.+?)(?:\/|$)/];

export class SocketServerInstance {
    musicDB: MusicShape[] = [];
    remoteStatus: RemoteStatusShape = { type: "closed" };

    io: Server;
    youtube = google.youtube({
        version: "v3",
        auth: SERVER_ENV.YOUTUBE_API_KEY,
    });

    constructor(server: HttpServer) {
        this.io = new Server(server);
        this.io.on("connection", (socket) => {
            socket.on("getAllMusics", (callback: (musics: MusicShape[]) => void) => {
                callback(Array.from(this.musicDB));
            });
            socket.on("getRemoteStatus", (callback: (status: RemoteStatusShape) => void) => {
                callback(this.remoteStatus);
            });
        });
    }

    async addMusic(url: string, requesterHash?: string): Promise<ReplyOptions> {
        const match = slicer.find((regex) => regex.test(url));
        if (!match) {
            return { formErrors: ["URLからIDを取得できませんでした。"] };
        }
        const exec = match.exec(url);
        const id = exec?.[1];
        if (!id) return { formErrors: ["URLからIDを取得できませんでした。"] };

        const index = this.musicDB.findIndex((music) => music.id === id);
        if (index !== -1) {
            return {
                formErrors: [`この楽曲はすでに${index + 1}番目に登録されています。`],
            };
        }

        const res = await this.youtube.videos.list({
            part: ["snippet", "contentDetails"],
            id: [id],
        });

        const item = res.data.items?.[0];
        if (!item) {
            return {
                formErrors: ["動画が見つかりませんでした。"],
            };
        }

        if (item.contentDetails?.contentRating?.ytRating === "ytAgeRestricted") {
            return {
                formErrors: ["年齢制限付き動画は登録できません。"],
            };
        }
        if (
            !item.snippet ||
            !item.snippet.title ||
            !item.snippet.channelTitle ||
            !item.snippet.channelId ||
            !item.contentDetails?.duration
        ) {
            return {
                formErrors: ["動画の情報が取得できませんでした。"],
            };
        }

        const duration = convertISO8601Duration(item.contentDetails.duration);
        // convertISO8601Duration returns total seconds
        const total = Number(duration);
        const durationSecs = total % 60;
        const durationMins = Math.floor((total / 60) % 60);
        const durationHours = Math.floor(total / 3600);

        const music: MusicShape = {
            url,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails?.default?.url || "",
            channelName: item.snippet.channelTitle,
            id,
            channelId: item.snippet.channelId,
            duration: `${durationHours.toString().padStart(2, "0")}:${durationMins
                .toString()
                .padStart(2, "0")}:${durationSecs.toString().padStart(2, "0")}`,
            requesterHash,
        };

        this.musicDB.push(music);
        this.io.emit("musicAdded", music as any);

        return {};
    }
    removeMusic(url: string, requesterHash: string): ReplyOptions {
        const match = slicer.find((regex) => regex.test(url));
        if (!match) {
            return {
                formErrors: ["URLからIDを取得できませんでした。"],
            };
        }
        const exec = match.exec(url);
        const id = exec?.[1];
        if (!id) {
            return {
                formErrors: ["URLからIDを取得できませんでした。"],
            };
        }

        const index = this.musicDB.findIndex((music) => music.id === id);
        if (index === -1) {
            return {
                formErrors: ["この楽曲は登録されていません。"],
            };
        }

        if (this.musicDB[index].requesterHash !== requesterHash) {
            return {
                formErrors: ["この楽曲はあなたがリクエストしたものではありません。"],
            };
        }

        const removedMusic = this.musicDB.splice(index, 1)[0];
        this.io.emit("musicRemoved", removedMusic.id ?? removedMusic.url);

        return {};
    }
}
