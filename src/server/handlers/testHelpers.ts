import type createMusicHandlers from "./music";
import type { Music } from "~/stores/musicStore";
import type { Server as IOServer } from "socket.io";
import type { YouTubeService } from "../youtubeService";
import type FileStore from "../musicPersistence";

// Minimal types mirroring production Deps but allowing tests to pass
export type TestDeps = Partial<{
  musicDB: Map<string, Music>;
  io: IOServer;
  youtubeService:
    | Partial<YouTubeService>
    | { getVideoDetails?: (...args: unknown[]) => Promise<unknown> };
  fileStore: Partial<FileStore>;
  isAdmin?: (requesterHash?: string) => boolean;
}>;

export function makeTestDeps(stubs: TestDeps) {
  // Provide sensible defaults for the full Deps shape used by createMusicHandlers
  const musicDB = stubs.musicDB ?? new Map<string, Music>();
  // Create a minimal io stub that satisfies the shape used in handlers (emit(...))
  const io = stubs.io ?? { emit: () => false };
  const youtubeService = (stubs.youtubeService ?? {
    getVideoDetails: () =>
      Promise.resolve({ ok: false, error: "not implemented" }),
  }) as Partial<YouTubeService>;
  const fileStore = stubs.fileStore ?? {
    add: () => undefined,
    remove: () => undefined,
  };
  const isAdmin = stubs.isAdmin;

  return {
    musicDB,
    io,
    youtubeService,
    fileStore,
    isAdmin,
  } as Parameters<typeof createMusicHandlers>[0];
}
