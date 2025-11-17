import { describe, expect, test } from "bun:test";
import {
  channelUrl,
  extractYoutubeId,
  searchUrl,
  shortUrl,
  watchUrl,
} from "../../src/shared/utils/youtube";

describe("YouTube URL utilities", () => {
  describe("extractYoutubeId", () => {
    test("extracts ID from standard watch URL", () => {
      expect(
        extractYoutubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
      ).toBe("dQw4w9WgXcQ");
      expect(extractYoutubeId("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
        "dQw4w9WgXcQ",
      );
      expect(
        extractYoutubeId("https://m.youtube.com/watch?v=dQw4w9WgXcQ"),
      ).toBe("dQw4w9WgXcQ");
    });

    test("extracts ID from youtu.be short URL", () => {
      expect(extractYoutubeId("https://youtu.be/dQw4w9WgXcQ")).toBe(
        "dQw4w9WgXcQ",
      );
      expect(extractYoutubeId("https://youtu.be/dQw4w9WgXcQ?t=42")).toBe(
        "dQw4w9WgXcQ",
      );
    });

    test("extracts ID from embed URL", () => {
      expect(
        extractYoutubeId("https://www.youtube.com/embed/dQw4w9WgXcQ"),
      ).toBe("dQw4w9WgXcQ");
    });

    test("extracts ID with additional query parameters", () => {
      expect(
        extractYoutubeId(
          "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s&list=PLtest",
        ),
      ).toBe("dQw4w9WgXcQ");
    });

    test("returns null for invalid URLs", () => {
      expect(
        extractYoutubeId("https://example.com/watch?v=dQw4w9WgXcQ"),
      ).toBeNull();
      expect(extractYoutubeId("not a url")).toBeNull();
      expect(extractYoutubeId("")).toBeNull();
    });

    test("returns null for invalid video IDs", () => {
      expect(
        extractYoutubeId("https://www.youtube.com/watch?v=short"),
      ).toBeNull();
      expect(
        extractYoutubeId("https://www.youtube.com/watch?v=toolongid12345"),
      ).toBeNull();
      expect(
        extractYoutubeId("https://www.youtube.com/watch?v=invalid@id!"),
      ).toBeNull();
    });

    test("returns null for non-HTTPS/HTTP protocols", () => {
      expect(
        extractYoutubeId("ftp://www.youtube.com/watch?v=dQw4w9WgXcQ"),
      ).toBeNull();
      expect(extractYoutubeId("javascript:alert(1)")).toBeNull();
    });

    test("returns null for overly long URLs", () => {
      const longUrl =
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&" + "a".repeat(2048);
      expect(extractYoutubeId(longUrl)).toBeNull();
    });

    test("handles URLs with special characters", () => {
      expect(
        extractYoutubeId(
          "https://www.youtube.com/watch?v=dQw4w9WgXcQ#time=10s",
        ),
      ).toBe("dQw4w9WgXcQ");
    });

    test("sanitizes video IDs by removing invalid characters", () => {
      expect(
        extractYoutubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
      ).toBe("dQw4w9WgXcQ");
    });
  });

  describe("URL builder functions", () => {
    test("watchUrl builds correct URL", () => {
      expect(watchUrl("dQw4w9WgXcQ")).toBe(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      );
    });

    test("channelUrl builds correct URL", () => {
      expect(channelUrl("UCtest123")).toBe(
        "https://www.youtube.com/channel/UCtest123",
      );
    });

    test("shortUrl builds correct URL", () => {
      expect(shortUrl("dQw4w9WgXcQ")).toBe("https://youtu.be/dQw4w9WgXcQ");
    });

    test("searchUrl builds correct URL with encoding", () => {
      expect(searchUrl("test query")).toBe(
        "https://www.youtube.com/results?search_query=test%20query",
      );
      expect(searchUrl("テスト")).toBe(
        "https://www.youtube.com/results?search_query=%E3%83%86%E3%82%B9%E3%83%88",
      );
    });
  });
});
