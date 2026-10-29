import type { RemoteStatus } from '@/shared/types/music';

export function isRemoteStatusEqual(a: RemoteStatus, b: RemoteStatus): boolean {
    if (a.type !== b.type) return false;
    if (a.type === 'playing' && b.type === 'playing') {
        return (
            a.musicId === b.musicId
            && a.currentTime === b.currentTime
            && a.duration === b.duration
            && a.playbackRate === b.playbackRate
            && a.musicTitle === b.musicTitle
            && a.isAdvertisement === b.isAdvertisement
            && a.adTimestamp === b.adTimestamp
            && a.isExternalVideo === b.isExternalVideo
            && a.videoId === b.videoId
            && (a.lastProgressUpdate ?? undefined)
                === (b.lastProgressUpdate ?? undefined)
            && (typeof a.progressPercent === 'number'
                    ? a.progressPercent
                    : undefined)
                === (typeof b.progressPercent === 'number' ? b.progressPercent : undefined)
        );
    }
    if (a.type === 'paused' && b.type === 'paused') {
        return a.isTransitioning === b.isTransitioning
            && a.musicId === b.musicId
            && a.videoId === b.videoId
            && a.musicTitle === b.musicTitle
            && a.currentTime === b.currentTime
            && a.duration === b.duration;
    }
    return true;
}

export function shouldDebounce(
    prevUpdatedAt: number,
    now: number,
    debounceMs: number,
): boolean {
    return now - prevUpdatedAt < debounceMs;
}
