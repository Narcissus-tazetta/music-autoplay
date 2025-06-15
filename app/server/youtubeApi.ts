import { google } from "googleapis";
import dotenv from "dotenv";
import { DailyApiCounter } from "./apiCounter";
import { VideoInfoCache, type YouTubeVideoInfo } from "./videoCache";
import { log } from "./logger";

// 念のため環境変数を確実に読み込み
dotenv.config();

// 環境変数の確認（起動時のみ）
const apiKey = process.env.YOUTUBE_API_KEY;
log.youtube(`🔑 YouTube API Key status: ${apiKey ? "✅ Available" : "❌ Missing"}`);
if (apiKey) {
  log.debug(`🔑 API Key length: ${apiKey.length}`);
  log.debug(`🔑 API Key prefix: ${apiKey.substring(0, 10)}...`);
}

const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY,
});

// キャッシュとカウンターのインスタンス
const videoCache = new VideoInfoCache();
const apiCounter = DailyApiCounter.getInstance();

// YouTubeVideoInfoインターフェースを再エクスポート
export type { YouTubeVideoInfo } from "./videoCache";

/**
 * YouTube動画IDから動画情報を取得（キャッシュ付き）
 */
export async function fetchVideoInfo(videoId: string): Promise<YouTubeVideoInfo | null> {
  // キャッシュチェック
  const cachedInfo = videoCache.get(videoId);
  if (cachedInfo) {
    log.debug(`💾 Using cached info for: ${videoId}`);
    return cachedInfo;
  }

  // YouTube API キーが設定されていない場合はスキップ
  if (!process.env.YOUTUBE_API_KEY) {
    log.warn(`⚠️  YouTube API Key not configured, skipping video info fetch for: ${videoId}`);
    return null;
  }

  try {
    // API使用量をカウント
    const currentCount = apiCounter.increment();
    log.youtube(`🌐 Fetching from YouTube API: ${videoId} (今日の使用回数: ${currentCount})`);
    
    const response = await youtube.videos.list({
      part: ["snippet", "contentDetails"],
      id: [videoId],
    });

    const video = response.data.items?.[0];
    if (!video) {
      log.warn(`📺 Video not found: ${videoId}`);
      return null;
    }

    const snippet = video.snippet;
    const contentDetails = video.contentDetails;

    if (!snippet || !contentDetails) {
      log.warn(`📺 Incomplete video data: ${videoId}`);
      return null;
    }

    // 長さをISO 8601からミリ秒に変換
    const duration = contentDetails.duration;
    let lengthMs = 0;
    if (duration) {
      const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (match) {
        const hours = parseInt(match[1] || "0");
        const minutes = parseInt(match[2] || "0");
        const seconds = parseInt(match[3] || "0");
        lengthMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
      }
    }

    // 音楽判定（簡易版）
    const title = snippet.title || "";
    const description = snippet.description || "";
    const categoryId = snippet.categoryId;
    
    // 音楽関連キーワード
    const musicKeywords = [
      "music", "音楽", "mv", "official", "ライブ", "live", "cover", "カバー",
      "歌ってみた", "弾いてみた", "piano", "guitar", "vocal", "bgm", "ost"
    ];
    
    const text = (title + " " + description).toLowerCase();
    const hasKeyword = musicKeywords.some(kw => text.includes(kw.toLowerCase()));
    const isMusic = categoryId === "10" || hasKeyword;

    // より高品質なサムネイルを優先的に取得
    const thumbnails = snippet.thumbnails;
    let thumbnailUrl = "";
    if (thumbnails) {
      // 高品質から順に確認
      if ((thumbnails as any).maxres?.url) {
        thumbnailUrl = (thumbnails as any).maxres.url;
      } else if ((thumbnails as any).high?.url) {
        thumbnailUrl = (thumbnails as any).high.url;
      } else if ((thumbnails as any).medium?.url) {
        thumbnailUrl = (thumbnails as any).medium.url;
      } else if (thumbnails.default?.url) {
        thumbnailUrl = thumbnails.default.url;
      }
    }

    const videoInfo: YouTubeVideoInfo = {
      title,
      thumbnail: thumbnailUrl,
      length: lengthMs,
      isMusic,
    };

    // キャッシュに保存
    videoCache.set(videoId, videoInfo);
    log.debug(`💾 Cached video info: "${title}" (cache size: ${videoCache.size()})`);

    return videoInfo;

  } catch (error) {
    log.error(`❌ Failed to fetch video info for ${videoId}:`, error);
    return null;
  }
}

/**
 * 今日のAPI使用量を取得
 */
export function getTodaysApiUsage(): { count: number; date: string } {
  return {
    count: apiCounter.getCount(),
    date: apiCounter.getResetDate() || new Date().toISOString().split('T')[0]
  };
}
