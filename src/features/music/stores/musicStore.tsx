import { io, type Socket } from "socket.io-client";
import { create } from "zustand";
import type { C2S, S2C } from "../../../types/socket";
import { extractYouTubeId } from "../../../shared/utils/youtube";
import type { Music } from "../../../shared/types/music";

interface MusicStore {
  musics: Music[];
  socket: Socket<S2C, C2S> | null;
  error?: string;
  isConnected: boolean;
  initializeSocket(): void;
  disconnectSocket(): void;
  addMusic(music: Music): void;
  deleteMusic(url: string): void;
  deleteMusicById?(id: string): void;
  resetError(): void;
}
export const useMusicStore = create<MusicStore>((set, get) => {
  return {
    musics: [],
    socket: null,
    error: undefined,
    isConnected: false,

    initializeSocket() {
      if (typeof window === "undefined") return;

      const store = get();
      if (store.socket) return;

      const socket: Socket<S2C, C2S> = io({ autoConnect: false });

      socket
        .on("addMusic", (music: Music) => {
          const id = extractYouTubeId(music.url) || "";
          set((state) => ({
            musics: [...state.musics, { ...music, id }],
          }));
        })
        .on("url_list", (musics: Music[]) => {
          // map incoming musics to include extracted id
          const withIds = musics.map((m) => ({
            ...m,
            id: extractYouTubeId(m.url) || "",
          }));
          set({ musics: withIds });
        })
        .on("deleteMusic", (url: string) => {
          const targetId = extractYouTubeId(url);
          set((state) => ({
            musics: state.musics.filter((m) => {
              // prefer id if present, otherwise fall back to url
              if (m.id) return m.id !== targetId;
              return m.url !== url;
            }),
          }));
        })
        .on("initMusics", (musics: Music[]) => {
          const withIds = musics.map((m) => ({
            ...m,
            id: extractYouTubeId(m.url) || "",
          }));
          set({ musics: withIds });
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

      if (socket) socket.emit("deleteMusic", url);
    },

    // Delete by YouTube ID: resolve to URL and emit delete request to server
    deleteMusicById(id: string) {
      const { socket } = get();
      const state = get();
      const target = state.musics.find((m) => m.id === id);
      if (!target) return;
      const url = target.url;

      set((s) => ({
        musics: s.musics.filter((m) => m.id !== id),
      }));

      if (socket) socket.emit("deleteMusic", url);
    },

    resetError() {
      set({ error: undefined });
    },
  };
});
