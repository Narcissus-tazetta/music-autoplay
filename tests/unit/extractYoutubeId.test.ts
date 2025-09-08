import { describe, it, expect } from "vitest";
import { extractYoutubeId } from "../../src/shared/libs/youtube";

describe("extractYoutubeId", () => {
    it("extracts id from youtu.be with query", () => {
        const url = "https://youtu.be/Ou-dGbXLZa8?si=qpPOHYua_5Rkg3w6";
        expect(extractYoutubeId(url)).toBe("Ou-dGbXLZa8");
    });

    it("extracts id from standard youtube watch url", () => {
        const url = "https://www.youtube.com/watch?v=BVvvUGP0MFw";
        expect(extractYoutubeId(url)).toBe("BVvvUGP0MFw");
    });

    it("returns null for invalid url", () => {
        expect(extractYoutubeId("https://example.com/foo")).toBeNull();
    });
});
