import { YOUTUBE_VIDEO_ID_REGEX } from '../constants';

export function extractYouTubeId(url: string): string | null {
    const match = url.match(YOUTUBE_VIDEO_ID_REGEX);
    return match ? match[1] : null;
}

export function isSameYouTubeVideo(url1: string, url2: string): boolean {
    const id1 = extractYouTubeId(url1);
    const id2 = extractYouTubeId(url2);
    return id1 !== null && id1 === id2;
}

export function isYouTubeWatchPage(url: string): boolean {
    return url.includes('youtube.com/watch');
}
