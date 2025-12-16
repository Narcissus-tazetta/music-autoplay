import type { RemoteStatus } from '@/shared/stores/musicStore';
import { useEffect, useRef, useState } from 'react';

interface UseInterpolatedTimeParams {
    status: RemoteStatus | null;
    duration?: number;
    videoId?: string;
    isAdvertisement?: boolean;
}

interface Anchor {
    time: number;
    perf: number;
    rate: number;
    buffering: boolean;
}

export function useInterpolatedTime({
    status,
    duration,
    videoId,
}: UseInterpolatedTimeParams): {
    currentTime: number;
    isEffectivelyPaused: boolean;
} {
    const initialTime = (() => {
        if ((status?.type === 'playing' || status?.type === 'paused') && typeof status.currentTime === 'number')
            return status.currentTime;
        if (status?.type === 'paused' && typeof status.duration === 'number') return status.duration;

        if (status?.type === 'playing' && typeof status.lastProgressUpdate === 'number') {
            const deltaMs = Math.max(0, Date.now() - status.lastProgressUpdate);
            const rate = typeof status.playbackRate === 'number' ? status.playbackRate : 1;
            let predicted = (deltaMs / 1000) * rate;
            if (typeof status.duration === 'number' && status.duration > 0)
                predicted = Math.min(predicted, status.duration);
            return predicted;
        }

        return 0;
    })();
    const [displayTime, setDisplayTime] = useState(initialTime);
    const [isEffectivelyPaused, setIsEffectivelyPaused] = useState(false);
    const rafRef = useRef<number | null>(null);
    const anchorRef = useRef<Anchor | null>(null);
    const lastVideoIdRef = useRef<string>('');
    const isPausedRef = useRef(false);
    const delayMsRef = useRef(0);
    const lastTimeRef = useRef(0);

    useEffect(() => {
        if (videoId && videoId !== lastVideoIdRef.current) {
            lastVideoIdRef.current = videoId;
            anchorRef.current = null;
            delayMsRef.current = 0;
            lastTimeRef.current = 0;
            setDisplayTime(0);
            setIsEffectivelyPaused(false);
            isPausedRef.current = false;
        }
    }, [videoId]);

    useEffect(() => {
        if (!status || status.type === 'closed') {
            anchorRef.current = null;
            isPausedRef.current = false;
            setIsEffectivelyPaused(false);
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            return;
        }

        if (status.type === 'paused') {
            isPausedRef.current = true;
            if (typeof status.currentTime === 'number') {
                anchorRef.current = {
                    buffering: false,
                    perf: performance.now(),
                    rate: 0,
                    time: status.currentTime,
                };
                lastTimeRef.current = status.currentTime;
                setDisplayTime(status.currentTime);
            }
            setIsEffectivelyPaused(true);
            return;
        }

        if (status.type === 'playing' && typeof status.currentTime === 'number') {
            const wasPaused = isPausedRef.current;
            isPausedRef.current = false;
            const rate = status.playbackRate ?? 1;
            const buffering = status.isBuffering ?? false;
            const stalled = status.consecutiveStalls ? status.consecutiveStalls > 0 : false;

            anchorRef.current = {
                buffering,
                perf: performance.now(),
                rate: buffering || stalled ? 0 : rate,
                time: status.currentTime,
            };
            lastTimeRef.current = status.currentTime;
            setDisplayTime(status.currentTime);
            setIsEffectivelyPaused(buffering || stalled);

            if (wasPaused && !rafRef.current) {
                const animate = () => {
                    if (isPausedRef.current) {
                        rafRef.current = null;
                        return;
                    }
                    rafRef.current = requestAnimationFrame(animate);
                    const anchor = anchorRef.current;
                    if (!anchor) return;
                    const elapsed = (performance.now() - anchor.perf) / 1000;
                    let time = anchor.time + elapsed * anchor.rate;
                    if (duration) time = Math.min(time, duration);
                    setDisplayTime(time);
                };
                rafRef.current = requestAnimationFrame(animate);
            }
        }
    }, [status, duration]);

    useEffect(() => {
        const animate = () => {
            if (isPausedRef.current) {
                rafRef.current = null;
                return;
            }

            rafRef.current = requestAnimationFrame(animate);

            const anchor = anchorRef.current;
            if (!anchor) return;

            const elapsed = (performance.now() - anchor.perf) / 1000;
            let time = anchor.time + elapsed * anchor.rate;
            if (duration) time = Math.min(time, duration);

            setDisplayTime(time);
        };

        if (!isPausedRef.current) rafRef.current = requestAnimationFrame(animate);

        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, [duration]);

    return { currentTime: displayTime, isEffectivelyPaused };
}

type VisibilityState = 'visible' | 'hiding' | 'hidden';

const FADE_OUT_DELAY = 0;
const FADE_OUT_DURATION = 600;

interface UseVisibilityTimerParams {
    hasStatus: boolean;
    isClosed: boolean;
}

export function useVisibilityTimer({
    hasStatus,
    isClosed,
}: UseVisibilityTimerParams): VisibilityState {
    const [visibility, setVisibility] = useState<VisibilityState>('visible');
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        if (!hasStatus) {
            setVisibility('hidden');
            return;
        }

        if (isClosed) {
            setVisibility('visible');
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = window.setTimeout(() => {
                setVisibility('hiding');
                timerRef.current = window.setTimeout(() => {
                    setVisibility('hidden');
                    timerRef.current = null;
                }, FADE_OUT_DURATION);
            }, FADE_OUT_DELAY);
        } else {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            setVisibility('visible');
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [hasStatus, isClosed]);

    return visibility;
}

interface ThumbnailResult {
    src: string;
    loaded: boolean;
    handleLoad: () => void;
    handleError: () => void;
}

const makeCandidates = (videoId: string): string[] => [
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/default.jpg`,
];

export function useThumbnail(videoId?: string): ThumbnailResult {
    const [loaded, setLoaded] = useState(false);
    const [failedIndices, setFailedIndices] = useState<{
        id: string;
        indices: Set<number>;
    }>({
        id: '',
        indices: new Set(),
    });

    const candidates = videoId ? makeCandidates(videoId) : [];
    const activeIndices = failedIndices.id === videoId ? failedIndices.indices : new Set<number>();

    const src = (() => {
        if (!videoId) return '/favicon.svg';
        const firstValidIndex = candidates.findIndex(
            (_, i) => !activeIndices.has(i),
        );
        return firstValidIndex !== -1 ? candidates[firstValidIndex] : '/favicon.svg';
    })();

    const handleError = (): void => {
        const currentIndex = candidates.indexOf(src);
        if (currentIndex !== -1 && videoId) {
            setFailedIndices(prev => ({
                id: videoId,
                indices: prev.id === videoId
                    ? new Set([...prev.indices, currentIndex])
                    : new Set([currentIndex]),
            }));
        }
        setLoaded(true);
    };

    const handleLoad = (): void => {
        setLoaded(true);
    };

    useEffect(() => {
        setLoaded(false);
    }, [src]);

    return { handleError, handleLoad, loaded, src };
}
