import type { RemoteStatusWithMeta } from '@/shared/types/remoteStatus';
import type { C2S, S2C } from '@/shared/types/socket';
import type { Socket } from 'socket.io-client';
import { create } from 'zustand';
import { getSocket } from '../../app/utils/socketClient';

const SEEK_THRESHOLD = 5;

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

export const useMusicStore = create<MusicStore>(set => {
    let socket: Socket<S2C, C2S> | null;
    const STORAGE_KEY = 'music-auto-play:musics:v1';

    // Extracted logic for handling remote status updates
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

                if (isStale || isTooOld) {
                    if (import.meta.env.DEV) {
                        const log = isDuplicateByTraceId ? console.info : console.warn;
                        log('[musicStore] ignoring stale update', {
                            currentSeq: state.lastSequenceNumber,
                            currentTimestamp: state.lastServerTimestamp,
                            incomingSeq: meta.sequenceNumber,
                            incomingTimestamp: meta.serverTimestamp,
                            isStale,
                            isTooOld,
                            isDuplicateByTraceId,
                            traceId: meta.traceId,
                        });
                    }
                    return {};
                }

                const { _meta, ...statusWithoutMeta } = incomingState;

                if (import.meta.env.DEV) {
                    console.info('[musicStore] remoteStatusUpdated', {
                        sequenceNumber: meta.sequenceNumber,
                        serverTimestamp: meta.serverTimestamp,
                        traceId: meta.traceId,
                        type: statusWithoutMeta.type,
                    });
                }

                const PAUSE_TTL_MS = 60_000;
                const PAUSE_ACCEPT_WINDOW_MS = 5_000;
                const PAUSE_EPSILON_S = 0.5;

                // record authoritative pause
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

                    // paused but no explicit currentTime: fall back to previous known currentTime if available
                    const fallbackTime = (state.remoteStatus
                            && (state.remoteStatus.type === 'playing' || state.remoteStatus.type === 'paused')
                            && typeof (state.remoteStatus as any).currentTime === 'number')
                        ? (state.remoteStatus as any).currentTime
                        : undefined;

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

                // if recent authoritative pause exists, suppress transient playing updates that are within epsilon and time window
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
                    // if incoming playing is clearly ahead, clear pause
                    if (!isNaN(incomingTime) && incomingTime > pause.time + SEEK_THRESHOLD) {
                        // clear pause and accept
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
            if (statusWithoutMeta.type === 'paused' && typeof statusWithoutMeta.currentTime === 'number') {
                set(prev => ({
                    remoteStatus: statusWithoutMeta,
                    lastAuthoritativePause: {
                        time: statusWithoutMeta.currentTime as number,
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

            let statusPollInterval: ReturnType<typeof setInterval> | null = null;

            const attemptGetAllMusics = (s: Socket<S2C, C2S>, maxAttempts = 3) => {
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
                        }
                    }, 2000);

                    try {
                        s.emit('getAllMusics', (musics: Music[] | undefined) => {
                            if (called) return;
                            called = true;
                            clearTimeout(timeout);
                            if (Array.isArray(musics)) set({ musics });
                        });
                    } catch {
                        if (attempt < maxAttempts) {
                            const backoff = 500 * Math.pow(2, attempt - 1);
                            setTimeout(tryOnce, backoff);
                        }
                    }
                };

                tryOnce();
            };

            const attemptGetRemoteStatus = (s: Socket<S2C, C2S>, maxAttempts = 3) => {
                let attempt = 0;
                const tryOnce = () => {
                    attempt++;
                    {
                        const state = useMusicStore.getState();
                        const timeSinceLastEvent = Date.now() - state.lastEventReceivedAt;
                        if (timeSinceLastEvent < 2000) return;
                    }
                    let called = false;
                    const timeout = setTimeout(() => {
                        if (called) return;
                        called = true;
                        if (attempt < maxAttempts) {
                            const backoff = 500 * Math.pow(2, attempt - 1);
                            setTimeout(tryOnce, backoff);
                        }
                    }, 2000);

                    try {
                        s.emit('getRemoteStatus', (status: RemoteStatus | undefined) => {
                            if (called) return;
                            called = true;
                            clearTimeout(timeout);
                            if (import.meta.env.DEV) console.info('[musicStore] getRemoteStatus response:', status);
                            if (status && typeof status === 'object' && 'type' in status) {
                                const state = useMusicStore.getState();
                                const timeSinceLastEvent = Date.now() - state.lastEventReceivedAt;
                                if (timeSinceLastEvent < 2000) {
                                    if (import.meta.env.DEV) {
                                        console.info(
                                            '[musicStore] skipping poll response, recent event received',
                                            { timeSinceLastEvent },
                                        );
                                    }
                                    return;
                                }
                                handleRemoteStatusUpdate(status as RemoteStatusWithMeta);
                            }
                        });
                    } catch {
                        if (attempt < maxAttempts) {
                            const backoff = 500 * Math.pow(2, attempt - 1);
                            setTimeout(tryOnce, backoff);
                        }
                    }
                };

                tryOnce();
            };

            socket
                .on('connect', () => {
                    if (import.meta.env.DEV) console.info('Socket connected');
                    try {
                        attemptGetAllMusics(socket as Socket<S2C, C2S>);
                        attemptGetRemoteStatus(socket as Socket<S2C, C2S>);
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
                });

            const socketAny = socket as unknown;
            if (
                typeof socketAny === 'object'
                && socketAny !== null
                && 'on' in socketAny
            ) {
                const s = socketAny as {
                    on: (
                        event: string,
                        listener: (...args: unknown[]) => void,
                    ) => unknown;
                };
                s.on('reconnect_attempt', () => {
                    try {
                        attemptGetAllMusics(socket as Socket<S2C, C2S>);
                        attemptGetRemoteStatus(socket as Socket<S2C, C2S>);
                    } catch {
                        if (import.meta.env.DEV) console.debug('reconnect_attempt data fetch failed');
                    }
                });
                s.on('reconnect', () => {
                    try {
                        attemptGetAllMusics(socket as Socket<S2C, C2S>);
                        attemptGetRemoteStatus(socket as Socket<S2C, C2S>);
                    } catch {
                        if (import.meta.env.DEV) console.debug('reconnect data fetch failed');
                    }
                });
            }

            socket.connect();

            statusPollInterval = setInterval(() => {
                if (socket && socket.connected) attemptGetRemoteStatus(socket as Socket<S2C, C2S>, 1);
            }, 5000);
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
                if (!Array.isArray(parsed)) return;
                set(state => {
                    if (state.musics.length > 0) return {} as Partial<MusicStore>;
                    return { musics: parsed as Music[] } as Partial<MusicStore>;
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
