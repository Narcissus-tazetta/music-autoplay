import { describe, it, expect } from "vitest";
import { normalizeYoutubeMeta } from "../../src/server/utils/normalizeYoutubeMeta";

describe("normalizeYoutubeMeta", () => {
    it("normalizes a full VideoDetails-like object", () => {
        const id = "abc123DEF45";
        const meta = {
            title: "Title",
            channelTitle: "Ch",
            channelId: "ch123",
            duration: "00:01:23",
            isAgeRestricted: false,
        };
        const out = normalizeYoutubeMeta(id, meta);
        expect(out).not.toBeNull();
        expect(out && out.id).toBe(id);
        expect(out && out.title).toBe("Title");
    });

    it("extracts from raw item when top-level fields missing", () => {
        const id = "abc123DEF45";
        const meta = {
            raw: {
                snippet: { title: "S", channelTitle: "CT", channelId: "cid" },
                contentDetails: { duration: "PT1M2S", contentRating: { ytRating: "ytAgeRestricted" } },
            },
        };
        const out = normalizeYoutubeMeta(id, meta);
        expect(out).not.toBeNull();
        expect(out && out.title).toBe("S");
        expect(out && out.isAgeRestricted).toBe(true);
    });

    it("returns null when required fields cannot be resolved", () => {
        const id = "abc123DEF45";
        const meta = { something: "else" };
        const out = normalizeYoutubeMeta(id, meta);
        expect(out).toBeNull();
    });

    it("preserves ISO duration strings (PT...) and allows downstream handling", () => {
        const id = "abc123DEF45";
        const meta = { title: "T", channelTitle: "CT", channelId: "cid", duration: "PT2M5S" };
        const out = normalizeYoutubeMeta(id, meta);
        expect(out).not.toBeNull();
        expect(out && out.duration).toBe("PT2M5S");
    });
});
