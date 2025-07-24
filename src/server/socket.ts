import type { C2S, S2C } from '@/shared/types/socket';
import convertISO8601Duration from 'convert-iso8601-duration';
import { google } from 'googleapis';
import { Server as HttpServer } from 'http';
import type { ReplyOptions } from 'node_modules/@conform-to/dom/dist/submission';
import { Server } from 'socket.io';
import { SERVER_ENV } from '~/env.server';
import type { Music, RemoteStatus } from '~/stores/musicStore';

const slicer = [
    /https:\/\/www.youtube.com\/watch\?v=([^&/]+)/,
    /https:\/\/youtu.be\/(.+?)\//,
];

export class SocketServerInstance {
    musicDB: Music[] = [];
    remoteStatus: RemoteStatus = {
        type: 'closed',
    };

    io: Server<C2S, S2C>;
    youtube = google.youtube({
        version: 'v3',
        auth: SERVER_ENV.YOUTUBE_API_KEY,
    });

    constructor(server: HttpServer) {
        this.io = new Server<C2S, S2C>(server);
        this.io.on('connection', socket => {
            socket.on('getAllMusics', callback => {
                callback(Array.from(this.musicDB));
            }).on('getRemoteStatus', callback => {
                callback(this.remoteStatus);
            });
        });
    }

    async addMusic(url: string, requesterHash?: string): Promise<ReplyOptions<string[]>> {
        const match = slicer.find(regex => regex.test(url));
        if (!match) {
            return {
                formErrors: ['URLからIDを取得できませんでした。'],
            };
        }
        const id = match.exec(url)?.at(-1);
        if (!id) {
            return {
                formErrors: ['URLからIDを取得できませんでした。'],
            };
        }

        const index = this.musicDB.findIndex(music => music.id === id);
        if (index !== -1) {
            return {
                formErrors: [`この楽曲はすでに${index + 1}番目に登録されています。`],
            };
        }

        const res = await this.youtube.videos.list({
            part: ['snippet', 'contentDetails'],
            id: [id],
        });

        const item = res.data.items?.[0];
        if (!item) {
            return {
                formErrors: ['動画が見つかりませんでした。'],
            };
        }

        if (item.contentDetails?.contentRating?.ytRating === 'ytAgeRestricted') {
            return {
                formErrors: ['年齢制限付き動画は登録できません。'],
            };
        }
        if (
            !item.snippet
            || !item.snippet.title
            || !item.snippet.channelTitle
            || !item.snippet.channelId
            || !item.contentDetails?.duration
        ) {
            return {
                formErrors: ['動画の情報が取得できませんでした。'],
            };
        }

        const duration = convertISO8601Duration(item.contentDetails.duration);
        const durationSecs = duration % 60;
        const durationMins = Math.floor((duration / 60) % 60);
        const durationHours = Math.floor(duration / 3600);

        const music: Music = {
            title: item.snippet.title,
            channelName: item.snippet.channelTitle,
            id,
            channelId: item.snippet.channelId,
            duration: `${durationHours.toString().padStart(2, '0')}:${durationMins.toString().padStart(2, '0')}:${
                durationSecs.toString().padStart(2, '0')
            }`,
            requesterHash,
        };

        this.musicDB.push(music);
        this.io.emit('musicAdded', music);

        return {};
    }
    removeMusic(url: string, requesterHash: string): ReplyOptions<string[]> {
        const match = slicer.find(regex => regex.test(url));
        if (!match) {
            return {
                formErrors: ['URLからIDを取得できませんでした。'],
            };
        }
        const id = match.exec(url)?.at(-1);
        if (!id) {
            return {
                formErrors: ['URLからIDを取得できませんでした。'],
            };
        }

        const index = this.musicDB.findIndex(music => music.id === id);
        if (index === -1) {
            return {
                formErrors: ['この楽曲は登録されていません。'],
            };
        }

        if (this.musicDB[index].requesterHash !== requesterHash) {
            return {
                formErrors: ['この楽曲はあなたがリクエストしたものではありません。'],
            };
        }

        const removedMusic = this.musicDB.splice(index, 1)[0];
        this.io.emit('musicRemoved', removedMusic.id);

        return {};
    }
}
