import dotenv from 'dotenv';
import { google } from 'googleapis';
import { DailyApiCounter } from './apiCounter';
import { log } from './logger';
import { VideoInfoCache, type YouTubeVideoInfo } from './videoCache';

dotenv.config();

const apiKey = process.env.YOUTUBE_API_KEY;
log.youtube(`🔑 YouTube API Key status: ${apiKey ? '✅ Available' : '❌ Missing'}`);
if (apiKey) {
    log.debug(`🔑 API Key length: ${apiKey.length}`);
    log.debug(`🔑 API Key prefix: ${apiKey.substring(0, 10)}...`);
}

const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY,
});

const videoCache = new VideoInfoCache();
const apiCounter = DailyApiCounter.getInstance();

export type { YouTubeVideoInfo } from './videoCache';

/**
 * YouTube動画IDから動画情報を取得（キャッシュ付き）
 */
export async function fetchVideoInfo(videoId: string): Promise<YouTubeVideoInfo | null> {
    const cachedInfo = videoCache.get(videoId);
    if (cachedInfo) {
        log.debug(`💾 Using cached info for: ${videoId}`);
        return cachedInfo;
    }

    if (!process.env.YOUTUBE_API_KEY) {
        log.warn(`⚠️  YouTube API Key not configured, skipping video info fetch for: ${videoId}`);
        return null;
    }

    try {
        const currentCount = apiCounter.increment();
        log.youtube(`🌐 Fetching from YouTube API: ${videoId} (今日の使用回数: ${currentCount})`);

        const response = await youtube.videos.list({
            part: ['snippet', 'contentDetails'],
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

        const duration = contentDetails.duration;
        let lengthMs = 0;
        if (duration) {
            const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            if (match) {
                const hours = parseInt(match[1] || '0');
                const minutes = parseInt(match[2] || '0');
                const seconds = parseInt(match[3] || '0');
                lengthMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
            }
        }

        const title = snippet.title || '';
        const description = snippet.description || '';
        const categoryId = snippet.categoryId;

        const musicKeywords = [
            'music',
            '音楽',
            'mv',
            'official',
            'ライブ',
            'live',
            'cover',
            'カバー',
            '歌ってみた',
            '弾いてみた',
            'piano',
            'guitar',
            'vocal',
            'bgm',
            'ost',
        ];

        const text = (title + ' ' + description).toLowerCase();
        const hasKeyword = musicKeywords.some(kw => text.includes(kw.toLowerCase()));
        const isMusic = categoryId === '10' || hasKeyword;

        const thumbnails = snippet.thumbnails;
        let thumbnailUrl = '';
        if (thumbnails) {
            if (thumbnails.maxres?.url) thumbnailUrl = thumbnails.maxres.url;
            else if (thumbnails.high?.url) thumbnailUrl = thumbnails.high.url;
            else if (thumbnails.medium?.url) thumbnailUrl = thumbnails.medium.url;
            else if (thumbnails.default?.url) thumbnailUrl = thumbnails.default.url;
        }

        const videoInfo: YouTubeVideoInfo = {
            title,
            thumbnail: thumbnailUrl,
            length: lengthMs,
            isMusic,
        };

        videoCache.set(videoId, videoInfo);
        log.debug(`💾 Cached video info: "${title}" (cache size: ${videoCache.size()})`);

        return videoInfo;
    } catch (error) {
        log.error(
            `❌ Failed to fetch video info for ${videoId}:`,
            error instanceof Error ? error : new Error(String(error)),
        );
        return null;
    }
}

/**
 * 今日のAPI使用量を取得
 */
export function getTodaysApiUsage(): { count: number; date: string } {
    return {
        count: apiCounter.getCount(),
        date: apiCounter.getResetDate() || new Date().toISOString().split('T')[0],
    };
}
