import { describe, it, expect, vi } from "vitest";
import { YouTubeService } from "../../src/server/youtubeService";

describe("YouTubeService cache", () => {
    it("caches results and evicts after capacity", async () => {
        const svc = new YouTubeService("DUMMY");
        // directly manipulate cache for test
        // fill cache to maxEntries
        const max = 10; // use small number for test by overriding private props via any
        (svc as any).maxEntries = max;
        for (let i = 0; i < max; i++) {
            (svc as any).cache.set(`id${i}`, {
                value: { title: "t", channelTitle: "c", channelId: "ch", duration: "00:00:10", isAgeRestricted: false },
                expiresAt: Date.now() + 10000,
            });
        }

        // now add one more via internal set
        const details = {
            title: "new",
            channelTitle: "c",
            channelId: "ch",
            duration: "00:00:10",
            isAgeRestricted: false,
        };
        (svc as any).cache.set("newId", { value: details, expiresAt: Date.now() + 10000 });

        expect((svc as any).cache.size).toBe(max);
        expect((svc as any).cache.has("newId")).toBe(true);
    });
});
