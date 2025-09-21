import { describe, it, expect } from "vitest";
import { normalizeYoutubeMeta } from "@/server/utils/normalizeYoutubeMeta";

describe("normalizeYoutubeMeta - extended cases", () => {
    it("parses ISO8601 duration PT1H2M3S into HH:MM:SS", () => {
        const meta = {
            raw: {
                contentDetails: { duration: "PT1H2M3S" },
                snippet: { title: "T", channelTitle: "C", channelId: "cid" },
            },
        };
        const r = normalizeYoutubeMeta("id1", meta);
        expect(r).not.toBeNull();
        expect(r?.duration).toBe("01:02:03");
    });

    it("parses numeric seconds into HH:MM:SS", () => {
        const meta = { duration: 125, title: "T", channelTitle: "C", channelId: "cid" };
        const r = normalizeYoutubeMeta("id2", meta);
        expect(r).not.toBeNull();
        expect(r?.duration).toBe("00:02:05");
    });

    it("parses MM:SS into HH:MM:SS", () => {
        const meta = { duration: "2:05", title: "T", channelTitle: "C", channelId: "cid" };
        const r = normalizeYoutubeMeta("id3", meta);
        expect(r).not.toBeNull();
        expect(r?.duration).toBe("00:02:05");
    });

    it("uses localized.title when snippet.title missing", () => {
        const meta = { raw: { snippet: { localized: { title: "Localized" }, channelTitle: "C", channelId: "cid" } } };
        const r = normalizeYoutubeMeta("id4", meta);
        expect(r).not.toBeNull();
        expect(r?.title).toBe("Localized");
    });

    it("detects age restriction from contentRating variants", () => {
        const metaA = {
            raw: {
                contentDetails: { contentRating: { ytRating: "ytAgeRestricted" } },
                snippet: { title: "T", channelTitle: "C", channelId: "cid" },
            },
        };
        const metaB = {
            raw: {
                contentDetails: { contentRating: { ageRestricted: true } },
                snippet: { title: "T", channelTitle: "C", channelId: "cid" },
            },
        };
        const rA = normalizeYoutubeMeta("idA", metaA);
        const rB = normalizeYoutubeMeta("idB", metaB);
        expect(rA?.isAgeRestricted).toBe(true);
        expect(rB?.isAgeRestricted).toBe(true);
    });
});
