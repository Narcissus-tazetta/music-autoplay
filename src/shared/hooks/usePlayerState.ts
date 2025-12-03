import type { RemoteStatus } from '@/shared/stores/musicStore';
import { useEffect, useRef, useState } from 'react';

const SEEK_THRESHOLD = 5;
const MIN_TIMESTAMP_ADVANCE_MS = 250;
const EFFECTIVE_PAUSE_THRESHOLD = 1;
const EFFECTIVE_PAUSE_DELTA = 0.1;

interface UseInterpolatedTimeParams {
    status: RemoteStatus | null;
    duration?: number;
}

export function useInterpolatedTime({
    status,
    duration,
}: UseInterpolatedTimeParams): {
    currentTime: number;
    isEffectivelyPaused: boolean;
} {
    const [localCurrentTime, setLocalCurrentTime] = useState(0);
    const [isEffectivelyPaused, setIsEffectivelyPaused] = useState(false);
    const animationFrameRef = useRef<number | null>(null);
    const lastUpdateTimestampRef = useRef<number>(0);
    const baseTimeRef = useRef(0);
    const localCurrentTimeRef = useRef(0);
    const lastStatusCurrentTimeRef = useRef<number>(0);
    const zeroProgressCountRef = useRef<number>(0);
    const effectivePausedRef = useRef<boolean>(false);

    useEffect(() => {
        localCurrentTimeRef.current = localCurrentTime;
    }, [localCurrentTime]);

    useEffect(() => {
        if (status?.type === 'playing' && typeof status.currentTime === 'number') {
            const newTimestamp = status.lastProgressUpdate || Date.now();
            const timeDiff = Math.abs(
                status.currentTime - localCurrentTimeRef.current,
            );
            const seekDetected = timeDiff >= SEEK_THRESHOLD || lastUpdateTimestampRef.current === 0;

            const delta = Math.abs(
                status.currentTime - lastStatusCurrentTimeRef.current,
            );
            if (
                delta < EFFECTIVE_PAUSE_DELTA
                && lastStatusCurrentTimeRef.current > 0
            ) {
                zeroProgressCountRef.current += 1;
                if (zeroProgressCountRef.current >= EFFECTIVE_PAUSE_THRESHOLD) {
                    if (!effectivePausedRef.current) {
                        effectivePausedRef.current = true;
                        setIsEffectivelyPaused(true);
                    }
                }
            } else {
                zeroProgressCountRef.current = 0;
                if (effectivePausedRef.current) {
                    effectivePausedRef.current = false;
                    setIsEffectivelyPaused(false);
                }
            }
            lastStatusCurrentTimeRef.current = status.currentTime;

            if (seekDetected) {
                setLocalCurrentTime(status.currentTime);
                baseTimeRef.current = status.currentTime;
                lastUpdateTimestampRef.current = newTimestamp;
            } else {
                const timestampDelta = newTimestamp - lastUpdateTimestampRef.current;
                if (timestampDelta >= MIN_TIMESTAMP_ADVANCE_MS) {
                    lastUpdateTimestampRef.current = newTimestamp;
                    baseTimeRef.current = status.currentTime;
                }
            }
        } else if (status?.type === 'paused') {
            baseTimeRef.current = localCurrentTimeRef.current;
            lastUpdateTimestampRef.current = Date.now();
            if (effectivePausedRef.current) {
                effectivePausedRef.current = false;
                setIsEffectivelyPaused(false);
            }
            zeroProgressCountRef.current = 0;
        }
    }, [status]);

    useEffect(() => {
        if (!status || status.type === 'closed') {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = undefined;
            }
            return;
        }

        const animate = (): void => {
            const now = Date.now();
            const elapsed = (now - lastUpdateTimestampRef.current) / 1000;
            const isPlayingNow = status.type === 'playing' && !effectivePausedRef.current;
            const newTime = isPlayingNow
                ? baseTimeRef.current + elapsed
                : baseTimeRef.current;
            const clampedTime = duration != undefined ? Math.min(newTime, duration) : newTime;
            setLocalCurrentTime(clampedTime);
            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = undefined;
            }
        };
    }, [status, duration]);

    return { currentTime: localCurrentTime, isEffectivelyPaused };
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
                    timerRef.current = undefined;
                }, FADE_OUT_DURATION);
            }, FADE_OUT_DELAY);
        } else {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = undefined;
            }
            setVisibility('visible');
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = undefined;
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
        return firstValidIndex !== -1
            ? candidates[firstValidIndex]
            : '/favicon.svg';
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
