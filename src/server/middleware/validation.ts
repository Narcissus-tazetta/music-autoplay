import type { Music } from "../../shared/types/music";
import { log } from "../logger";
export function validateYouTubeUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname;
    const searchParams = urlObj.searchParams;

    const validHosts = [
      "www.youtube.com",
      "youtube.com",
      "youtu.be",
      "m.youtube.com",
    ];

    if (!validHosts.includes(hostname)) return false;

    if (hostname === "youtu.be") {
      const videoId = pathname.replace(/^\//, "");
      return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
    } else if (hostname.includes("youtube.com")) {
      if (pathname === "/watch" && searchParams.has("v")) {
        const videoId = searchParams.get("v");
        return videoId !== null && /^[a-zA-Z0-9_-]{11}$/.test(videoId);
      }

      if (pathname.startsWith("/embed/")) {
        const videoId = pathname.replace("/embed/", "");
        return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
      }

      if (pathname === "/watch" && searchParams.has("list")) {
        if (searchParams.has("v")) {
          const videoId = searchParams.get("v");
          return videoId !== null && /^[a-zA-Z0-9_-]{11}$/.test(videoId);
        }
        return false;
      }

      if (pathname === "/live/" || pathname.startsWith("/live/")) {
        const videoId = pathname.replace("/live/", "");
        return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
      }

      if (hostname === "m.youtube.com" && pathname === "/watch") {
        const videoId = searchParams.get("v");
        return videoId !== null && /^[a-zA-Z0-9_-]{11}$/.test(videoId);
      }
    }

    return false;
  } catch {
    const youtubeRegex =
      /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]{11}/i;
    return youtubeRegex.test(url);
  }
}

export function sanitizeString(
  input: string,
  maxLength: number = 1000,
): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[<>'"&]/g, "")
    .trim()
    .slice(0, maxLength);
}

export function validateMusicData(music: Music): {
  isValid: boolean;
  error?: string;
  sanitized?: Music;
} {
  if (!music.url || typeof music.url !== "string")
    return { isValid: false, error: "URLが必要です" };

  if (!validateYouTubeUrl(music.url))
    return { isValid: false, error: "有効なYouTube URLを入力してください" };

  if (music.url.length > 2000)
    return { isValid: false, error: "URLが長すぎます" };

  const title = sanitizeString(music.title, 200);
  if (music.title && music.title.length > 200)
    log.warn(`⚠️ Title truncated: "${music.title.slice(0, 50)}..."`);

  let thumbnail = "";
  if (music.thumbnail) {
    thumbnail = sanitizeString(music.thumbnail, 500);
    if (thumbnail && !thumbnail.match(/^https?:\/\/.+/)) thumbnail = "";
  }

  const sanitizedMusic: Music = {
    url: music.url,
    title: title,
    thumbnail: thumbnail,
  };

  return {
    isValid: true,
    sanitized: sanitizedMusic,
  };
}

export function validateUrlForDelete(url: string | { url: string }): {
  isValid: boolean;
  error?: string;
  sanitizedUrl?: string;
} {
  if (!url) return { isValid: false, error: "URLが必要です" };

  const urlString = typeof url === "string" ? url : url.url;

  if (typeof urlString !== "string")
    return { isValid: false, error: "無効なURL形式です" };

  if (!validateYouTubeUrl(urlString))
    return { isValid: false, error: "有効なYouTube URLを入力してください" };

  return {
    isValid: true,
    sanitizedUrl: urlString,
  };
}

export function validatePlaylistSize(
  currentSize: number,
  maxSize: number = 100,
): { isValid: boolean; error?: string } {
  if (currentSize >= maxSize) {
    return {
      isValid: false,
      error: `プレイリストが満杯です（最大${maxSize}曲）`,
    };
  }

  return { isValid: true };
}

export function logValidationEvent(
  eventType: string,
  socketId: string,
  error?: string,
  data?: unknown,
) {
  const shortId = socketId.substring(0, 8);

  if (error) {
    log.warn(
      `⚠️ Validation failed [${eventType}] from ${shortId}...: ${error}`,
    );
    if (data)
      log.debug(`📋 Invalid data: ${JSON.stringify(data).slice(0, 100)}`);
  } else {
    log.debug(`✅ Validation passed [${eventType}] from ${shortId}...`);
  }
}
