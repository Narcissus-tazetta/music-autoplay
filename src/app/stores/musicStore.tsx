import type { C2S, S2C } from '@/shared/types/socket';
import { io, type Socket } from 'socket.io-client';
import { create } from 'zustand';

export type RemoteStatus = {
    type: 'playing';
    musicTitle: string;
} | {
    type: 'paused';
} | {
    type: 'closed';
};

export interface Music {
    title: string;
    channelName: string;
    channelId: string;
    id: string;
    duration: string;
    requesterHash?: string;
}

interface MusicStore {
    musics: Music[];
    socket: Socket<S2C, C2S>;
    remoteStatus: RemoteStatus;

    addMusic(music: Music): void;
}
export const useMusicStore = create<MusicStore>(set => {
    const socket = io({ autoConnect: false }) as Socket<S2C, C2S>;
    socket
        .on('connect', () => {
            console.info('Socket connected');
        })
        .on('musicAdded', (music: Music) => {
            set(state => ({
                musics: [...state.musics, music],
            }));
        })
        .on('musicRemoved', (musicId: string) => {
            set(state => ({
                musics: state.musics.filter(music => music.id !== musicId),
            }));
        })
        .on('remoteStatusUpdated', (state: RemoteStatus) => {
            set({
                remoteStatus: state,
            });
        })
        .connect();

    socket.emit('getAllMusics', musics => {
        set({
            musics,
        });
    });
    socket.emit('getRemoteStatus', state => {
        set({
            remoteStatus: state,
        });
    });

    return {
        musics: [],
        socket,
        remoteStatus: { type: 'closed' },
        addMusic(music) {
            set(state => ({
                musics: [...state.musics, music],
            }));
        },
    };
});
