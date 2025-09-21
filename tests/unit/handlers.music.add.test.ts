/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi } from "vitest";
import createMusicHandlers from "../../src/server/handlers/music";
import type { Music } from "../../src/app/stores/musicStore";
import { makeDeps, makeIo, makeYoutubeService, makeFileStore, getFormErrors } from "./testDeps";

type VideoOk = {
    ok: true;
    value: {
        title: string;
        channelTitle: string;
        channelId: string;
        duration: string;
        isAgeRestricted: boolean;
    };
};

describe("createMusicHandlers.addMusic", () => {
    it("normal path: adds, emits, persists", async () => {
        const youtubeService: {
            getVideoDetails: (id: string) => Promise<VideoOk>;
        } = {
            getVideoDetails: (id: string) => {
                void id;
                return Promise.resolve({
                    ok: true,
                    value: {
                        id: "zjEMFuj23B4",
                        title: "t",
                        channelTitle: "c",
                        channelId: "ch",
                        duration: "00:00:10",
                        isAgeRestricted: false,
                    },
                });
            },
        };

        const emitted: Array<{ ev: string; payload: unknown }> = [];
        const io = makeIo((ev, payload) => {
            void emitted.push({ ev, payload });
        });

        const fileStore = makeFileStore({ add: vi.fn() });

        const musicDB = new Map<string, Music>();
        const handlers = createMusicHandlers(
            makeDeps({
                musicDB,
                io,
                youtubeService: makeYoutubeService(youtubeService),
                fileStore,
            })
        );

        const res = await handlers.addMusic("https://youtu.be/zjEMFuj23B4", "reqh");
        expect(res).toEqual({});
        expect(musicDB.size).toBe(1);
        expect(fileStore.add).toHaveBeenCalled();
        expect(emitted).toHaveLength(1);
    });

    it("duplicate returns formErrors", async () => {
        const youtubeService: {
            getVideoDetails: (id: string) => Promise<unknown>;
        } = {
            // return a minimal, valid YouTube metadata object per shared schema
            getVideoDetails: () =>
                Promise.resolve({
                    ok: true,
                    value: {
                        id: "zjEMFuj23B4",
                        title: "t",
                        channelTitle: "c",
                        channelId: "ch",
                        duration: "PT0S",
                        isAgeRestricted: false,
                    },
                } as unknown),
        };
        const io = makeIo();
        const fileStore = makeFileStore();
        const musicDB = new Map<string, Music>();
        musicDB.set("zjEMFuj23B4", {
            id: "zjEMFuj23B4",
            title: "",
            channelName: "",
            channelId: "",
            duration: "",
        });
        const handlers = createMusicHandlers(
            makeDeps({
                musicDB,
                io,
                youtubeService: makeYoutubeService(youtubeService),
                fileStore,
            })
        );

        const res = await handlers.addMusic("https://youtu.be/zjEMFuj23B4", "reqh");
        expect(getFormErrors(res)).toBeTruthy();
    });

    it("invalid url returns error", async () => {
        const youtubeService: {
            getVideoDetails: (id: string) => Promise<unknown>;
        } = {
            // return a minimal, valid YouTube metadata object per shared schema
            getVideoDetails: () =>
                Promise.resolve({
                    ok: true,
                    value: {
                        id: "zjEMFuj23B4",
                        title: "t",
                        channelTitle: "c",
                        channelId: "ch",
                        duration: "PT0S",
                        isAgeRestricted: false,
                    },
                } as unknown),
        };
        const io = makeIo();
        const fileStore = makeFileStore();
        const musicDB = new Map<string, Music>();
        const handlers = createMusicHandlers(
            makeDeps({
                musicDB,
                io,
                youtubeService: makeYoutubeService(youtubeService),
                fileStore,
            })
        );

        const res = await handlers.addMusic("not-a-url", "reqh");
        expect(getFormErrors(res)).toBeTruthy();
    });

    it("age restricted is rejected", async () => {
        const youtubeService: {
            getVideoDetails: (id: string) => Promise<unknown>;
        } = {
            // age-restricted case — still provide required fields but mark restricted
            getVideoDetails: () =>
                Promise.resolve({
                    ok: true,
                    value: {
                        id: "zjEMFuj23B4",
                        title: "t",
                        channelTitle: "c",
                        channelId: "ch",
                        duration: "PT0S",
                        isAgeRestricted: true,
                    },
                }),
        };
        const io = makeIo();
        const fileStore = makeFileStore();
        const musicDB = new Map<string, Music>();
        const handlers = createMusicHandlers(
            makeDeps({
                musicDB,
                io,
                youtubeService: makeYoutubeService(youtubeService),
                fileStore,
            })
        );

        const res = await handlers.addMusic("https://youtu.be/zjEMFuj23B4", "reqh");
        expect(getFormErrors(res)).toBeTruthy();
    });

    it("youtubeService error propagates message", async () => {
        const youtubeService: {
            getVideoDetails: (id: string) => Promise<{ ok: false; error: string }>;
        } = {
            getVideoDetails: () => Promise.resolve({ ok: false, error: "not found" }),
        };
        const ioEmit = vi.fn();
        // Wrap the mock in an arrow function to avoid unbound-method lint rule
        // and discard the mock return value so we don't return `any`.
        const io = makeIo((ev, payload) => {
            void ioEmit(ev, payload);
        });
        const fileStore = makeFileStore({ add: vi.fn() });
        const musicDB = new Map<string, Music>();
        const handlers = createMusicHandlers(
            makeDeps({
                musicDB,
                io,
                youtubeService: makeYoutubeService(youtubeService),
                fileStore,
            })
        );

        const res = await handlers.addMusic("https://youtu.be/COll6PdtI5w", "reqh");
        const formErrors = getFormErrors(res);
        expect(formErrors).toBeTruthy();
        expect(formErrors && formErrors[0]).toContain("not found");
    });

    it("fileStore returns promise and is awaited", async () => {
        const youtubeService: {
            getVideoDetails: (id: string) => Promise<VideoOk | { ok: false; error: string }>;
        } = {
            getVideoDetails: (id: string) => {
                void id;
                return Promise.resolve({
                    ok: true,
                    value: {
                        id: "QXCvO3ajlnY",
                        title: "t",
                        channelTitle: "c",
                        channelId: "ch",
                        duration: "00:00:10",
                        isAgeRestricted: false,
                    },
                });
            },
        };
        let persisted = false;
        const fileStore: { add: (m: Music) => void | Promise<void> } = {
            add: (m: Music) => {
                void m;
                return new Promise<void>((res) =>
                    setTimeout(() => {
                        persisted = true;
                        res();
                    }, 10)
                );
            },
        };
        const emitted: Array<{ ev: string; payload: unknown }> = [];
        const io = makeIo((ev, payload) => {
            void emitted.push({ ev, payload });
        });
        const musicDB = new Map<string, Music>();
        const handlers = createMusicHandlers(
            makeDeps({
                musicDB,
                io,
                youtubeService: makeYoutubeService(youtubeService),
                fileStore: makeFileStore(fileStore),
            })
        );

        const res = await handlers.addMusic("https://youtu.be/QXCvO3ajlnY", "reqh");
        expect(res).toEqual({});
        expect(persisted).toBe(true);
    });
});
