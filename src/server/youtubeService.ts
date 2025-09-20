import { google } from "googleapis";
import convertISO8601Duration from "convert-iso8601-duration";
import { SERVER_ENV } from "~/env.server";
import type { Result } from "@/shared/utils/result";
import { ok, err } from "@/shared/utils/result";
import logger from "./logger";

export type VideoDetails = {
  title: string;
  channelTitle: string;
  channelId: string;
  duration: string;
  isAgeRestricted: boolean;
  raw?: unknown;
};

class EvictingMap<K, V> extends Map<K, V> {
  private getMaxEntries: () => number;

  constructor(maxEntriesOrGetter: number | (() => number)) {
    super();
    this.getMaxEntries =
      typeof maxEntriesOrGetter === "function"
        ? maxEntriesOrGetter
        : () => maxEntriesOrGetter;
  }

  set(key: K, value: V): this {
    const max = this.getMaxEntries();
    if (this.size >= max) {
      const oldestKey = this.keys().next().value;
      if (oldestKey !== undefined) super.delete(oldestKey);
    }
    return super.set(key, value);
  }
}

export class YouTubeService {
  youtube: ReturnType<typeof google.youtube>;
  private cache: EvictingMap<
    string,
    { value: VideoDetails; expiresAt: number }
  > = new EvictingMap(() => this.maxEntries);
  private defaultTtl = 1000 * 60 * 60 * 24 * 7; // 7日
  private maxEntries = 500;

  constructor(apiKey?: string) {
    const key = apiKey ?? SERVER_ENV.YOUTUBE_API_KEY;
    this.youtube = google.youtube({ version: "v3", auth: key });
    setInterval(
      () => {
        this.cleanupExpired();
      },
      1000 * 60 * 60,
    );
  }

  private cleanupExpired() {
    const now = Date.now();
    for (const [k, v] of this.cache.entries()) {
      if (v.expiresAt <= now) this.cache.delete(k);
    }
  }

  async getVideoDetails(
    id: string,
    retries = 1,
    timeoutMs = 5000,
    ttlMs?: number,
  ): Promise<Result<VideoDetails, string>> {
    const ttl = ttlMs ?? this.defaultTtl;
    const now = Date.now();
    const cached = this.cache.get(id);
    if (cached && cached.expiresAt > now) {
      return ok(cached.value);
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
          controller.abort();
        }, timeoutMs);
        const resAny = await this.youtube.videos.list(
          { part: ["snippet", "contentDetails"], id: [id] },
          { signal: controller.signal as unknown },
        );
        clearTimeout(timer);

        const resObj = resAny as { data?: unknown } | undefined;
        const data = resObj?.data;
        if (!data || typeof data !== "object")
          return err("動画が見つかりませんでした。");
        const items = (data as { items?: unknown }).items;
        if (!Array.isArray(items) || items.length === 0)
          return err("動画が見つかりませんでした。");

        const item = items[0] as unknown;
        if (!item || typeof item !== "object")
          return err("動画が見つかりませんでした。");

        const snippet = (item as { snippet?: unknown }).snippet as
          | Record<string, unknown>
          | undefined;
        const contentDetails = (item as { contentDetails?: unknown })
          .contentDetails as Record<string, unknown> | undefined;

        const title =
          snippet && typeof snippet.title === "string"
            ? snippet.title
            : undefined;
        const channelTitle =
          snippet && typeof snippet.channelTitle === "string"
            ? snippet.channelTitle
            : undefined;
        const channelId =
          snippet && typeof snippet.channelId === "string"
            ? snippet.channelId
            : undefined;
        const durationRaw =
          contentDetails && typeof contentDetails.duration === "string"
            ? contentDetails.duration
            : undefined;

        const contentRating = contentDetails && contentDetails.contentRating;
        const isAgeRestricted = !!(
          contentRating &&
          typeof contentRating === "object" &&
          (contentRating as Record<string, unknown>).ytRating ===
            "ytAgeRestricted"
        );

        if (!title || !channelTitle || !channelId || !durationRaw) {
          return err("動画の情報が取得できませんでした。");
        }

        const duration = convertISO8601Duration(durationRaw);
        const durationSecs = duration % 60;
        const durationMins = Math.floor((duration / 60) % 60);
        const durationHours = Math.floor(duration / 3600);

        const durationStr = `${durationHours.toString().padStart(2, "0")}:${durationMins.toString().padStart(2, "0")}:${durationSecs.toString().padStart(2, "0")}`;

        const details: VideoDetails = {
          title,
          channelTitle,
          channelId,
          duration: durationStr,
          isAgeRestricted,
          raw: item,
        };
        if (this.cache.size >= this.maxEntries) {
          const oldestKey = this.cache.keys().next().value;
          if (oldestKey) this.cache.delete(oldestKey);
        }
        this.cache.set(id, { value: details, expiresAt: Date.now() + ttl });
        return ok(details);
      } catch (e: unknown) {
        logger.warn("YouTubeService getVideoDetails attempt failed", {
          id,
          attempt,
          error: e,
        });
        if (attempt === retries) return err(String(e));
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
    return err("未知のエラー");
  }
}
