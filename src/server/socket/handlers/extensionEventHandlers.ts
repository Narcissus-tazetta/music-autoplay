import type { Music, RemoteStatus } from '@/shared/stores/musicStore';
import { isRecord } from '@/shared/utils/typeGuards';
import { extractYoutubeId } from '@/shared/utils/youtube';
import type { Socket } from 'socket.io';
import { getHistoryService, type HistoryService } from '../../history/historyService';
import type { AppLogger } from '../../logger';
import type { MusicEventEmitter } from '../../music/emitter/musicEventEmitter';
import type { MusicRepository } from '../../music/repository/musicRepository';
import type { YouTubeService } from '../../services/youtubeService';
import type { SocketManager } from '../managers/manager';
import { registerSocketEventSafely } from '../utils/eventRegistration';
import { extractSocketOn } from '../utils/socketHelpers';

type ProgressSnapshot = {
    timestamp: number;
    seq?: number;
    currentTime: number;
    duration: number;
    progressPercent?: number;
    playbackRate?: number;
    isBuffering?: boolean;
    consecutiveStalls?: number;
    isAdvertisement?: boolean;
    musicTitle?: string;
    clientLatencyMs?: number;
};

const shouldReplaceProgressSnapshot = (prev: ProgressSnapshot | undefined, next: ProgressSnapshot): boolean => {
    if (!prev) return true;
    if (next.timestamp > prev.timestamp) return true;
    if (next.timestamp < prev.timestamp) return false;

    const prevSeq = typeof prev.seq === 'number' ? prev.seq : -Infinity;
    const nextSeq = typeof next.seq === 'number' ? next.seq : -Infinity;
    return nextSeq > prevSeq;
};

const AUTHORITATIVE_PAUSE_HOLD_MS = 3000;
const AUTHORITATIVE_PLAYING_PROMOTION_MS = 3000;
const AUTHORITATIVE_RESUME_EPSILON_SEC = 0.75;

const isSameVideoOrUnknown = (
    current: RemoteStatus,
    videoId: string,
): boolean => {
    if (current.type !== 'playing' && current.type !== 'paused') return false;

    // Backward-compatible: some callers/tests return a minimal currentStatus without IDs.
    if (!current.musicId && !current.videoId) return true;

    return current.musicId === videoId || current.videoId === videoId;
};

export function setupExtensionEventHandlers(
    socket: Socket,
    log: AppLogger,
    connectionId: string,
    musicDB: Map<string, Music>,
    manager: SocketManager,
    repository: MusicRepository,
    emitter: MusicEventEmitter,
    youtubeService: YouTubeService,
    historyService: HistoryService = getHistoryService(),
) {
    const extensionSocketOn = extractSocketOn(socket);
    const socketContext = { socketId: socket.id };

    const recordHistory = (music: Music | undefined, reason: string) => {
        if (!music) return;
        try {
            const historyItem = historyService.recordPlayed(music);
            const emitResult = emitter.emitHistoryAdded(historyItem);
            if (!emitResult.ok) {
                log.warn('historyAdded emit failed', {
                    error: emitResult.error,
                    musicId: music.id,
                    reason,
                });
            }
        } catch (error) {
            log.warn('history record failed', {
                error,
                musicId: music.id,
                reason,
            });
        }
    };

    socket.on('disconnect', reason => {
        try {
            const current = manager.getCurrent();
            if (current.type === 'closed') return;
            manager.update({ type: 'closed' }, 'extension_disconnect');

            authoritativeVideoState.clear();
            lastProgressSnapshotByVideoId.clear();
            lastAdSnapshotByVideoId.clear();
            videoEndDebounce.clear();
            pendingNextByTabId.clear();
            progressState.clear();
            socket.removeAllListeners();

            log.info('extension socket disconnected: scheduled remote closed', {
                connectionId,
                reason,
                socketId: socket.id,
            });
        } catch (error) {
            log.warn('extension disconnect handler failed', {
                connectionId,
                error: error,
                socketId: socket.id,
            });
        }
    });

    const authoritativeVideoState = new Map<
        string,
        {
            state: 'playing' | 'paused';
            receivedAt: number;
            seq?: number;
            currentTime?: number;
            duration?: number;
        }
    >();

    const shouldIgnorePlayingFromStaleAuthoritative = (
        videoId: string | undefined,
        incoming: {
            seq?: number;
            currentTime?: number;
        },
    ): boolean => {
        if (!videoId) return false;
        const authoritative = authoritativeVideoState.get(videoId);
        if (!authoritative || authoritative.state !== 'paused') return false;

        const now = Date.now();
        if (now - authoritative.receivedAt > AUTHORITATIVE_PAUSE_HOLD_MS) return false;

        const hasSeq = typeof incoming.seq === 'number' && typeof authoritative.seq === 'number';
        const seqLooksStale = hasSeq
            ? (incoming.seq as number) <= (authoritative.seq as number)
            : true;

        const hasTime = typeof incoming.currentTime === 'number' && typeof authoritative.currentTime === 'number';
        const timeLooksStale = hasTime
            ? (incoming.currentTime as number)
                <= (authoritative.currentTime as number) + AUTHORITATIVE_RESUME_EPSILON_SEC
            : true;

        return seqLooksStale && timeLooksStale;
    };

    const lastProgressSnapshotByVideoId = new Map<string, ProgressSnapshot>();
    const lastAdSnapshotByVideoId = new Map<string, { isAdvertisement: boolean; adTimestamp?: number }>();

    registerSocketEventSafely(
        extensionSocketOn,
        'extension_heartbeat',
        data => {
            log.debug('extension heartbeat received', {
                data,
                socketId: socket.id,
                timestamp: new Date().toISOString(),
            });
            try {
                const current = manager.getCurrent();
                manager.update(current, 'extension_heartbeat');
            } catch (error) {
                log.warn('extension_heartbeat: failed to update manager', { error });
            }
        },
        log,
        socketContext,
    );

    registerSocketEventSafely(
        extensionSocketOn,
        'extension_connected',
        data => {
            log.info('extension connected event', {
                extensionData: data,
                socketId: socket.id,
                timestamp: new Date().toISOString(),
            });
        },
        log,
        socketContext,
    );

    registerSocketEventSafely(
        extensionSocketOn,
        'tabs_sync',
        data => {
            log.debug('extension tabs sync', {
                socketId: socket.id,
                tabCount: Array.isArray(data) ? data.length : 0,
                timestamp: new Date().toISOString(),
            });
        },
        log,
        socketContext,
    );

    registerSocketEventSafely(
        extensionSocketOn,
        'youtube_video_state',
        async payload => {
            if (!isRecord(payload)) {
                log.debug('youtube_video_state: ignored invalid payload', { payload });
                return;
            }

            const stateRaw = payload['state'] as string | undefined;
            const url = typeof payload['url'] === 'string' ? payload['url'] : undefined;
            const isAdvertisement = payload['isAdvertisement'] === true;
            const incomingSeq = typeof payload['seq'] === 'number' ? payload['seq'] : undefined;
            const incomingCurrentTime = typeof payload['currentTime'] === 'number'
                ? payload['currentTime']
                : undefined;
            const incomingDuration = typeof payload['duration'] === 'number'
                ? payload['duration']
                : undefined;

            if (stateRaw === 'window_close') {
                const status: RemoteStatus = { type: 'closed' };
                try {
                    manager.update(status, 'extension');
                    log.info(
                        'youtube_video_state processed: window_close -> remote closed',
                        {
                            connectionId,
                            socketId: socket.id,
                        },
                    );
                } catch (error) {
                    log.warn('failed to update remote status (window_close)', {
                        error: error,
                    });
                }
                return;
            }

            if (stateRaw === 'transitioning') {
                const transitionStatus: RemoteStatus = {
                    isTransitioning: true,
                    musicId: undefined,
                    musicTitle: undefined,
                    type: 'paused',
                };
                try {
                    manager.update(transitionStatus, 'transitioning');
                    log.info('youtube_video_state: transitioning to next video', {
                        connectionId,
                        socketId: socket.id,
                        url,
                    });
                } catch (error) {
                    log.warn('failed to update remote status (transitioning)', {
                        error: error,
                    });
                }
                return;
            }

            if (stateRaw === 'ended') {
                if (url) {
                    const videoId = extractYoutubeId(url);
                    const music = videoId ? repository.get(videoId) : undefined;

                    // Avoid leaving remoteStatus stuck in 'playing' if video_ended is missed.
                    if (videoId) {
                        try {
                            manager.update(
                                {
                                    type: 'paused',
                                    isTransitioning: true,
                                    currentTime: incomingCurrentTime,
                                    duration: incomingDuration,
                                    musicId: music ? videoId : undefined,
                                    musicTitle: music?.title,
                                    videoId: videoId,
                                },
                                'youtube_video_state:ended',
                            );
                        } catch (error) {
                            log.warn('failed to update remote status (ended -> paused)', { error });
                        }
                    }
                }
                return;
            }

            if (stateRaw === 'playing' || stateRaw === 'paused') {
                // 広告保護ロジックは不要（Extension側でisAdvertisementフラグを付与）

                const state = stateRaw === 'playing' ? 'playing' : 'paused';

                const resolvedVideoIdForGuard = url
                    ? (extractYoutubeId(url) ?? undefined)
                    : undefined;
                if (
                    state === 'playing'
                    && shouldIgnorePlayingFromStaleAuthoritative(resolvedVideoIdForGuard, {
                        seq: incomingSeq,
                        currentTime: incomingCurrentTime,
                    })
                ) {
                    log.debug('youtube_video_state: stale playing ignored after authoritative pause', {
                        currentTime: incomingCurrentTime,
                        seq: incomingSeq,
                        url,
                        videoId: resolvedVideoIdForGuard,
                    });
                    return;
                }

                log.debug(`youtube_video_state: received ${state}`, {
                    currentTime: incomingCurrentTime,
                    duration: incomingDuration,
                    url,
                });

                let match: { url: string; title?: string } | null = null;
                let isExternalVideo = false;
                let externalVideoId: string | undefined;

                if (url) {
                    const { watchUrl } = await import('@/shared/utils/youtube');

                    for (const m of musicDB.values()) {
                        try {
                            const generated = watchUrl((m as { id: string }).id);
                            if (generated === url) {
                                match = {
                                    title: (m as { title: string }).title,
                                    url: generated,
                                };
                                break;
                            }
                        } catch {
                            continue;
                        }
                    }

                    if (!match) {
                        const videoId = extractYoutubeId(url);
                        if (videoId) {
                            isExternalVideo = true;
                            externalVideoId = videoId;
                            try {
                                log.debug('Fetching external video details', { state, url, videoId });
                                const result = await youtubeService.getVideoDetails(
                                    videoId,
                                    1,
                                    2000,
                                );

                                if (result.ok) {
                                    match = {
                                        title: result.value.title,
                                        url,
                                    };
                                    log.info('External video title fetched', {
                                        state,
                                        title: result.value.title,
                                        videoId,
                                    });
                                } else {
                                    log.warn('Failed to fetch external video details', {
                                        error: result.error,
                                        state,
                                        videoId,
                                    });
                                    match = {
                                        title: `動画ID: ${videoId}`,
                                        url,
                                    };
                                }
                            } catch (error) {
                                log.warn('Exception while fetching external video details', {
                                    error: error,
                                    state,
                                    videoId,
                                });
                                match = {
                                    title: `動画ID: ${videoId}`,
                                    url,
                                };
                            }
                        }
                    }

                    log.debug('youtube_video_state: match result', {
                        hasMatch: !!match,
                        matchTitle: match?.title,
                        state,
                        url,
                        videoId: externalVideoId,
                    });
                }

                const resolvedVideoId = resolvedVideoIdForGuard
                    ? resolvedVideoIdForGuard
                    : undefined;
                const progressSnapshot = resolvedVideoId
                    ? lastProgressSnapshotByVideoId.get(resolvedVideoId)
                    : undefined;
                const adSnapshot = resolvedVideoId
                    ? lastAdSnapshotByVideoId.get(resolvedVideoId)
                    : undefined;

                const mergedTitle = (match?.title && match.title.length > 0)
                    ? match.title
                    : (progressSnapshot?.musicTitle && progressSnapshot.musicTitle.length > 0)
                    ? progressSnapshot.musicTitle
                    : (resolvedVideoId ? `動画ID: ${resolvedVideoId}` : '');

                const mergedCurrentTime = incomingCurrentTime
                    ?? progressSnapshot?.currentTime;
                const mergedDuration = incomingDuration
                    ?? progressSnapshot?.duration;

                const remoteStatus: RemoteStatus = state === 'playing'
                    ? {
                        type: 'playing',
                        musicId: resolvedVideoId,
                        videoId: resolvedVideoId,
                        musicTitle: mergedTitle,
                        isExternalVideo,
                        isAdvertisement: adSnapshot?.isAdvertisement ?? isAdvertisement,
                        adTimestamp: adSnapshot?.adTimestamp,
                        currentTime: mergedCurrentTime,
                        duration: mergedDuration,
                        progressPercent: progressSnapshot?.progressPercent,
                        lastProgressUpdate: progressSnapshot?.timestamp,
                        consecutiveStalls: progressSnapshot?.consecutiveStalls,
                        playbackRate: progressSnapshot?.playbackRate,
                        isBuffering: progressSnapshot?.isBuffering,
                    }
                    : {
                        type: 'paused',
                        musicId: resolvedVideoId,
                        videoId: resolvedVideoId,
                        musicTitle: mergedTitle || undefined,
                        currentTime: mergedCurrentTime,
                        duration: mergedDuration,
                        playbackRate: progressSnapshot?.playbackRate,
                    };

                if (url) {
                    const videoId = extractYoutubeId(url);
                    if (videoId) {
                        authoritativeVideoState.set(videoId, {
                            state,
                            receivedAt: Date.now(),
                            seq: incomingSeq,
                            currentTime: incomingCurrentTime,
                            duration: incomingDuration,
                        });
                        log.debug(`youtube_video_state: set authoritative ${state}`, {
                            currentTime: incomingCurrentTime,
                            videoId,
                            seq: incomingSeq,
                        });
                    }
                }

                try {
                    manager.update(remoteStatus, 'extension');
                    log.info('youtube_video_state processed', {
                        connectionId,
                        isAdvertisement: state === 'playing' ? isAdvertisement : undefined,
                        isExternalVideo,
                        matched: !!match,
                        socketId: socket.id,
                        state: stateRaw,
                        url,
                    });
                } catch (error) {
                    log.warn('failed to update remote status (playing/paused)', {
                        error: error,
                    });
                }

                if (
                    state === 'paused'
                    && !isAdvertisement
                    && typeof mergedCurrentTime === 'number'
                    && typeof mergedDuration === 'number'
                    && mergedDuration > 0
                    && Math.abs(mergedCurrentTime - mergedDuration) < 0.5
                    && resolvedVideoId
                    && repository.has(resolvedVideoId)
                ) {
                    const preList = repository.list();
                    const preIdx = preList.findIndex(m => m.id === resolvedVideoId);
                    if (preIdx === -1) return;
                    const endedMusic = preList[preIdx];

                    let nextId: string | undefined;
                    if (preList.length > 1) {
                        let nIdx = preIdx + 1;
                        if (nIdx >= preList.length) nIdx = 0;
                        nextId = preList[nIdx].id;
                    }

                    const rmRes = repository.remove(resolvedVideoId);
                    if (rmRes.ok) {
                        recordHistory(endedMusic, 'paused_ended');
                        emitter.emitMusicRemoved(resolvedVideoId);
                        emitter.emitUrlList(repository.buildCompatList());
                        repository.persistRemove(resolvedVideoId);

                        const postList = repository.list();
                        if (postList.length === 0) {
                            socket.emit('no_next_video', { tabId: -1 });
                            manager.update({ type: 'closed' }, 'paused_100_no_next');
                            log.info('paused+100%: no next video', { videoId: resolvedVideoId });
                        } else {
                            const nextMusic = nextId
                                ? postList.find(m => m.id === nextId) ?? postList[0]
                                : postList[0];
                            if (nextMusic) {
                                const { watchUrl } = await import('@/shared/utils/youtube');
                                const nextUrl = watchUrl(nextMusic.id);
                                socket.emit('next_video_navigate', {
                                    nextUrl,
                                    videoId: nextMusic.id,
                                    tabId: -1,
                                });
                                manager.update(
                                    {
                                        type: 'paused',
                                        isTransitioning: true,
                                        musicId: nextMusic.id,
                                        musicTitle: nextMusic.title,
                                    },
                                    'paused_100_navigate',
                                );
                                log.info('paused+100%: auto-navigate', {
                                    from: resolvedVideoId,
                                    to: nextMusic.id,
                                });
                            }
                        }
                    }
                }
                return;
            }

            log.debug('youtube_video_state: unknown state value', {
                payload,
                state: stateRaw,
            });
        },
        log,
        socketContext,
    );

    registerSocketEventSafely(
        extensionSocketOn,
        'delete_url',
        async (url: unknown) => {
            if (typeof url !== 'string') {
                log.debug('delete_url: invalid url type', { type: typeof url, url });
                return;
            }

            try {
                const videoId = extractYoutubeId(url);

                if (!videoId) {
                    log.debug('delete_url: could not extract video ID', { url });
                    return;
                }

                if (repository.has(videoId)) {
                    const removeResult = repository.remove(videoId);
                    if (removeResult.ok) {
                        const emitResult = emitter.emitMusicRemoved(videoId);
                        if (!emitResult.ok) {
                            log.warn('delete_url: failed to emit musicRemoved', {
                                error: emitResult.error,
                                videoId,
                            });
                        }

                        const urlListEmitResult = emitter.emitUrlList(
                            repository.buildCompatList(),
                        );
                        if (!urlListEmitResult.ok) {
                            log.warn('delete_url: failed to emit url_list', {
                                error: urlListEmitResult.error,
                            });
                        }

                        const persistResult = repository.persistRemove(videoId);
                        if (!persistResult.ok) {
                            log.warn('delete_url: failed to persist removal', {
                                error: persistResult.error,
                                videoId,
                            });
                        }
                        log.info('delete_url: music removed', {
                            connectionId,
                            socketId: socket.id,
                            url,
                            videoId,
                        });
                    } else {
                        log.warn('delete_url: failed to remove music', {
                            error: removeResult.error,
                            videoId,
                        });
                    }
                } else {
                    log.debug('delete_url: video not in database', {
                        socketId: socket.id,
                        url,
                        videoId,
                    });
                }
            } catch (error) {
                log.warn('delete_url: failed to process', {
                    error: error,
                    socketId: socket.id,
                    url,
                });
            }
        },
        log,
        socketContext,
    );

    registerSocketEventSafely(
        extensionSocketOn,
        'move_prev_video',
        async payload => {
            if (!isRecord(payload)) {
                log.debug('move_prev_video: invalid payload', { payload });
                return;
            }

            const currentUrl = typeof payload['url'] === 'string' ? payload['url'] : undefined;
            const tabId = typeof payload['tabId'] === 'number' ? payload['tabId'] : undefined;

            if (!currentUrl) {
                log.debug('move_prev_video: no url provided', { payload });
                return;
            }

            if (!tabId) {
                log.debug('move_prev_video: no tabId provided', { payload });
                return;
            }

            try {
                const currentId = extractYoutubeId(currentUrl);

                if (!currentId) {
                    log.debug('move_prev_video: invalid YouTube URL', { currentUrl });
                    return;
                }

                const musicList = repository.list();
                const currentIndex = musicList.findIndex(m => m.id === currentId);

                if (currentIndex === -1) {
                    log.debug('move_prev_video: current music not found', { currentId });
                    return;
                }

                const prevIndex = currentIndex === 0 ? musicList.length - 1 : currentIndex - 1;
                const prevMusic = musicList[prevIndex];

                const { watchUrl } = await import('@/shared/utils/youtube');
                const nextUrl = watchUrl(prevMusic.id);

                socket.emit('next_video_navigate', {
                    nextUrl: nextUrl,
                    tabId: tabId,
                    videoId: prevMusic.id,
                });

                manager.update(
                    {
                        isTransitioning: true,
                        musicId: prevMusic.id,
                        musicTitle: prevMusic.title,
                        type: 'paused',
                    },
                    'move_prev_video',
                );

                log.info('move_prev_video: navigating to previous', {
                    connectionId,
                    from: currentId,
                    nextUrl,
                    prevIndex,
                    socketId: socket.id,
                    tabId,
                    to: prevMusic.id,
                });
            } catch (error) {
                log.warn('move_prev_video: failed to process', {
                    currentUrl,
                    error: error,
                    socketId: socket.id,
                });
            }
        },
        log,
        socketContext,
    );

    registerSocketEventSafely(
        extensionSocketOn,
        'move_next_video',
        async payload => {
            if (!isRecord(payload)) {
                log.debug('move_next_video: invalid payload', { payload });
                return;
            }

            const currentUrl = typeof payload['url'] === 'string' ? payload['url'] : undefined;
            const tabId = typeof payload['tabId'] === 'number' ? payload['tabId'] : undefined;

            if (!currentUrl) {
                log.debug('move_next_video: no url provided', { payload });
                return;
            }

            if (!tabId) {
                log.debug('move_next_video: no tabId provided', { payload });
                return;
            }

            try {
                const currentId = extractYoutubeId(currentUrl);

                if (!currentId) {
                    log.debug('move_next_video: invalid YouTube URL', { currentUrl });
                    return;
                }

                const musicList = repository.list();
                const currentIndex = musicList.findIndex(m => m.id === currentId);

                if (currentIndex === -1) {
                    log.debug('move_next_video: current music not found', { currentId });
                    return;
                }

                const nextIndex = (currentIndex + 1) % musicList.length;
                const nextMusic = musicList[nextIndex];

                const { watchUrl } = await import('@/shared/utils/youtube');
                const nextUrl = watchUrl(nextMusic.id);

                socket.emit('next_video_navigate', {
                    nextUrl: nextUrl,
                    tabId: tabId,
                    videoId: nextMusic.id,
                });

                manager.update(
                    {
                        isTransitioning: true,
                        musicId: nextMusic.id,
                        musicTitle: nextMusic.title,
                        type: 'paused',
                    },
                    'move_next_video',
                );

                log.info('move_next_video: navigating to next', {
                    connectionId,
                    from: currentId,
                    nextIndex,
                    nextUrl,
                    socketId: socket.id,
                    tabId,
                    to: nextMusic.id,
                });
            } catch (error) {
                log.warn('move_next_video: failed to process', {
                    currentUrl,
                    error: error,
                    socketId: socket.id,
                });
            }
        },
        log,
        socketContext,
    );

    registerSocketEventSafely(
        extensionSocketOn,
        'tab_closed',
        payload => {
            if (!isRecord(payload)) {
                log.debug('tab_closed: invalid payload', { payload });
                return;
            }

            const tabId = typeof payload['tabId'] === 'number' ? payload['tabId'] : undefined;

            log.info('tab_closed: tab closure detected', {
                connectionId,
                socketId: socket.id,
                tabId,
                timestamp: new Date().toISOString(),
            });

            try {
                const current = manager.getCurrent();
                if (current.type !== 'closed') manager.update({ type: 'closed' }, 'tab_closed');
                log.debug('tab_closed: cleanup completed', {
                    socketId: socket.id,
                    tabId,
                });
            } catch (error) {
                log.warn('tab_closed: cleanup failed', {
                    error: error,
                    socketId: socket.id,
                    tabId,
                });
            }
        },
        log,
        socketContext,
    );

    registerSocketEventSafely(
        extensionSocketOn,
        'ad_state_changed',
        async payload => {
            if (!isRecord(payload)) {
                log.debug('ad_state_changed: invalid payload', { payload });
                return;
            }

            const url = typeof payload['url'] === 'string' ? payload['url'] : undefined;
            const isAd = typeof payload['isAd'] === 'boolean' ? payload['isAd'] : false;
            const timestamp = typeof payload['timestamp'] === 'number'
                ? payload['timestamp']
                : Date.now();

            if (!url) {
                log.debug('ad_state_changed: no url provided', { payload });
                return;
            }

            try {
                const videoId = extractYoutubeId(url);

                if (!videoId) {
                    log.debug('ad_state_changed: invalid YouTube URL', { url });
                    return;
                }

                log.info('ad_state_changed: advertisement state changed', {
                    connectionId,
                    isAd,
                    socketId: socket.id,
                    timestamp: new Date(timestamp).toISOString(),
                    videoId,
                });

                lastAdSnapshotByVideoId.set(videoId, {
                    isAdvertisement: isAd,
                    adTimestamp: isAd ? timestamp : undefined,
                });

                const currentStatus = manager.getCurrent();
                if (currentStatus.type !== 'playing') return;
                if (!isSameVideoOrUnknown(currentStatus, videoId)) return;

                manager.update(
                    {
                        ...currentStatus,
                        isAdvertisement: isAd,
                        adTimestamp: isAd ? timestamp : undefined,
                        musicId: currentStatus.musicId ?? videoId,
                        videoId: currentStatus.videoId ?? videoId,
                    },
                    isAd ? 'ad_started' : 'ad_ended',
                );
            } catch (error) {
                log.warn('ad_state_changed: failed to process', {
                    error: error,
                    isAd,
                    socketId: socket.id,
                    url,
                });
            }
        },
        log,
        socketContext,
    );

    const videoEndDebounce = new Map<string, number>();
    const VIDEO_END_DEBOUNCE_MS = 500;
    const pendingNextByTabId = new Map<number, { videoId: string; nextCandidateId?: string; createdAt: number }>();
    const PENDING_NEXT_TTL_MS = 15000;

    registerSocketEventSafely(
        extensionSocketOn,
        'video_ended',
        async payload => {
            if (!isRecord(payload)) {
                log.debug('video_ended: invalid payload', { payload });
                return;
            }

            const url = typeof payload['url'] === 'string' ? payload['url'] : undefined;
            const tabId = typeof payload['tabId'] === 'number' ? payload['tabId'] : undefined;

            if (!url) {
                log.debug('video_ended: no url provided', { payload });
                return;
            }

            if (!tabId) {
                log.debug('video_ended: no tabId provided', { payload });
                return;
            }

            try {
                const videoId = extractYoutubeId(url);

                if (!videoId) {
                    log.debug('video_ended: invalid YouTube URL', { url });
                    return;
                }

                const now = Date.now();
                const lastProcessed = videoEndDebounce.get(videoId);
                if (lastProcessed && now - lastProcessed < VIDEO_END_DEBOUNCE_MS) {
                    log.debug('video_ended: debounced duplicate', { videoId, elapsed: now - lastProcessed });
                    return;
                }
                videoEndDebounce.set(videoId, now);
                setTimeout(() => videoEndDebounce.delete(videoId), VIDEO_END_DEBOUNCE_MS * 2);

                log.info('video_ended: received', {
                    connectionId,
                    socketId: socket.id,
                    tabId,
                    videoId,
                    repositoryLength: repository.list().length,
                });

                // Determine the next music based on the pre-remove ordering so we
                // advance to the element *after* the ended video (wrap if needed).
                const preRemoveList = repository.list();
                const preIndex = preRemoveList.findIndex(m => m.id === videoId);
                let nextCandidateId: string | undefined;
                const endedMusic = preIndex !== -1 ? preRemoveList[preIndex] : undefined;

                if (preIndex === -1) {
                    log.info('video_ended: ignored (video not in repository)', {
                        connectionId,
                        socketId: socket.id,
                        tabId,
                        videoId,
                    });
                    return;
                }

                if (preRemoveList.length > 1 && preIndex !== -1) {
                    let nextIndex = preIndex + 1;
                    if (nextIndex >= preRemoveList.length) nextIndex = 0;
                    nextCandidateId = preRemoveList[nextIndex].id;
                }

                pendingNextByTabId.set(tabId, {
                    videoId,
                    nextCandidateId,
                    createdAt: Date.now(),
                });

                const removeResult = repository.remove(videoId);
                if (removeResult.ok) {
                    recordHistory(endedMusic, 'video_ended');
                    const emitResult = emitter.emitMusicRemoved(videoId);
                    if (!emitResult.ok) {
                        log.warn('video_ended: failed to emit musicRemoved', {
                            error: emitResult.error,
                            videoId,
                        });
                    }

                    const urlListEmitResult = emitter.emitUrlList(
                        repository.buildCompatList(),
                    );
                    if (!urlListEmitResult.ok) {
                        log.warn('video_ended: failed to emit url_list', {
                            error: urlListEmitResult.error,
                        });
                    }

                    const persistResult = repository.persistRemove(videoId);
                    if (!persistResult.ok) {
                        log.warn('video_ended: failed to persist removal', {
                            error: persistResult.error,
                            videoId,
                        });
                    }
                } else {
                    log.warn('video_ended: failed to remove music', {
                        error: removeResult.error,
                        videoId,
                    });
                    pendingNextByTabId.delete(tabId);
                    return;
                }
            } catch (error) {
                log.warn('video_ended: failed to process', {
                    error: error,
                    socketId: socket.id,
                    url,
                });
            }
        },
        log,
        socketContext,
    );

    registerSocketEventSafely(
        extensionSocketOn,
        'video_next',
        async payload => {
            if (!isRecord(payload)) {
                log.debug('video_next: invalid payload', { payload });
                return;
            }

            const url = typeof payload['url'] === 'string' ? payload['url'] : undefined;
            const tabId = typeof payload['tabId'] === 'number' ? payload['tabId'] : undefined;

            if (!url) {
                log.debug('video_next: no url provided', { payload });
                return;
            }

            if (!tabId) {
                log.debug('video_next: no tabId provided', { payload });
                return;
            }

            try {
                const { watchUrl } = await import('@/shared/utils/youtube');
                const videoId = extractYoutubeId(url);

                if (!videoId) {
                    log.debug('video_next: invalid YouTube URL', { url });
                    return;
                }

                const pending = pendingNextByTabId.get(tabId);
                if (pending && Date.now() - pending.createdAt > PENDING_NEXT_TTL_MS) pendingNextByTabId.delete(tabId);

                const pendingEntry = pendingNextByTabId.get(tabId);
                let nextCandidateId: string | undefined;

                if (pendingEntry && pendingEntry.videoId === videoId) {
                    nextCandidateId = pendingEntry.nextCandidateId;
                    pendingNextByTabId.delete(tabId);
                }

                const postList = repository.list();
                let nextMusic = nextCandidateId
                    ? postList.find(m => m.id === nextCandidateId) ?? postList[0]
                    : undefined;

                if (postList.length === 0) {
                    socket.emit('no_next_video', {
                        tabId: tabId,
                    });

                    manager.update({ type: 'closed' }, 'video_next_no_next');

                    log.info('video_next: no next video available', {
                        connectionId,
                        socketId: socket.id,
                        tabId,
                        videoId,
                    });
                    return;
                }

                if (!nextMusic) {
                    const currentIndex = postList.findIndex(m => m.id === videoId);
                    if (currentIndex === -1) {
                        log.info('video_next: ignored (video not in repository)', {
                            connectionId,
                            socketId: socket.id,
                            tabId,
                            videoId,
                        });
                        return;
                    }

                    if (postList.length > 0) {
                        let nextIndex = currentIndex + 1;
                        if (nextIndex >= postList.length) nextIndex = 0;
                        nextMusic = postList[nextIndex];
                    }
                }

                if (nextMusic) {
                    const nextUrl = watchUrl(nextMusic.id);

                    socket.emit('next_video_navigate', {
                        nextUrl: nextUrl,
                        tabId: tabId,
                        videoId: nextMusic.id,
                    });

                    manager.update(
                        {
                            isTransitioning: true,
                            musicId: nextMusic.id,
                            musicTitle: nextMusic.title,
                            type: 'paused',
                        },
                        'video_next',
                    );

                    log.info('video_next: navigating to next', {
                        connectionId,
                        from: videoId,
                        nextUrl,
                        socketId: socket.id,
                        tabId,
                        to: nextMusic.id,
                    });
                } else {
                    socket.emit('no_next_video', {
                        tabId: tabId,
                    });

                    manager.update({ type: 'closed' }, 'video_next_no_next');

                    log.info('video_next: no next video available', {
                        connectionId,
                        socketId: socket.id,
                        tabId,
                        videoId,
                    });
                }
            } catch (error) {
                log.warn('video_next: failed to process', {
                    error: error,
                    socketId: socket.id,
                    url,
                });
            }
        },
        log,
        socketContext,
    );

    const progressState = new Map<
        string,
        {
            lastTime: number;
            lastTimestamp: number;
            consecutiveStalls: number;
            lastAdDecisionAt: number;
        }
    >();

    const pickLatestProgressUpdate = (updates: unknown[]): unknown | null => {
        let best: unknown | null = null;
        let bestTimestamp = -Infinity;
        let bestSeq = -Infinity;

        for (const u of updates) {
            if (!isRecord(u)) continue;
            const ts = typeof u['timestamp'] === 'number' ? u['timestamp'] : -Infinity;
            const seq = typeof u['seq'] === 'number' ? u['seq'] : -Infinity;

            if (ts > bestTimestamp) {
                best = u;
                bestTimestamp = ts;
                bestSeq = seq;
                continue;
            }

            if (ts === bestTimestamp && seq > bestSeq) {
                best = u;
                bestSeq = seq;
            }
        }

        return best;
    };

    const handleProgressUpdate = async (payload: unknown, eventName: string) => {
        if (!isRecord(payload)) {
            log.debug(`${eventName}: invalid payload`, { payload });
            return;
        }

        const url = typeof payload['url'] === 'string' ? payload['url'] : undefined;
        const currentTime = typeof payload['currentTime'] === 'number'
            ? payload['currentTime']
            : undefined;
        const duration = typeof payload['duration'] === 'number' ? payload['duration'] : undefined;

        if (import.meta.env.DEV) console.debug(`[handleProgressUpdate] START`, { url, currentTime, eventName });
        const playbackRate = typeof payload['playbackRate'] === 'number' ? payload['playbackRate'] : 1;
        const isBuffering = typeof payload['isBuffering'] === 'boolean'
            ? payload['isBuffering']
            : false;
        const visibilityState = typeof payload['visibilityState'] === 'string'
            ? payload['visibilityState']
            : 'visible';
        const timestamp = typeof payload['timestamp'] === 'number'
            ? payload['timestamp']
            : Date.now();
        const isAdvertisementFromExtension = typeof payload['isAdvertisement'] === 'boolean'
            ? payload['isAdvertisement']
            : undefined;
        const incomingMusicTitle = typeof payload['musicTitle'] === 'string'
            ? payload['musicTitle']
            : undefined;
        const consecutiveStallsFromExtension = typeof payload['consecutiveStalls'] === 'number'
            ? payload['consecutiveStalls']
            : undefined;
        const clientLatencyMs = typeof payload['clientLatencyMs'] === 'number'
            ? payload['clientLatencyMs']
            : undefined;
        const incomingSeq = typeof payload['seq'] === 'number' ? payload['seq'] : undefined;

        if (
            !url
            || currentTime == undefined
            || duration == undefined
            || !Number.isFinite(currentTime)
            || !Number.isFinite(duration)
        ) {
            log.debug(`${eventName}: invalid data`, {
                currentTime,
                duration,
                url,
            });
            return;
        }

        const videoId = extractYoutubeId(url);

        if (!videoId) {
            log.debug(`${eventName}: invalid YouTube URL`, { url });
            return;
        }

        try {
            let state = progressState.get(videoId);
            const isFirstUpdate = !state;
            if (!state) {
                state = {
                    consecutiveStalls: 0,
                    lastAdDecisionAt: 0,
                    lastTime: 0,
                    lastTimestamp: 0,
                };
                progressState.set(videoId, state);
            }

            if (!isFirstUpdate && timestamp < state.lastTimestamp) {
                log.debug(`${eventName}: out-of-order progress ignored`, {
                    lastTimestamp: state.lastTimestamp,
                    timestamp,
                    videoId,
                });
                return;
            }

            const prevTimestamp = state.lastTimestamp;
            const prevTime = state.lastTime;
            const deltaWall = timestamp - prevTimestamp;
            const deltaPlayback = currentTime - prevTime;
            const backwardDelta = deltaPlayback;
            const seekDetected = Math.abs(backwardDelta) > 5;

            if (!isFirstUpdate && timestamp === prevTimestamp && backwardDelta < 0) {
                log.debug(`${eventName}: regressive progress ignored`, {
                    lastTime: prevTime,
                    currentTime,
                    timestamp,
                    videoId,
                });
                return;
            }

            if (!isFirstUpdate && timestamp > prevTimestamp && backwardDelta < -0.5 && !seekDetected) {
                log.debug(`${eventName}: regressive progress ignored`, {
                    lastTime: prevTime,
                    currentTime,
                    timestamp,
                    videoId,
                });
                return;
            }

            state.lastTimestamp = timestamp;
            state.lastTime = currentTime;

            const music = repository.get(videoId);
            const progressPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

            const { SERVER_ENV } = await import('@/app/env.server');
            const stallThreshold = SERVER_ENV.PROGRESS_STALL_THRESHOLD_MS;
            const minDelta = SERVER_ENV.PROGRESS_MIN_DELTA_SEC;
            const stallCount = SERVER_ENV.PROGRESS_STALL_COUNT;
            const cooldown = SERVER_ENV.PROGRESS_COOLDOWN_MS;
            const expectedDelta = (deltaWall / 1000) * playbackRate;

            const currentStatus = manager.getCurrent();
            let isAdvertisement: boolean | undefined = currentStatus.type === 'playing'
                ? currentStatus.isAdvertisement
                : undefined;
            let consecutiveStalls = consecutiveStallsFromExtension !== undefined
                ? consecutiveStallsFromExtension
                : state.consecutiveStalls;
            if (isAdvertisementFromExtension !== undefined) isAdvertisement = isAdvertisementFromExtension;
            else if (
                currentStatus.type === 'playing'
                && currentStatus.isAdvertisement === true
            ) {
                isAdvertisement = true;
            }

            if (consecutiveStallsFromExtension === undefined) {
                if (isBuffering || visibilityState === 'hidden') consecutiveStalls = 0;
                else if (isAdvertisement === true) consecutiveStalls = 0;
                else if (deltaWall > stallThreshold) {
                    if (!seekDetected && deltaPlayback < expectedDelta - minDelta) {
                        consecutiveStalls += 1;

                        const cooldownElapsed = timestamp - state.lastAdDecisionAt > cooldown;

                        if (consecutiveStalls >= stallCount && cooldownElapsed) {
                            isAdvertisement = true;
                            state.lastAdDecisionAt = timestamp;
                            log.info(`${eventName}: advertisement detected`, {
                                consecutiveStalls,
                                deltaPlayback,
                                deltaWall,
                                expectedDelta,
                                videoId,
                            });
                        }
                    } else {
                        consecutiveStalls = 0;
                        if (seekDetected) isAdvertisement = false;
                    }
                }
            }

            state.consecutiveStalls = consecutiveStalls;

            const progressSnapshot: ProgressSnapshot = {
                clientLatencyMs,
                consecutiveStalls,
                currentTime,
                duration,
                isAdvertisement,
                isBuffering,
                musicTitle: incomingMusicTitle,
                playbackRate,
                progressPercent,
                seq: incomingSeq,
                timestamp,
            };
            if (shouldReplaceProgressSnapshot(lastProgressSnapshotByVideoId.get(videoId), progressSnapshot))
                lastProgressSnapshotByVideoId.set(videoId, progressSnapshot);

            const authoritative = authoritativeVideoState.get(videoId);

            if (visibilityState === 'hidden' && currentStatus.type !== 'playing') {
                log.debug(`${eventName}: hidden progress ignored while non-playing`, {
                    currentStatus: currentStatus.type,
                    videoId,
                });
                return;
            }

            if (currentStatus.type === 'closed') {
                const hasFreshAuthoritativePlaying = authoritative?.state === 'playing'
                    && timestamp - authoritative.receivedAt <= AUTHORITATIVE_PLAYING_PROMOTION_MS
                    && (
                        typeof incomingSeq !== 'number'
                        || typeof authoritative.seq !== 'number'
                        || incomingSeq >= authoritative.seq
                    );

                if (!hasFreshAuthoritativePlaying) {
                    log.debug(`${eventName}: closed->playing promotion blocked (no fresh authoritative playing)`, {
                        authoritativeState: authoritative?.state,
                        authoritativeTs: authoritative?.receivedAt,
                        timestamp,
                        videoId,
                    });
                    return;
                }

                const initialPlaying: RemoteStatus = {
                    type: 'playing',
                    musicTitle: (incomingMusicTitle && incomingMusicTitle.length > 0)
                        ? incomingMusicTitle
                        : (music?.title ?? ''),
                    musicId: videoId,
                    videoId,
                    currentTime,
                    duration,
                    progressPercent,
                    lastProgressUpdate: timestamp,
                    consecutiveStalls,
                    playbackRate,
                    isBuffering,
                    isAdvertisement: isAdvertisement ?? false,
                    isExternalVideo: !music,
                };
                manager.update(initialPlaying, eventName);
                log.debug(`${eventName}: established initial playing from progress`, {
                    isAdvertisement: initialPlaying.isAdvertisement,
                    videoId,
                });
                return;
            }

            if (currentStatus.type !== 'playing') return;
            if (!isSameVideoOrUnknown(currentStatus, videoId)) return;
            if (authoritative?.state === 'paused') return;

            const updated: RemoteStatus = {
                ...currentStatus,
                consecutiveStalls,
                currentTime,
                duration,
                isAdvertisement,
                lastProgressUpdate: timestamp,
                musicId: currentStatus.musicId ?? videoId,
                videoId: currentStatus.videoId ?? videoId,
                musicTitle: (incomingMusicTitle && incomingMusicTitle.length > 0)
                    ? incomingMusicTitle
                    : (currentStatus.musicTitle || music?.title || ''),
                progressPercent,
                playbackRate,
                isBuffering,
                isExternalVideo: currentStatus.isExternalVideo ?? !music,
                type: 'playing',
            };
            manager.update(updated, eventName);

            if (Math.abs(deltaPlayback) > 0.1 || consecutiveStalls > 0 || clientLatencyMs !== undefined) {
                log.debug(`${eventName}: processed`, {
                    clientLatencyMs,
                    consecutiveStalls,
                    currentTime: currentTime.toFixed(2),
                    deltaPlayback: deltaPlayback.toFixed(2),
                    deltaWall,
                    duration: duration.toFixed(2),
                    isAdvertisement,
                    progressPercent: progressPercent.toFixed(1),
                    videoId,
                });
            }
        } catch (error) {
            log.warn(`${eventName}: failed to process`, {
                error: error,
                socketId: socket.id,
                url,
            });
        }
    };

    registerSocketEventSafely(
        extensionSocketOn,
        'progress_update',
        payload => handleProgressUpdate(payload, 'progress_update'),
        log,
        socketContext,
    );

    registerSocketEventSafely(
        extensionSocketOn,
        'progress_update_batch',
        payload => {
            if (!isRecord(payload)) return;
            const updates = payload['updates'];
            if (!Array.isArray(updates)) return;
            // Reconnect batches can be large; only process the latest update to avoid transient state churn.
            const latest = pickLatestProgressUpdate(updates);
            if (latest) handleProgressUpdate(latest, 'progress_update_batch');
        },
        log,
        socketContext,
    );

    registerSocketEventSafely(
        extensionSocketOn,
        'video_progress',
        payload => handleProgressUpdate(payload, 'video_progress'),
        log,
        socketContext,
    );

    registerSocketEventSafely(
        extensionSocketOn,
        'no_next_video',
        payload => {
            log.info('no_next_video: end of playlist', {
                connectionId,
                payload,
                socketId: socket.id,
            });

            manager.update({ type: 'closed' }, 'no_next_video');
        },
        log,
        socketContext,
    );

    // Handle request_first_url with callback support
    socket.on('request_first_url', async (callback?: (response: unknown) => void) => {
        try {
            const musicList = repository.list();
            if (musicList.length === 0) {
                log.debug('request_first_url: no music in repository', { connectionId, socketId: socket.id });
                if (typeof callback === 'function') callback({ firstUrl: null });
                return;
            }

            const firstMusic = musicList[0];
            const { watchUrl } = await import('@/shared/utils/youtube');
            const firstUrl = watchUrl(firstMusic.id);

            log.info('request_first_url: returning first URL', {
                connectionId,
                firstUrl,
                socketId: socket.id,
                videoId: firstMusic.id,
            });

            if (typeof callback === 'function') callback({ firstUrl });
        } catch (error) {
            log.warn('request_first_url: failed to process', {
                error,
                socketId: socket.id,
            });
            if (typeof callback === 'function') callback({ firstUrl: null, error: String(error) });
        }
    });

    registerSocketEventSafely(
        extensionSocketOn,
        'external_music_add',
        async payload => {
            if (!isRecord(payload)) {
                log.debug('external_music_add: invalid payload', { payload });
                return;
            }

            const url = typeof payload['url'] === 'string' ? payload['url'] : undefined;
            const title = typeof payload['title'] === 'string' ? payload['title'] : undefined;

            if (!url || !title) {
                log.debug('external_music_add: missing url or title', { payload });
                return;
            }

            try {
                const videoId = extractYoutubeId(url);

                if (!videoId) {
                    log.debug('external_music_add: invalid YouTube URL', { url });
                    return;
                }

                if (repository.has(videoId)) {
                    log.info('external_music_add: video already in list', {
                        connectionId,
                        socketId: socket.id,
                        title,
                        videoId,
                    });
                    return;
                }

                const result = await youtubeService.getVideoDetails(videoId, 1, 5000);

                if (!result.ok) {
                    log.warn('external_music_add: failed to fetch video details', {
                        connectionId,
                        error: result.error,
                        socketId: socket.id,
                        videoId,
                    });
                    return;
                }

                const videoDetails = result.value;
                const music: Music = {
                    channelId: videoDetails.channelId,
                    channelName: videoDetails.channelTitle,
                    duration: videoDetails.duration,
                    id: videoId,
                    requestedAt: new Date().toISOString(),
                    requesterHash: 'external',
                    title: videoDetails.title,
                };

                const addResult = repository.add(music);
                if (addResult.ok) {
                    const emitResult = emitter.emitMusicAdded(music);
                    if (!emitResult.ok) {
                        log.warn('external_music_add: failed to emit musicAdded', {
                            error: emitResult.error,
                            videoId,
                        });
                    }

                    const urlListEmitResult = emitter.emitUrlList(
                        repository.buildCompatList(),
                    );
                    if (!urlListEmitResult.ok) {
                        log.warn('external_music_add: failed to emit url_list', {
                            error: urlListEmitResult.error,
                        });
                    }

                    const persistResult = await repository.persistAdd(music);
                    if (!persistResult.ok) {
                        log.warn('external_music_add: failed to persist', {
                            error: persistResult.error,
                            videoId,
                        });
                    }

                    log.info('external_music_add: music added', {
                        connectionId,
                        socketId: socket.id,
                        title: music.title,
                        videoId,
                    });
                } else {
                    log.warn('external_music_add: failed to add music', {
                        error: addResult.error,
                        videoId,
                    });
                }
            } catch (error) {
                log.warn('external_music_add: failed to process', {
                    error: error,
                    socketId: socket.id,
                    url,
                });
            }
        },
        log,
        socketContext,
    );
}
