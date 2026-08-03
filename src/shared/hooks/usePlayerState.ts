import type { RemoteStatus } from '@/shared/stores/musicStore';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseInterpolatedTimeParams {
    status: RemoteStatus | null;
    duration?: number;
    videoId?: string;
    isAdvertisement?: boolean;
}

interface Anchor {
    time: number;
    perf: number;
    /** 0 while buffering/stalled, so interpolation freezes without a separate flag. */
    rate: number;
}

export function useInterpolatedTime({
    status,
    duration,
    videoId,
}: UseInterpolatedTimeParams): {
    currentTime: number;
    isEffectivelyPaused: boolean;
} {
    // Lazy initialiser: this only feeds the first render, but as a plain expression it was
    // recomputed on every render for nothing.
    const [displayTime, setDisplayTime] = useState(() => {
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
    });
    const [isEffectivelyPaused, setIsEffectivelyPaused] = useState(false);
    const rafRef = useRef<number | null>(null);
    const anchorRef = useRef<Anchor | null>(null);
    const lastVideoIdRef = useRef<string>('');
    const isPausedRef = useRef(false);
    const durationRef = useRef(duration);

    // Kept in an effect for the same reason as useInitialStatusReveal below: a render that
    // React discards must not leave the ref describing it.
    useEffect(() => {
        durationRef.current = duration;
    }, [duration]);

    useEffect(() => {
        if (videoId && videoId !== lastVideoIdRef.current) {
            lastVideoIdRef.current = videoId;
            anchorRef.current = null;
            setDisplayTime(0);
            setIsEffectivelyPaused(false);
            isPausedRef.current = false;
        }
    }, [videoId]);

    // Single owner of the animation frame loop. The body used to be duplicated verbatim inside
    // the status effect below, with both copies writing the same rafRef - so a duration change
    // could tear down one loop while the other was still scheduling frames.
    const startLoop = useCallback(() => {
        if (rafRef.current !== null || isPausedRef.current) return;

        const animate = () => {
            if (isPausedRef.current) {
                rafRef.current = null;
                return;
            }

            // Stop rather than reschedule when there's nothing to interpolate yet (e.g. before
            // the first status arrives, or a 'playing' status without currentTime) - scheduling
            // unconditionally here would spin an rAF callback every frame doing no work. The
            // status effect calls startLoop() again once an anchor is set, so this resumes on
            // its own.
            const anchor = anchorRef.current;
            if (!anchor) {
                rafRef.current = null;
                return;
            }

            rafRef.current = requestAnimationFrame(animate);

            const elapsed = (performance.now() - anchor.perf) / 1000;
            let time = anchor.time + elapsed * anchor.rate;
            const currentDuration = durationRef.current;
            if (currentDuration) time = Math.min(time, currentDuration);

            setDisplayTime(time);
        };

        rafRef.current = requestAnimationFrame(animate);
    }, []);

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
                anchorRef.current = { perf: performance.now(), rate: 0, time: status.currentTime };
                setDisplayTime(status.currentTime);
            }
            setIsEffectivelyPaused(true);
            return;
        }

        if (status.type === 'playing' && typeof status.currentTime === 'number') {
            isPausedRef.current = false;
            const rate = status.playbackRate ?? 1;
            const buffering = status.isBuffering ?? false;
            const stalled = status.consecutiveStalls ? status.consecutiveStalls > 0 : false;

            anchorRef.current = {
                perf: performance.now(),
                rate: buffering || stalled ? 0 : rate,
                time: status.currentTime,
            };
            setDisplayTime(status.currentTime);
            setIsEffectivelyPaused(buffering || stalled);

            // The loop below owns the rAF handle; resuming from pause just needs it restarted.
            startLoop();
        }
    }, [status, startLoop]);

    useEffect(() => {
        startLoop();
        return () => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, [startLoop]);

    return { currentTime: displayTime, isEffectivelyPaused };
}

export type VisibilityState = 'visible' | 'hiding' | 'hidden';

export const CLOSED_NOTIFICATION_VISIBLE_MS = 12_000;
const FADE_OUT_DURATION = 600;

const ACTIVE_PLAYBACK_TYPES = new Set<RemoteStatus['type']>(['playing', 'paused']);

export function isActivePlaybackStatus(type: RemoteStatus['type'] | null | undefined): boolean {
    return type != null && ACTIVE_PLAYBACK_TYPES.has(type);
}

export function shouldShowClosedNotification(
    previousType: RemoteStatus['type'] | null,
    currentType: RemoteStatus['type'] | null | undefined,
): boolean {
    return currentType === 'closed' && isActivePlaybackStatus(previousType);
}

const STATUS_TRANSITION_HOLD_MS = 3000;
const STATUS_INITIAL_REVEAL_DELAY_MS = 350;

export const STATUS_PANEL_MOTION = {
    animate: { opacity: 1, y: 0 },
    initial: { opacity: 0, y: -12 },
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
};

const TRANSITION_MIN_DISPLAY_MS = STATUS_TRANSITION_HOLD_MS;

export function useInitialStatusReveal(status: RemoteStatus | null): RemoteStatus | null {
    const [revealedStatus, setRevealedStatus] = useState<RemoteStatus | null>(null);
    const hasRevealedRef = useRef(false);
    const timerRef = useRef<number | null>(null);
    const statusRef = useRef(status);

    // Assigning statusRef during render is not safe under concurrent rendering: React may
    // render without committing, leaving the ref describing a render that never happened.
    useEffect(() => {
        statusRef.current = status;
    });

    useEffect(() => () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!status) {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            hasRevealedRef.current = false;
            setRevealedStatus(null);
            return;
        }

        if (hasRevealedRef.current) {
            setRevealedStatus(status);
            return;
        }

        if (timerRef.current) return;

        timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            hasRevealedRef.current = true;
            setRevealedStatus(statusRef.current);
        }, STATUS_INITIAL_REVEAL_DELAY_MS);
    }, [status]);

    return revealedStatus;
}

export function useTransitioningHold(status: RemoteStatus | null): boolean {
    const [show, setShow] = useState(false);
    const releaseAtRef = useRef(0);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        const clearTimer = (): void => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };

        if (!status || status.type === 'closed') {
            releaseAtRef.current = 0;
            setShow(false);
            clearTimer();
            return clearTimer;
        }

        const isTransitioning = status.type === 'paused' && status.isTransitioning === true;

        if (isTransitioning) {
            releaseAtRef.current = Math.max(releaseAtRef.current, Date.now() + TRANSITION_MIN_DISPLAY_MS);
            setShow(true);
            clearTimer();
            timerRef.current = window.setTimeout(() => {
                timerRef.current = null;
                if (Date.now() >= releaseAtRef.current) setShow(false);
            }, releaseAtRef.current - Date.now());
            return clearTimer;
        }

        if (Date.now() < releaseAtRef.current) {
            setShow(true);
            clearTimer();
            timerRef.current = window.setTimeout(() => {
                timerRef.current = null;
                setShow(false);
                releaseAtRef.current = 0;
            }, releaseAtRef.current - Date.now());
            return clearTimer;
        }

        setShow(false);
        releaseAtRef.current = 0;
        clearTimer();
        return clearTimer;
    }, [status]);

    const isTransitioning = status?.type === 'paused' && status.isTransitioning === true;
    return show || isTransitioning;
}

export function useClosedNotificationVisibility(status: RemoteStatus | null): VisibilityState {
    const [visibility, setVisibility] = useState<VisibilityState>('hidden');
    const previousTypeRef = useRef<RemoteStatus['type'] | null>(null);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        const clearTimers = (): void => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };

        if (!status) {
            previousTypeRef.current = null;
            clearTimers();
            setVisibility('hidden');
            return clearTimers;
        }

        if (status.type !== 'closed') {
            previousTypeRef.current = status.type;
            clearTimers();
            setVisibility('hidden');
            return clearTimers;
        }

        const shouldNotify = shouldShowClosedNotification(previousTypeRef.current, status.type);
        previousTypeRef.current = 'closed';

        if (!shouldNotify) {
            clearTimers();
            setVisibility('hidden');
            return clearTimers;
        }

        setVisibility('visible');
        clearTimers();
        timerRef.current = window.setTimeout(() => {
            setVisibility('hiding');
            timerRef.current = window.setTimeout(() => {
                setVisibility('hidden');
                timerRef.current = null;
            }, FADE_OUT_DURATION);
        }, CLOSED_NOTIFICATION_VISIBLE_MS);

        return clearTimers;
    }, [status]);

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
