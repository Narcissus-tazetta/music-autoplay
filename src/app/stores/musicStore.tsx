import { io, type Socket } from "socket.io-client";
import { create } from "zustand";
import type { Music } from "../../shared/types/music";

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

// use shared Music type

interface MusicStore {
  musics: Music[];
  socket: Socket | null;
  remoteStatus: RemoteStatus;
  error?: string;

  addMusic(music: Music): void;
  resetError(): void;
}
export const useMusicStore = create<MusicStore>((set) => {
  const socket = io({ autoConnect: false });
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

  return {
    musics: [],
    socket,
    remoteStatus: { type: "closed" },
    error: undefined,
    addMusic(music) {
      set((state) => ({
        musics: [...state.musics, music],
      }));
    },
    resetError() {
      set({ error: undefined });
    },
  };
});
