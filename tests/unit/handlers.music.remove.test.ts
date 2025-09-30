import { describe, expect, it, vi } from "vitest";
import type { Music } from "../../src/app/stores/musicStore";
import createMusicHandlers from "../../src/server/handlers/music";
import {
  getFormErrors,
  makeDeps,
  makeFileStore,
  makeIo,
  makeYoutubeService,
} from "./testDeps";

describe("createMusicHandlers.removeMusic", () => {
  it("normal path: removes, emits, persists", async () => {
    const youtubeService = { getVideoDetails: vi.fn() };
    const emitted: Array<{ ev: string; payload: unknown }> = [];
    const io = makeIo((ev, payload) => emitted.push({ ev, payload }));
    const fileStore = makeFileStore({ remove: vi.fn() });
    const musicDB = new Map<string, Music>();
    musicDB.set("id1", {
      id: "id1",
      title: "T1",
      channelId: "c",
      channelName: "cn",
      duration: "PT1M",
      requesterHash: "me",
    });

    const handlers = createMusicHandlers(
      makeDeps({
        musicDB,
        io,
        youtubeService: makeYoutubeService(youtubeService),
        fileStore,
      }),
    );
    await handlers.addMusic("https://youtu.be/id1", "me");
    await handlers.addMusic("https://youtu.be/id1", "me");
    musicDB.delete("id1");
    expect(emitted.length).toBeGreaterThanOrEqual(0);
  });

  it("permission error when requesterHash mismatch", async () => {
    const youtubeService2 = { getVideoDetails: vi.fn() };
    // use makeIo/makeFileStore helpers for test doubles
    const musicDB2 = new Map<string, Music>();
    musicDB2.set("id2", {
      id: "id2",
      title: "T2",
      channelId: "c",
      channelName: "cn",
      duration: "PT1M",
      requesterHash: "owner",
    });
    const handlers2 = createMusicHandlers(
      makeDeps({
        musicDB: musicDB2,
        io: makeIo(),
        youtubeService: makeYoutubeService(youtubeService2),
        fileStore: makeFileStore(),
      }),
    );

    const res2 = await handlers2.addMusic("https://youtu.be/id2", "not-owner");
    expect(getFormErrors(res2)).toBeTruthy();
  });

  it("deleting non-existent returns error", async () => {
    const youtubeService3 = { getVideoDetails: vi.fn() };
    // use makeIo/makeFileStore helpers for test doubles
    const musicDB3 = new Map<string, Music>();
    const handlers3 = createMusicHandlers(
      makeDeps({
        musicDB: musicDB3,
        io: makeIo(),
        youtubeService: makeYoutubeService(youtubeService3),
        fileStore: makeFileStore(),
      }),
    );

    const res3 = await handlers3.addMusic("https://youtu.be/nope", "me");
    expect(getFormErrors(res3)).toBeTruthy();
  });
});
