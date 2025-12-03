import type { RemoteStatus } from '@/shared/stores/musicStore';

export function isRemoteStatusEqual(a: RemoteStatus, b: RemoteStatus): boolean {
    if (a.type !== b.type) return false;
    if (a.type === 'playing' && b.type === 'playing') {
        return (
            a.musicTitle === b.musicTitle
            && a.isAdvertisement === b.isAdvertisement
            && a.adTimestamp === b.adTimestamp
            && a.isExternalVideo === b.isExternalVideo
            && a.videoId === b.videoId
            && (a.lastProgressUpdate ?? null) === (b.lastProgressUpdate ?? null)
            && (typeof a.progressPercent === 'number' ? a.progressPercent : null)
                === (typeof b.progressPercent === 'number' ? b.progressPercent : null)
        );
    }
    if (a.type === 'paused' && b.type === 'paused') return a.isTransitioning === b.isTransitioning;
    return true;
}

export function shouldDebounce(prevUpdatedAt: number, now: number, debounceMs: number): boolean {
    return now - prevUpdatedAt < debounceMs;
}
