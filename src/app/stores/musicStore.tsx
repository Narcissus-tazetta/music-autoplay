import type { C2S, S2C } from "@/shared/types/socket";
import { create } from "zustand";
import { getSocket } from "../lib/socketClient";
import type { Socket } from "socket.io-client";

export type RemoteStatus =
    | {
          type: "playing";
          musicTitle: string;
      }
    | {
          type: "paused";
      }
    | {
          type: "closed";
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
    socket?: Socket<S2C, C2S> | null;
    remoteStatus: RemoteStatus;

    addMusic(music: Music): void;
    connectSocket(): void;
}

export const useMusicStore = create<MusicStore>((set) => {
    let socket: Socket<S2C, C2S> | null = null;

    return {
        musics: [],
        socket: null,
        remoteStatus: { type: "closed" },
        addMusic(music) {
            set((state) => ({
                musics: [...state.musics, music],
            }));
        },
        connectSocket() {
            if (socket) return;
            socket = getSocket();
            socket
                .on("connect", () => {
                    console.info("Socket connected");
                })
                .on("musicAdded", (music: Music) => {
                    set((state) => ({
                        musics: [...state.musics, music],
                    }));
                })
                .on("musicRemoved", (musicId: string) => {
                    set((state) => ({
                        musics: state.musics.filter((music) => music.id !== musicId),
                    }));
                })
                .on("remoteStatusUpdated", (state: RemoteStatus) => {
                    set({
                        remoteStatus: state,
                    });
                })
                .connect();

            if (socket) {
                socket.emit("getAllMusics", (musics: Music[]) => {
                    set({
                        musics,
                    });
                });
                socket.emit("getRemoteStatus", (state: RemoteStatus) => {
                    set({
                        remoteStatus: state,
                    });
                });
            }

            set({ socket });
        },
    };
});
