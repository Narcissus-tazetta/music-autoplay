import type { Result } from "@/shared/utils/errors/result-handlers";
import { err, ok } from "@/shared/utils/errors/result-handlers";
import convertISO8601Duration from "convert-iso8601-duration";
import DOMPurify from "dompurify";
import { google } from "googleapis";
import { JSDOM } from "jsdom";
import { SERVER_ENV } from "~/env.server";
import type ConfigService from "../config/configService";
import logger from "../logger";
import { logSecurityEvent } from "../utils/securityLogger";
import type CacheService from "./cacheService";

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
  private defaultTtl = 1000 * 60 * 60 * 24 * 7;
  private maxEntries = 1000;
  private cleanupTimer?: NodeJS.Timeout;
  private rateLimitRetry = 2000;
  private requestQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue = false;
  private domPurify: ReturnType<typeof DOMPurify>;

  constructor(
    apiKey?: string,
    configService?: ConfigService,
    cacheService?: CacheService,
  ) {
    const key =
      apiKey ??
      configService?.getString("YOUTUBE_API_KEY") ??
      SERVER_ENV.YOUTUBE_API_KEY;
    if (!key || (typeof key === "string" && key.trim().length === 0)) {
      logger.warn(
        "YouTube API key is not configured; some metadata lookups may fail",
      );
    }
    this.youtube = google.youtube({ version: "v3", auth: key });
    this.cleanupTimer = setInterval(
      () => {
        this.cleanupExpired();
      },
      1000 * 60 * 30,
    );

    const window = new JSDOM("").window;
    this.domPurify = DOMPurify(
      window as unknown as Parameters<typeof DOMPurify>[0],
    );

    if (
      cacheService &&
      typeof cacheService.get === "function" &&
      typeof cacheService.set === "function"
    ) {
      const adapter = new EvictingMap<
        string,
        { value: VideoDetails; expiresAt: number }
      >(() => this.maxEntries);
      adapter.get = (k: string) => {
        try {
          const got = cacheService.get(k);
          return got as { value: VideoDetails; expiresAt: number } | undefined;
        } catch {
          return undefined;
        }
      };
      adapter.set = (
        k: string,
        val: { value: VideoDetails; expiresAt: number },
      ) => {
        try {
          const ttl = Math.max(0, val.expiresAt - Date.now());
          cacheService.set(k, val, ttl);
        } catch (_e: unknown) {
          void _e;
        }
        return adapter;
      };
      this.cache = adapter;
    }
  }

  private cleanupExpired() {
    const now = Date.now();
    for (const [k, v] of this.cache)
      if (v.expiresAt <= now) this.cache.delete(k);
  }

  private async queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          if (error instanceof Error) reject(error);
          else reject(new Error(String(error)));
        }
      });

      if (!this.isProcessingQueue) void this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        try {
          await request();
        } catch (error) {
          logger.debug("Request queue error", { error });
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    this.isProcessingQueue = false;
  }

  private sanitizeString(input: string): string {
    if (!input || typeof input !== "string") return "";

    const cleaned = this.domPurify.sanitize(input, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
      FORBID_ATTR: ["onclick", "onload", "onerror", "onmouseover"],
      KEEP_CONTENT: true,
      USE_PROFILES: { html: false },
    });

    return cleaned.trim().substring(0, 1000);
  }

  private logSuspiciousContent(
    field: string,
    original: string,
    sanitized: string,
  ): void {
    if (original !== sanitized) {
      logSecurityEvent({
        type: "suspicious_request",
        severity: "medium",
        source: "youtube_data_sanitization",
        message: `Potentially malicious content detected in YouTube API response field: ${field}`,
        metadata: {
          field,
          original: original.substring(0, 100),
          sanitized: sanitized.substring(0, 100),
        },
      });
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
    if (cached && cached.expiresAt > now) return ok(cached.value);

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const apiRequest = async (): Promise<unknown> => {
          const controller = new AbortController();
          const timer = setTimeout(() => {
            controller.abort();
          }, timeoutMs);

          try {
            // cast signal to the expected type; googleapis currently accepts AbortSignal-like objects
            const result = await this.youtube.videos.list(
              { part: ["snippet", "contentDetails"], id: [id] },
              { signal: controller.signal as unknown },
            );
            return result;
          } finally {
            clearTimeout(timer);
          }
        };

        const res = await this.queueRequest(
          apiRequest as () => Promise<unknown>,
        );

        const maybeRes: unknown = res;
        const data =
          maybeRes &&
          typeof maybeRes === "object" &&
          "data" in (maybeRes as Record<string, unknown>)
            ? (maybeRes as Record<string, unknown>)["data"]
            : undefined;
        if (!data || typeof data !== "object")
          return err("動画が見つかりませんでした。");
        const items = (data as Record<string, unknown>)["items"];
        if (!Array.isArray(items) || items.length === 0)
          return err("動画が見つかりませんでした。");

        const itemsArr = items as unknown[];
        const item = itemsArr[0];
        if (!item || typeof item !== "object")
          return err("動画が見つかりませんでした。");

        const snippet = (item as Record<string, unknown>)["snippet"] as
          | Record<string, unknown>
          | undefined;
        const contentDetails = (item as Record<string, unknown>)[
          "contentDetails"
        ] as Record<string, unknown> | undefined;

        const title =
          snippet && typeof snippet.title === "string" ? snippet.title : "";
        const channelTitle =
          snippet && typeof snippet.channelTitle === "string"
            ? snippet.channelTitle
            : "";
        const channelId =
          snippet && typeof snippet.channelId === "string"
            ? snippet.channelId
            : "";
        const durationRaw =
          contentDetails && typeof contentDetails.duration === "string"
            ? contentDetails.duration
            : "";

        const contentRating = contentDetails && contentDetails.contentRating;
        const isAgeRestricted = Boolean(
          contentRating &&
            typeof contentRating === "object" &&
            (contentRating as Record<string, unknown>).ytRating ===
              "ytAgeRestricted",
        );

        const sanitizedTitle = this.sanitizeString(title);
        const sanitizedChannelTitle = this.sanitizeString(channelTitle);
        const sanitizedChannelId = channelId.replace(/[^a-zA-Z0-9_-]/g, "");

        this.logSuspiciousContent("title", title, sanitizedTitle);
        this.logSuspiciousContent(
          "channelTitle",
          channelTitle,
          sanitizedChannelTitle,
        );

        if (
          !sanitizedTitle ||
          !sanitizedChannelTitle ||
          !sanitizedChannelId ||
          !durationRaw
        ) {
          logSecurityEvent({
            type: "invalid_url",
            severity: "medium",
            source: "youtube_api_validation",
            message: "YouTube API returned incomplete or invalid video data",
            metadata: {
              videoId: id,
              title: sanitizedTitle,
              channelTitle: sanitizedChannelTitle,
            },
          });
          return err("動画の情報が取得できませんでした。");
        }

        const duration = convertISO8601Duration(durationRaw);
        const durationSecs = duration % 60;
        const durationMins = Math.floor((duration / 60) % 60);
        const durationHours = Math.floor(duration / 3600);

        const durationStr = `${`${durationHours}`.padStart(2, "0")}:${`${durationMins}`.padStart(2, "0")}:${`${durationSecs}`.padStart(
          2,
          "0",
        )}`;

        const details: VideoDetails = {
          title: sanitizedTitle,
          channelTitle: sanitizedChannelTitle,
          channelId: sanitizedChannelId,
          duration: durationStr,
          isAgeRestricted,
          raw: item,
        };
        try {
          this.cache.set(id, { value: details, expiresAt: Date.now() + ttl });
        } catch (_e: unknown) {
          void _e;
        }
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

  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.cache.clear();
    this.requestQueue = [];
  }

  dispose(): void {
    this.destroy();
  }
}
