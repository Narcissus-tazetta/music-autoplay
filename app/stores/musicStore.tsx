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
  socket: Socket<S2C, C2S> | null;
  error?: string;
  isConnected: boolean;
  initializeSocket(): void;
  disconnectSocket(): void;
  addMusic(music: Music): void;
  deleteMusic(url: string): void;
  resetError(): void;
}
export const useMusicStore = create<MusicStore>((set, get) => {
  return {
    musics: [],
    socket: null,
    error: undefined,
    isConnected: false,

    initializeSocket() {
      // SSR対応 - クライアントサイドでのみ実行
      if (typeof window === "undefined") return;

      const store = get();
      if (store.socket) return;

      const socket: Socket<S2C, C2S> = io({ autoConnect: false });

      socket
        .on("addMusic", (music) => {
          set((state) => ({
            musics: [...state.musics, music],
          }));
        })
        .on("url_list", (musics) => {
          set({ musics });
        })
        .on("deleteMusic", (url) => {
          set((state) => ({
            musics: state.musics.filter((m) => m.url !== url),
          }));
        })
        .on("initMusics", (musics) => {
          set({ musics });
        })
        .on("connect", () => {
          set({ isConnected: true });
        })
        .on("disconnect", () => {
          set({ isConnected: false });
        });

      socket.connect();
      set({ socket });
    },

    disconnectSocket() {
      const { socket } = get();
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        set({ socket: null, isConnected: false });
      }
    },

    addMusic(music: Music) {
      const { socket } = get();
      if (!socket) {
        set({ error: "Socket not connected" });
        return;
      }

      socket.emit("addMusic", music, (error?: string) => {
        set({ error });
      });
    },

    deleteMusic(url: string) {
      const { socket } = get();
      set((state) => ({
        musics: state.musics.filter((m) => m.url !== url),
      }));

      if (socket) {
        socket.emit("deleteMusic", url);
      }
    },

    resetError() {
      set({ error: undefined });
    },
  };
});
