/* eslint-disable @typescript-eslint/unbound-method */
/* Test suite uses unbound-method patterns in mocks; other rules are not broadly disabled. */
import { describe, expect, it, vi } from "vitest";
import type { Music } from "../../src/app/stores/musicStore";
import createMusicHandlers from "../../src/server/handlers/music";
import {
  makeDeps,
  makeFileStore,
  makeIo,
  makeYoutubeService,
} from "./testDeps";

describe("music handlers", () => {
  it("addMusic success path calls youtubeService and fileStore and emits", async () => {
    const youtubeService = {
      getVideoDetails: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          id: "zjEMFuj23B4",
          title: "t",
          channelTitle: "c",
          channelId: "ch",
          duration: "PT0M10S",
          isAgeRestricted: false,
        },
      }),
    };

    const added: Array<{ ev: string; payload: unknown }> = [];
    const io = makeIo((ev, payload) => {
      added.push({ ev, payload });
    });

    const fileStore = makeFileStore({ add: vi.fn() });

    const musicDB = new Map<string, Music>();

    const handlers = createMusicHandlers(
      makeDeps({
        musicDB,
        io,
        youtubeService: makeYoutubeService(youtubeService),
        fileStore,
      }),
    );

    const res = await handlers.addMusic("https://youtu.be/zjEMFuj23B4", "reqh");
    expect(res).toEqual({});
    expect(musicDB.size).toBe(1);
    expect(fileStore.add).toHaveBeenCalled();
    expect(added).toHaveLength(1);
  });
});
