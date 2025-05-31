import { create } from "zustand";
import { io, type Socket } from "socket.io-client";
import type { C2S, S2C } from "~/socket";

export interface Music {
    url: string;
    title: string;
    thumbnail: string;
}

interface MusicStore {
    musics: Music[];
    socket: Socket<S2C, C2S>;
    error?: string;
    addMusic(music: Music): void;
    deleteMusic(url: string): void;
    resetError(): void;
    setMusics(musics: Music[]): void;
}
export const useMusicStore = create<MusicStore>((set, get) => {
    const socket: Socket<S2C, C2S> = io({ autoConnect: false });
    socket
        .on("addMusic", (music) => {
            set({
                musics: [...get().musics, music],
            });
        })
        .on("initMusics", (musics) => {
            set({ musics });
        })
        .on("deleteMusic", (url) => {
            set({
                musics: get().musics.filter((m) => m.url !== url),
            });
        })
        .on("url_list", (musics) => {
            // 受信データを Music 型に変換してセット
            set({
                musics: musics.map((m: any) => ({
                    url: m.url,
                    title: m.title ?? "",
                    thumbnail: m.thumbnail ?? "",
                })),
            });
        })
        .connect();

    return {
        musics: [],
        socket,
        error: undefined,
        addMusic(music) {
            this.socket.emit("addMusic", music, (error) => {
                set({ error });
            });
        },
        deleteMusic(url) {
            set({ musics: get().musics.filter((m) => m.url !== url) });
            this.socket.emit("deleteMusic", url);
        },
        resetError() {
            set({ error: undefined });
        },
        setMusics(musics) {
            set({ musics });
        },
    };
});
