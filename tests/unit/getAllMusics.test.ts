import { describe, it, expect } from "vitest";
import type { Music } from "../../src/app/stores/musicStore";
import registerGetAllMusics from "../../src/server/handlers/getAllMusics";
import { makeSocket } from "./testDeps";

describe("getAllMusics handler", () => {
    it("returns empty array when DB empty", () => {
        const musicDB = new Map<string, Music>();
        const cb = (res: Music[]) => {
            expect(Array.isArray(res)).toBe(true);
            expect(res).toHaveLength(0);
        };
        const socketStub = makeSocket({
            on: (_ev: string, handler: (...args: unknown[]) => void) => {
                // Simulate invocation of the registered handler
                handler(cb);
            },
        });

        registerGetAllMusics(socketStub, musicDB);
    });

    it("returns values when present", () => {
        const musicDB = new Map<string, Music>();
        musicDB.set("a", {
            id: "a",
            title: "A",
            channelId: "c",
            channelName: "C",
            duration: "PT1M",
            requesterHash: undefined,
        });
        musicDB.set("b", {
            id: "b",
            title: "B",
            channelId: "c2",
            channelName: "C2",
            duration: "PT2M",
            requesterHash: undefined,
        });

        const cb = (res: Music[]) => {
            expect(Array.isArray(res)).toBe(true);
            expect(res).toHaveLength(2);
            const ids = res.map((m) => m.id).sort();
            expect(ids).toEqual(["a", "b"]);
        };

        const socketStub = makeSocket({
            on: (_ev: string, handler: (...args: unknown[]) => void) => {
                handler(cb);
            },
        });

        registerGetAllMusics(socketStub, musicDB);
    });
});
