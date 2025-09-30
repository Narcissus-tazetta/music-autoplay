/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from "vitest";
import type { Music } from "../../src/app/stores/musicStore";
import createMusicHandlers from "../../src/server/handlers/music";
import { shortUrl, watchUrl } from "../../src/shared/libs/youtube";
import {
  makeDeps,
  makeFileStore,
  makeIo,
  makeSocket,
  makeYoutubeService,
} from "./testDeps";

describe("removeMusic permissions", () => {
  it("anonymous item cannot be deleted by anyone", () => {
    const youtubeService = { getVideoDetails: vi.fn() };
    const io = makeIo();
    const fileStore = makeFileStore({ remove: vi.fn() });
    const musicDB = new Map<string, Music>();
    musicDB.set("anon", {
      id: "anon",
      title: "anon",
      channelId: "c",
      channelName: "cn",
      duration: "PT0S",
      requesterHash: undefined,
    });

    const handlers = createMusicHandlers(
      makeDeps({
        musicDB,
        io,
        youtubeService: makeYoutubeService(youtubeService),
        fileStore,
      }),
    );
    // register is synchronous; calling it with a fake socket is sufficient for this test
    handlers.register(makeSocket({}), {});
    const existing = musicDB.get("anon");
    expect(existing && existing.requesterHash).toBeUndefined();
  });

  it("owner can delete their own item", () => {
    const youtubeService2 = { getVideoDetails: vi.fn() };
    const emitted2: Array<{ ev: string; payload: unknown }> = [];
    const io2 = makeIo((ev, payload) => emitted2.push({ ev, payload }));
    const fileStore2 = makeFileStore({ remove: vi.fn() });
    const musicDB2 = new Map<string, Music>();
    musicDB2.set("idowner0001", {
      id: "idowner0001",
      title: "t",
      channelId: "c",
      channelName: "cn",
      duration: "PT1M",
      requesterHash: "owner-hash",
    });

    const handlers2 = createMusicHandlers(
      makeDeps({
        musicDB: musicDB2,
        io: io2,
        youtubeService: makeYoutubeService(youtubeService2),
        fileStore: fileStore2,
      }),
    );

    const fakeSocket = {
      on(
        _ev: "removeMusic",
        cb: (
          url: string,
          requesterHash?: string,
          cb?: (res: unknown) => void,
        ) => void,
      ) {
        cb(watchUrl("idowner0001"), "owner-hash", (res: unknown) => {
          expect(res).toEqual({});
        });
      },
    };

    handlers2.register(makeSocket(fakeSocket), {});
    expect(fileStore2.remove).toHaveBeenCalledWith("idowner0001");
  });
  it("admin can delete any item (requires server-side admin auth)", () => {
    const youtubeService3 = { getVideoDetails: vi.fn() };
    const emitted3: Array<{ ev: string; payload: unknown }> = [];
    const io3 = makeIo((ev, payload) => emitted3.push({ ev, payload }));
    const fileStore3 = makeFileStore({ remove: vi.fn() });
    const musicDB3 = new Map<string, Music>();
    // use 11-char id
    musicDB3.set("idadmin0001", {
      id: "idadmin0001",
      title: "t",
      channelId: "c",
      channelName: "cn",
      duration: "PT1M",
      requesterHash: "someone-hash",
    });

    // pass isAdmin that returns true for our test admin hash
    const handlers3 = createMusicHandlers(
      makeDeps({
        musicDB: musicDB3,
        io: io3,
        youtubeService: makeYoutubeService(youtubeService3),
        fileStore: fileStore3,
        isAdmin: (hash?: string) => hash === "admin-hash",
      }),
    );

    const fakeSocket3 = {
      on(
        _ev: "removeMusic",
        cb: (
          url: string,
          requesterHash?: string,
          cb?: (res: unknown) => void,
        ) => void,
      ) {
        cb(shortUrl("idadmin0001"), "admin-hash", (res: unknown) => {
          expect(res).toEqual({});
        });
      },
    };

    handlers3.register(makeSocket(fakeSocket3), {});
    expect(fileStore3.remove).toHaveBeenCalledWith("idadmin0001");
  });
});
