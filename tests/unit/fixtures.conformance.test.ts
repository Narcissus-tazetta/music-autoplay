import { describe, expect, it } from "vitest";
import { YouTubeMetaSchema } from "../../src/shared/schemas/music";

describe("fixtures conformance", () => {
  it("sample fixtures conform to YouTubeMetaSchema", () => {
    const samples = [
      {
        id: "zjEMFuj23B4",
        title: "t",
        channelTitle: "c",
        channelId: "ch",
        duration: "00:00:10",
        isAgeRestricted: false,
      },
      {
        id: "QXCvO3ajlnY",
        title: "t",
        channelTitle: "c",
        channelId: "ch",
        duration: "00:00:10",
        isAgeRestricted: false,
      },
    ];

    for (const s of samples) {
      const p = YouTubeMetaSchema.safeParse(s);
      expect(p.success).toBe(true);
    }
  });
});
