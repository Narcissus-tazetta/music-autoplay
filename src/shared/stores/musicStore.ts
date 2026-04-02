import type { RemoteStatusWithMeta } from '@/shared/types/remoteStatus';
import type { C2S, S2C } from '@/shared/types/socket';
import type { Socket } from 'socket.io-client';
import { create } from 'zustand';
import { getSocket } from '../../app/utils/socketClient';

const SEEK_THRESHOLD = 5;
const REMOTE_STATUS_POLL_INTERVAL_MS = 10_000;
const SYNC_FETCH_MIN_INTERVAL_MS = 1_500;
const REMOTE_STATUS_EVENT_GRACE_MS = 2_000;

export type RemoteStatus =
    | {
        type: 'playing';
        musicTitle: string;
        musicId?: string;
        isAdvertisement?: boolean;
        adTimestamp?: number;
        isExternalVideo?: boolean;
        videoId?: string;
        currentTime?: number;
        duration?: number;
        progressPercent?: number;
        lastProgressUpdate?: number;
        consecutiveStalls?: number;
        playbackRate?: number;
        isBuffering?: boolean;
    }
    | {
        type: 'paused';
        musicTitle?: string;
        musicId?: string;
        videoId?: string;
        isTransitioning?: boolean;
        currentTime?: number;
        duration?: number;
        playbackRate?: number;
    }
    | {
        type: 'closed';
    };
export interface Music {
    title: string;
    channelName: string;
    channelId: string;
    id: string;
    duration: string;
    requesterHash?: string;
    requesterName?: string;
    requestedAt?: string;
}

interface MusicStore {
    musics: Music[];
    socket?: Socket<S2C, C2S> | null;
    remoteStatus: RemoteStatus | null;
    lastAuthoritativePause?: {
        time: number;
        serverTimestamp: number;
        sequenceNumber: number;
        traceId: string;
        createdAt: number;
    } | null;
    lastSequenceNumber: number;
    lastServerTimestamp: number;
    lastTraceId: string;
    lastEventReceivedAt: number;
    error?: string;
    resetError?: () => void;
    setMusics?: (musics: Music[]) => void;
    hydrateFromLocalStorage?: () => void;

    addMusic(music: Music): void;
    connectSocket(): void;
    remoteStatusUpdated(incomingState: RemoteStatusWithMeta): void;
}

type SyncFetchResult = {
    source: 'musics' | 'remoteStatus';
    ok: boolean;
    attempts: number;
    reason?: 'timeout' | 'emit-error' | 'recent-event' | 'invalid-payload';
};

const getStatusCurrentTime = (status: RemoteStatus | null): number | undefined => {
    if (!status || status.type === 'closed') return undefined;
    return typeof status.currentTime === 'number' ? status.currentTime : undefined;
};

const isMusic = (value: unknown): value is Music => {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<Music>;
    return typeof candidate.id === 'string'
        && typeof candidate.title === 'string'
        && typeof candidate.channelId === 'string'
        && typeof candidate.channelName === 'string'
        && typeof candidate.duration === 'string';
};

const isRemoteStatusShape = (value: unknown): value is RemoteStatus => {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as { type?: unknown };
    return candidate.type === 'playing' || candidate.type === 'paused' || candidate.type === 'closed';
};

const isRemoteStatusMetaShape = (value: unknown): value is NonNullable<RemoteStatusWithMeta['_meta']> => {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as { sequenceNumber?: unknown; serverTimestamp?: unknown; traceId?: unknown };
    return typeof candidate.sequenceNumber === 'number'
        && typeof candidate.serverTimestamp === 'number'
        && typeof candidate.traceId === 'string';
};

const isRemoteStatusWithMetaShape = (value: unknown): value is RemoteStatusWithMeta => {
    if (!isRemoteStatusShape(value)) return false;
    if (!('_meta' in (value as Record<string, unknown>))) return true;
    const meta = (value as Record<string, unknown>)['_meta'];
    return meta === undefined || isRemoteStatusMetaShape(meta);
};

export const useMusicStore = create<MusicStore>(set => {
    let socket: Socket<S2C, C2S> | null;
    const STORAGE_KEY = 'music-auto-play:musics:v1';
    const handleRemoteStatusUpdate = (incomingState: RemoteStatusWithMeta) => {
        const meta = incomingState._meta;

        if (meta) {
            set(state => {
                const lastServerTimestamp = state.lastServerTimestamp;
                const sequenceBehind = meta.sequenceNumber < state.lastSequenceNumber;
                const hasSameSequence = meta.sequenceNumber === state.lastSequenceNumber;
                const incomingServerTimestamp = meta.serverTimestamp;
                const hasNewTimestamp = incomingServerTimestamp > lastServerTimestamp;
                const isDuplicateByTraceId = hasSameSequence && meta.traceId && meta.traceId === state.lastTraceId;
                const isStale = sequenceBehind || (hasSameSequence && !hasNewTimestamp) || isDuplicateByTraceId;
                const isTooOld = incomingServerTimestamp < lastServerTimestamp - 5000;

                if (isStale || isTooOld) return {};

                const { _meta, ...statusWithoutMeta } = incomingState;

                const PAUSE_TTL_MS = 60_000;
                const PAUSE_ACCEPT_WINDOW_MS = 5_000;
                const PAUSE_EPSILON_S = 0.5;
                if (statusWithoutMeta.type === 'paused') {
                    if (typeof statusWithoutMeta.currentTime === 'number') {
                        return {
                            lastSequenceNumber: meta.sequenceNumber,
                            lastServerTimestamp: meta.serverTimestamp,
                            lastTraceId: meta.traceId,
                            lastEventReceivedAt: Date.now(),
                            remoteStatus: statusWithoutMeta,
                            lastAuthoritativePause: {
                                time: statusWithoutMeta.currentTime,
                                serverTimestamp: meta.serverTimestamp,
                                sequenceNumber: meta.sequenceNumber,
                                traceId: meta.traceId,
                                createdAt: Date.now(),
                            },
                        };
                    }
                    const fallbackTime = getStatusCurrentTime(state.remoteStatus);

                    return {
                        lastSequenceNumber: meta.sequenceNumber,
                        lastServerTimestamp: meta.serverTimestamp,
                        lastTraceId: meta.traceId,
                        lastEventReceivedAt: Date.now(),
                        remoteStatus: {
                            ...statusWithoutMeta,
                            currentTime: fallbackTime,
                        },
                    };
                }

                const now = Date.now();
                if (
                    statusWithoutMeta.type === 'playing'
                    && state.lastAuthoritativePause
                    && now - state.lastAuthoritativePause.createdAt <= PAUSE_TTL_MS
                ) {
                    const pause = state.lastAuthoritativePause;
                    const incomingTime = typeof statusWithoutMeta.currentTime === 'number'
                        ? statusWithoutMeta.currentTime
                        : NaN;
                    const withinEpsilon = !isNaN(incomingTime)
                        && Math.abs(incomingTime - pause.time) <= PAUSE_EPSILON_S;
                    const withinWindow = meta.serverTimestamp <= pause.serverTimestamp + PAUSE_ACCEPT_WINDOW_MS;

                    if (withinEpsilon && withinWindow) {
                        if (import.meta.env.DEV) {
                            console.info(
                                '[musicStore] suppressing transient playing update due to recent authoritative pause',
                                {
                                    pause,
                                    incoming: {
                                        sequenceNumber: meta.sequenceNumber,
                                        serverTimestamp: meta.serverTimestamp,
                                        currentTime: incomingTime,
                                    },
                                },
                            );
                        }
                        return {};
                    }
                    if (!isNaN(incomingTime) && incomingTime > pause.time + SEEK_THRESHOLD) {
                        return {
                            lastSequenceNumber: meta.sequenceNumber,
                            lastServerTimestamp: meta.serverTimestamp,
                            lastTraceId: meta.traceId,
                            remoteStatus: statusWithoutMeta,
                            lastAuthoritativePause: null,
                        };
                    }
                }

                const nextStatus: RemoteStatus = { ...statusWithoutMeta };
                if (nextStatus.type === 'playing' && state.remoteStatus?.type === 'playing') {
                    const incomingTime = typeof nextStatus.currentTime === 'number' ? nextStatus.currentTime : NaN;
                    const prevTime = typeof state.remoteStatus.currentTime === 'number'
                        ? state.remoteStatus.currentTime
                        : NaN;
                    const incomingId = nextStatus.musicId ?? nextStatus.videoId;
                    const prevId = state.remoteStatus.musicId ?? state.remoteStatus.videoId;

                    if (
                        typeof incomingId === 'string'
                        && incomingId.length > 0
                        && incomingId === prevId
                        && Number.isFinite(incomingTime)
                        && Number.isFinite(prevTime)
                    ) {
                        const delta = incomingTime - prevTime;
                        if (delta < -0.5 && Math.abs(delta) < SEEK_THRESHOLD) {
                            nextStatus.currentTime = prevTime;
                            if (typeof nextStatus.duration === 'number' && nextStatus.duration > 0)
                                nextStatus.progressPercent = Math.min((prevTime / nextStatus.duration) * 100, 100);
                        }
                    }
                }

                return {
                    lastSequenceNumber: meta.sequenceNumber,
                    lastServerTimestamp: meta.serverTimestamp,
                    lastTraceId: meta.traceId,
                    lastEventReceivedAt: Date.now(),
                    remoteStatus: nextStatus,
                };
            });
        } else {
            const { _meta, ...statusWithoutMeta } = incomingState;

            if (import.meta.env.DEV) {
                console.warn(
                    '[musicStore] received status without _meta (legacy format)',
                    statusWithoutMeta,
                );
            }
            const pausedCurrentTime = statusWithoutMeta.type === 'paused'
                ? statusWithoutMeta.currentTime
                : undefined;
            if (statusWithoutMeta.type === 'paused' && typeof pausedCurrentTime === 'number') {
                set(prev => ({
                    remoteStatus: statusWithoutMeta,
                    lastAuthoritativePause: {
                        time: pausedCurrentTime,
                        serverTimestamp: Date.now(),
                        sequenceNumber: prev.lastSequenceNumber,
                        traceId: '',
                        createdAt: Date.now(),
                    },
                }));
            } else {
                set({
                    remoteStatus: statusWithoutMeta,
                });
            }
        }
    };

    return {
        addMusic(music) {
            set(state => ({
                musics: [...state.musics, music],
            }));
        },
        connectSocket() {
            if (socket) return;
            socket = getSocket();
            set({ socket });
            const currentSocket = socket;

            let statusPollInterval: ReturnType<typeof setInterval> | null = null;
            let syncInFlight = false;
            let lastSyncAt = 0;

            const attemptGetAllMusics = (s: Socket<S2C, C2S>, maxAttempts = 3): Promise<SyncFetchResult> =>
                new Promise(resolve => {
                    let attempt = 0;
                    const tryOnce = () => {
                        attempt++;
                        let called = false;
                        const timeout = setTimeout(() => {
                            if (called) return;
                            called = true;
                            if (attempt < maxAttempts) {
                                const backoff = 500 * Math.pow(2, attempt - 1);
                                setTimeout(tryOnce, backoff);
                                return;
                            }
                            resolve({ source: 'musics', ok: false, attempts: attempt, reason: 'timeout' });
                        }, 2000);

                        try {
                            s.emit('getAllMusics', (musics: Music[] | undefined) => {
                                if (called) return;
                                called = true;
                                clearTimeout(timeout);
                                if (Array.isArray(musics)) set({ musics });
                                resolve({
                                    source: 'musics',
                                    ok: Array.isArray(musics),
                                    attempts: attempt,
                                    reason: Array.isArray(musics) ? undefined : 'invalid-payload',
                                });
                            });
                        } catch {
                            clearTimeout(timeout);
                            if (attempt < maxAttempts) {
                                const backoff = 500 * Math.pow(2, attempt - 1);
                                setTimeout(tryOnce, backoff);
                                return;
                            }
                            resolve({ source: 'musics', ok: false, attempts: attempt, reason: 'emit-error' });
                        }
                    };

                    tryOnce();
                });

            const attemptGetRemoteStatus = (s: Socket<S2C, C2S>, maxAttempts = 3): Promise<SyncFetchResult> =>
                new Promise(resolve => {
                    let attempt = 0;
                    const tryOnce = () => {
                        attempt++;
                        {
                            const state = useMusicStore.getState();
                            const timeSinceLastEvent = Date.now() - state.lastEventReceivedAt;
                            if (timeSinceLastEvent < REMOTE_STATUS_EVENT_GRACE_MS) {
                                resolve({
                                    source: 'remoteStatus',
                                    ok: true,
                                    attempts: attempt,
                                    reason: 'recent-event',
                                });
                                return;
                            }
                        }
                        let called = false;
                        const timeout = setTimeout(() => {
                            if (called) return;
                            called = true;
                            if (attempt < maxAttempts) {
                                const backoff = 500 * Math.pow(2, attempt - 1);
                                setTimeout(tryOnce, backoff);
                                return;
                            }
                            resolve({ source: 'remoteStatus', ok: false, attempts: attempt, reason: 'timeout' });
                        }, 2000);

                        try {
                            s.emit('getRemoteStatus', (status: unknown) => {
                                if (called) return;
                                called = true;
                                clearTimeout(timeout);
                                if (isRemoteStatusWithMetaShape(status)) {
                                    const state = useMusicStore.getState();
                                    const timeSinceLastEvent = Date.now() - state.lastEventReceivedAt;
                                    if (timeSinceLastEvent < REMOTE_STATUS_EVENT_GRACE_MS) {
                                        if (import.meta.env.DEV) {
                                            console.info(
                                                '[musicStore] skipping poll response, recent event received',
                                                { timeSinceLastEvent },
                                            );
                                        }
                                        resolve({
                                            source: 'remoteStatus',
                                            ok: true,
                                            attempts: attempt,
                                            reason: 'recent-event',
                                        });
                                        return;
                                    }
                                    handleRemoteStatusUpdate(status);
                                    resolve({ source: 'remoteStatus', ok: true, attempts: attempt });
                                    return;
                                }
                                resolve({
                                    source: 'remoteStatus',
                                    ok: false,
                                    attempts: attempt,
                                    reason: 'invalid-payload',
                                });
                            });
                        } catch {
                            clearTimeout(timeout);
                            if (attempt < maxAttempts) {
                                const backoff = 500 * Math.pow(2, attempt - 1);
                                setTimeout(tryOnce, backoff);
                                return;
                            }
                            resolve({ source: 'remoteStatus', ok: false, attempts: attempt, reason: 'emit-error' });
                        }
                    };

                    tryOnce();
                });

            const syncFromServer = async (s: Socket<S2C, C2S>) => {
                if (syncInFlight) return;
                const now = Date.now();
                if (now - lastSyncAt < SYNC_FETCH_MIN_INTERVAL_MS) return;

                syncInFlight = true;
                lastSyncAt = now;
                try {
                    const results = await Promise.all([
                        attemptGetAllMusics(s),
                        attemptGetRemoteStatus(s),
                    ]);
                    if (import.meta.env.DEV && results.some(result => !result.ok))
                        console.debug('[musicStore] syncFromServer partial failure', { results });
                } finally {
                    syncInFlight = false;
                }
            };

            currentSocket
                .on('connect', () => {
                    try {
                        void syncFromServer(currentSocket);
                    } catch (error) {
                        if (import.meta.env.DEV) console.debug('Initial data fetch failed', error);
                    }
                })
                .on('musicAdded', (music: Music) => {
                    set(state => ({
                        musics: [...state.musics, music],
                    }));
                })
                .on('musicRemoved', (musicId: string) => {
                    set(state => ({
                        musics: state.musics.filter(music => music.id !== musicId),
                    }));
                })
                .on('remoteStatusUpdated', (incomingState: RemoteStatusWithMeta) => {
                    handleRemoteStatusUpdate(incomingState);
                })
                .on('disconnect', () => {
                    if (statusPollInterval) {
                        clearInterval(statusPollInterval);
                        statusPollInterval = null;
                    }
                    syncInFlight = false;
                });

            currentSocket.io.on('reconnect_attempt', () => {
                try {
                    void syncFromServer(currentSocket);
                } catch {
                    if (import.meta.env.DEV) console.debug('reconnect_attempt data fetch failed');
                }
            });

            currentSocket.io.on('reconnect', () => {
                try {
                    void syncFromServer(currentSocket);
                } catch {
                    if (import.meta.env.DEV) console.debug('reconnect data fetch failed');
                }
            });

            currentSocket.connect();

            statusPollInterval = setInterval(() => {
                if (!currentSocket.connected) return;

                if (typeof document !== 'undefined' && document.hidden) {
                    const state = useMusicStore.getState();
                    if (Date.now() - state.lastEventReceivedAt < REMOTE_STATUS_POLL_INTERVAL_MS * 2) return;
                }

                void attemptGetRemoteStatus(currentSocket, 1);
            }, REMOTE_STATUS_POLL_INTERVAL_MS);
        },
        error: undefined,
        hydrateFromLocalStorage() {
            try {
                const storage: Storage | undefined = typeof window !== 'undefined'
                    ? window.localStorage
                    : (globalThis as { localStorage?: Storage }).localStorage;
                if (!storage) return;
                const raw = storage.getItem(STORAGE_KEY);
                if (!raw) return;
                const parsed = JSON.parse(raw) as unknown;
                if (!Array.isArray(parsed) || !parsed.every(isMusic)) return;
                set(state => {
                    if (state.musics.length > 0) return {};
                    return { musics: parsed };
                });
            } catch (error) {
                if (import.meta.env.DEV) console.debug('musicStore hydrateFromLocalStorage failed', error);
            }
        },
        lastSequenceNumber: 0,
        lastServerTimestamp: 0,
        lastTraceId: '',
        lastEventReceivedAt: 0,
        musics: [],
        remoteStatus: null,
        remoteStatusUpdated(incomingState: RemoteStatusWithMeta) {
            if (!isRemoteStatusWithMetaShape(incomingState)) {
                if (import.meta.env.DEV)
                    console.warn('[musicStore] ignored invalid remoteStatusUpdated payload', incomingState);
                return;
            }
            handleRemoteStatusUpdate(incomingState);
        },
        resetError: () => {
            set({ error: undefined });
        },
        setMusics(musics: Music[]) {
            try {
                if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(musics));
            } catch (error) {
                if (import.meta.env.DEV) console.debug('musicStore setMusics localStorage failed', error);
            }
            set({ musics });
        },
        socket: undefined,
    };
});
