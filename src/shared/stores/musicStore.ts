import type { C2S, S2C } from "@/shared/types/socket";
import type { Socket } from "socket.io-client";
import { create } from "zustand";
import { getSocket } from "../../app/utils/socketClient";

export type RemoteStatus =
  | {
      type: "playing";
      musicTitle: string;
      musicId?: string;
      isAdvertisement?: boolean;
      adTimestamp?: number;
      isExternalVideo?: boolean;
      videoId?: string;
    }
  | {
      type: "paused";
      musicTitle?: string;
      musicId?: string;
      isTransitioning?: boolean;
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
  requesterName?: string;
  requestedAt?: string;
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
        if (import.meta.env.DEV)
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
        if (import.meta.env.DEV)
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
              if (Array.isArray(musics)) set({ musics });
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

      const attemptGetRemoteStatus = (s: Socket<S2C, C2S>, maxAttempts = 3) => {
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
            s.emit("getRemoteStatus", (status: RemoteStatus | undefined) => {
              if (called) return;
              called = true;
              clearTimeout(timeout);
              if (import.meta.env.DEV)
                console.info("[musicStore] getRemoteStatus response:", status);
              if (status && typeof status === "object" && "type" in status)
                set({ remoteStatus: status });
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
          if (import.meta.env.DEV) console.info("Socket connected");
          try {
            attemptGetAllMusics(socket as Socket<S2C, C2S>);
            attemptGetRemoteStatus(socket as Socket<S2C, C2S>);
          } catch (err: unknown) {
            if (import.meta.env.DEV)
              console.debug("Initial data fetch failed", err);
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
          if (import.meta.env.DEV)
            console.info("[musicStore] remoteStatusUpdated event:", state);
          set({
            remoteStatus: state,
          });
        });

      const socketAny = socket as unknown;
      if (
        typeof socketAny === "object" &&
        socketAny !== null &&
        "on" in socketAny
      ) {
        const s = socketAny as {
          on: (
            event: string,
            listener: (...args: unknown[]) => void,
          ) => unknown;
        };
        s.on("reconnect_attempt", () => {
          try {
            attemptGetAllMusics(socket as Socket<S2C, C2S>);
            attemptGetRemoteStatus(socket as Socket<S2C, C2S>);
          } catch {
            if (import.meta.env.DEV)
              console.debug("reconnect_attempt data fetch failed");
          }
        });
        s.on("reconnect", () => {
          try {
            attemptGetAllMusics(socket as Socket<S2C, C2S>);
            attemptGetRemoteStatus(socket as Socket<S2C, C2S>);
          } catch {
            if (import.meta.env.DEV)
              console.debug("reconnect data fetch failed");
          }
        });
      }

      socket.connect();

      set({ socket });
    },
  };
});
