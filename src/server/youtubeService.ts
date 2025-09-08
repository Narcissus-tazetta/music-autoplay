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
      const oldestKey = this.keys().next().value as K | undefined;
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
    setInterval(() => this.cleanupExpired(), 1000 * 60 * 60);
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
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const res = await this.youtube.videos.list(
          { part: ["snippet", "contentDetails"], id: [id] },
          { signal: controller.signal as any },
        );
        clearTimeout(timer);

        const item = res.data.items?.[0];
        if (!item) return err("動画が見つかりませんでした。");

        const isAgeRestricted =
          item.contentDetails?.contentRating?.ytRating === "ytAgeRestricted";

        if (
          !item.snippet ||
          !item.snippet.title ||
          !item.snippet.channelTitle ||
          !item.snippet.channelId ||
          !item.contentDetails?.duration
        ) {
          return err("動画の情報が取得できませんでした。");
        }

        const duration = convertISO8601Duration(
          item.contentDetails.duration as string,
        );
        const durationSecs = duration % 60;
        const durationMins = Math.floor((duration / 60) % 60);
        const durationHours = Math.floor(duration / 3600);

        const durationStr = `${durationHours.toString().padStart(2, "0")}:${durationMins.toString().padStart(2, "0")}:${durationSecs.toString().padStart(2, "0")}`;

        const details = {
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          channelId: item.snippet.channelId,
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
