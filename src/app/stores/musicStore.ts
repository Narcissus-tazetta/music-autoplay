import type { Music, RemoteStatus } from '@/shared/types/music';
import type { RemoteStatusWithMeta } from '@/shared/types/remoteStatus';
import type { C2S, S2C } from '@/shared/types/socket';
import type { Socket } from 'socket.io-client';
import { create } from 'zustand';
import { getSocket } from '../utils/socketClient';

const SEEK_THRESHOLD = 5;
const REMOTE_STATUS_POLL_INTERVAL_MS = 10_000;
const SYNC_FETCH_MIN_INTERVAL_MS = 1_500;
const REMOTE_STATUS_EVENT_GRACE_MS = 2_000;
const ACK_TIMEOUT_MS = 2_000;
const SYNC_MAX_ATTEMPTS = 3;

interface MusicStore {
    musics: Music[];
    socket: Socket<S2C, C2S> | null;
    remoteStatus: RemoteStatus | null;
    lastAuthoritativePause: {
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
    /** Once the socket has delivered a queue snapshot it outranks every other source. */
    hasServerSnapshot: boolean;

    addMusic(music: Music): void;
    connectSocket(): void;
    remoteStatusUpdated(incomingState: RemoteStatusWithMeta): void;
    seedMusics(musics: Music[]): void;
}

const getStatusCurrentTime = (status: RemoteStatus | null): number | undefined => {
    if (!status || status.type === 'closed') return undefined;
    return typeof status.currentTime === 'number' ? status.currentTime : undefined;
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

const delay = (ms: number) =>
    new Promise<void>(resolve => {
        setTimeout(resolve, ms);
    });

/**
 * `socket.timeout().emit()` only covers a single attempt, so a dropped ack has to be
 * retried here; `null` means "no usable answer this time".
 */
const withRetry = async <T>(
    attempt: () => Promise<T | null>,
    maxAttempts: number,
): Promise<T | null> => {
    for (let i = 0; i < maxAttempts; i++) {
        // oxlint-disable-next-line no-await-in-loop
        const value = await attempt();
        if (value !== null) return value;
        // oxlint-disable-next-line no-await-in-loop
        if (i + 1 < maxAttempts) await delay(500 * 2 ** i);
    }
    return null;
};

export const useMusicStore = create<MusicStore>(set => {
    let socket: Socket<S2C, C2S> | null = null;
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

    /** A poll answer must not overwrite an event that arrived while it was in flight. */
    const hasRecentEvent = () =>
        Date.now() - useMusicStore.getState().lastEventReceivedAt < REMOTE_STATUS_EVENT_GRACE_MS;

    const fetchAllMusics = (s: Socket<S2C, C2S>) =>
        withRetry(
            () =>
                new Promise<Music[] | null>(resolve => {
                    s.timeout(ACK_TIMEOUT_MS).emit(
                        'getAllMusics',
                        (error: Error | null, musics: Music[]) => {
                            resolve(!error && Array.isArray(musics) ? musics : null);
                        },
                    );
                }),
            SYNC_MAX_ATTEMPTS,
        ).then(musics => {
            if (musics) set({ musics, hasServerSnapshot: true });
        });

    const fetchRemoteStatus = (s: Socket<S2C, C2S>, maxAttempts = SYNC_MAX_ATTEMPTS) =>
        withRetry(
            () => {
                if (hasRecentEvent()) return Promise.resolve<'skipped'>('skipped');
                return new Promise<RemoteStatusWithMeta | 'skipped' | null>(resolve => {
                    s.timeout(ACK_TIMEOUT_MS).emit(
                        'getRemoteStatus',
                        (error: Error | null, status: unknown) => {
                            if (error || !isRemoteStatusWithMetaShape(status)) {
                                resolve(null);
                                return;
                            }
                            resolve(hasRecentEvent() ? 'skipped' : status);
                        },
                    );
                });
            },
            maxAttempts,
        ).then(status => {
            if (status && status !== 'skipped') handleRemoteStatusUpdate(status);
        });

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

            let syncInFlight = false;
            let lastSyncAt = 0;

            const syncFromServer = async () => {
                if (syncInFlight) return;
                const now = Date.now();
                if (now - lastSyncAt < SYNC_FETCH_MIN_INTERVAL_MS) return;

                syncInFlight = true;
                lastSyncAt = now;
                try {
                    await Promise.all([
                        fetchAllMusics(currentSocket),
                        fetchRemoteStatus(currentSocket),
                    ]);
                } finally {
                    syncInFlight = false;
                }
            };

            currentSocket
                .on('connect', () => {
                    void syncFromServer();
                })
                .on('musicAdded', (music: Music) => {
                    set(state => ({
                        musics: [...state.musics, music],
                        hasServerSnapshot: true,
                    }));
                })
                .on('musicRemoved', (musicId: string) => {
                    set(state => ({
                        musics: state.musics.filter(music => music.id !== musicId),
                        hasServerSnapshot: true,
                    }));
                })
                .on('queueReordered', (musics: Music[]) => {
                    set({ musics, hasServerSnapshot: true });
                })
                .on('remoteStatusUpdated', (incomingState: RemoteStatusWithMeta) => {
                    handleRemoteStatusUpdate(incomingState);
                })
                .on('disconnect', () => {
                    syncInFlight = false;
                });

            currentSocket.io.on('reconnect_attempt', () => {
                void syncFromServer();
            });

            currentSocket.io.on('reconnect', () => {
                void syncFromServer();
            });

            currentSocket.connect();

            // Deliberately never cleared: the callback skips while disconnected, so the safety
            // net still covers the session after a reconnect.
            setInterval(() => {
                if (!currentSocket.connected) return;

                // A backgrounded tab still receives events, so it only needs the poll once the
                // stream has actually gone quiet.
                const eventAge = Date.now() - useMusicStore.getState().lastEventReceivedAt;
                if (
                    typeof document !== 'undefined' && document.hidden && eventAge < REMOTE_STATUS_POLL_INTERVAL_MS * 2
                ) { return; }

                void fetchRemoteStatus(currentSocket, 1);
            }, REMOTE_STATUS_POLL_INTERVAL_MS);
        },
        hasServerSnapshot: false,
        lastAuthoritativePause: null,
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
        seedMusics(musics: Music[]) {
            set(state => (state.hasServerSnapshot ? {} : { musics }));
        },
        socket: null,
    };
});
