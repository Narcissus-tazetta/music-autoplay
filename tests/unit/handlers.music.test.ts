import { describe, it, expect, vi } from "vitest";
import createMusicHandlers from "../../src/server/handlers/music";

describe("music handlers", () => {
  it("addMusic success path calls youtubeService and fileStore and emits", async () => {
    const youtubeService = {
      getVideoDetails: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          title: "t",
          channelTitle: "c",
          channelId: "ch",
          duration: "00:00:10",
          isAgeRestricted: false,
        },
      }),
    } as any;

    const added: any[] = [];
    const io = {
      emit: (ev: string, payload: any) => added.push({ ev, payload }),
    } as any;

    const fileStore = { add: vi.fn() } as any;

    const musicDB = new Map<string, any>();

    const handlers = createMusicHandlers({
      musicDB,
      io,
      youtubeService,
      fileStore,
    });

    const res = await handlers.addMusic("https://youtu.be/dQw4w9WgXcQ", "reqh");
    expect(res).toEqual({});
    expect(musicDB.size).toBe(1);
    expect(fileStore.add).toHaveBeenCalled();
    expect(added).toHaveLength(1);
  });
});
