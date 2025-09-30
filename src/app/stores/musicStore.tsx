import type { C2S, S2C } from "@/shared/types/socket";
import type { Socket } from "socket.io-client";
import { create } from "zustand";
import { getSocket } from "../lib/socketClient";

export type RemoteStatus =
  | {
      type: "playing";
      musicTitle: string;
      musicId?: string;
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
  remoteStatus: RemoteStatus | null;
  error?: string;
  resetError?: () => void;
  setMusics?: (musics: Music[]) => void;
  hydrateFromLocalStorage?: () => void;

  addMusic(music: Music): void;
  connectSocket(): void;
}

export const useMusicStore = create<MusicStore>((set) => {
  let socket: Socket<S2C, C2S> | null = null;
  const STORAGE_KEY = "music-auto-play:musics:v1";

  return {
    musics: [],
    error: undefined,
    resetError: () => {
      set({ error: undefined });
    },
    socket: null,
    remoteStatus: null,
    addMusic(music) {
      set((state) => ({
        musics: [...state.musics, music],
      }));
    },
    setMusics(musics: Music[]) {
      try {
        if (typeof window !== "undefined")
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(musics));
      } catch (err: unknown) {
        console.debug("musicStore setMusics localStorage failed", err);
      }
      set({ musics });
    },
    hydrateFromLocalStorage() {
      try {
        const storage: Storage | undefined =
          typeof window !== "undefined"
            ? window.localStorage
            : (globalThis as { localStorage?: Storage }).localStorage;
        if (!storage) return;
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return;
        set((state) => {
          if (state.musics.length > 0) return {} as Partial<MusicStore>;
          return { musics: parsed as Music[] } as Partial<MusicStore>;
        });
      } catch (err: unknown) {
        console.debug("musicStore hydrateFromLocalStorage failed", err);
      }
    },
    connectSocket() {
      if (socket) return;
      socket = getSocket();
      const attemptGetAllMusics = (s: Socket<S2C, C2S>, maxAttempts = 3) => {
        let attempt = 0;
        const tryOnce = () => {
          attempt++;
          let called = false;
          const timeout = setTimeout(() => {
            if (called) return;
            called = true;
            if (attempt < maxAttempts) {
              const backoff = 500 * Math.pow(2, attempt - 1);
              setTimeout(tryOnce, backoff);
            }
          }, 2000);

          try {
            s.emit("getAllMusics", (musics: Music[] | undefined) => {
              if (called) return;
              called = true;
              clearTimeout(timeout);
              if (Array.isArray(musics) && musics.length > 0) set({ musics });
            });
          } catch {
            if (attempt < maxAttempts) {
              const backoff = 500 * Math.pow(2, attempt - 1);
              setTimeout(tryOnce, backoff);
            }
          }
        };

        tryOnce();
      };

      socket
        .on("connect", () => {
          console.info("Socket connected");
          try {
            attemptGetAllMusics(socket as Socket<S2C, C2S>);
          } catch (err: unknown) {
            console.debug("attemptGetAllMusics failed", err);
          }
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .on("reconnect_attempt" as any, () => {
          try {
            attemptGetAllMusics(socket as Socket<S2C, C2S>);
          } catch {
            console.debug("reconnect_attempt attemptGetAllMusics failed");
          }
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

      set({ socket });
    },
  };
});
