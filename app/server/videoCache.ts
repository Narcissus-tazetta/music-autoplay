export interface YouTubeVideoInfo {
  title: string;
  thumbnail: string;
  length: number;
  isMusic: boolean;
}

interface CachedVideoInfo {
  info: YouTubeVideoInfo;
  timestamp: number;
}

/**
 * YouTube動画情報キャッシュ（複数件、TTL付き）
 */
export class VideoInfoCache {
  private cache = new Map<string, CachedVideoInfo>();
  private readonly maxSize = 50;
  private readonly ttl = 30 * 60 * 1000;

  get(videoId: string): YouTubeVideoInfo | null {
    const cached = this.cache.get(videoId);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(videoId);
      return null;
    }

    return cached.info;
  }

  set(videoId: string, info: YouTubeVideoInfo): void {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(videoId, {
      info,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}
