import type { Music, RemoteStatus } from '@/shared/stores/musicStore';
import { isRecord } from '@/shared/utils/typeGuards';
import { extractYoutubeId } from '@/shared/utils/youtube';
import type { Socket } from 'socket.io';
import type { AppLogger } from '../../logger';
import type { MusicEventEmitter } from '../../music/emitter/musicEventEmitter';
import type { MusicRepository } from '../../music/repository/musicRepository';
import type { YouTubeService } from '../../services/youtubeService';
import type { SocketManager } from '../managers/manager';
import { registerSocketEventSafely } from '../utils/eventRegistration';
import { extractSocketOn } from '../utils/socketHelpers';

export function setupExtensionEventHandlers(
    socket: Socket,
    log: AppLogger,
    connectionId: string,
    musicDB: Map<string, Music>,
    manager: SocketManager,
    repository: MusicRepository,
    emitter: MusicEventEmitter,
    youtubeService: YouTubeService,
) {
    const extensionSocketOn = extractSocketOn(socket);
    const socketContext = { socketId: socket.id };

    // Hard rule: once paused, do not allow progress/ad events to flip to playing.
    // This flag is updated synchronously on youtube_video_state receipt to avoid races
    // where async work delays manager.update(paused).
    let pausedLockActive = false;

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

            // Update paused lock immediately to prevent progress/ad handlers from flipping state
            // before we finish any async work in this handler.
            if (stateRaw === 'playing') pausedLockActive = false;
            else if (stateRaw === 'paused' || stateRaw === 'transitioning' || stateRaw === 'ended')
                pausedLockActive = true;
            else if (stateRaw === 'window_close') pausedLockActive = false;

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
                    if (videoId && repository.has(videoId)) {
                        const removeResult = repository.remove(videoId);
                        if (removeResult.ok) {
                            const emitResult = emitter.emitMusicRemoved(videoId);
                            if (!emitResult.ok) {
                                log.warn('youtube_video_state: failed to emit musicRemoved', {
                                    error: emitResult.error,
                                    videoId,
                                });
                            }

                            const urlListEmitResult = emitter.emitUrlList(
                                repository.buildCompatList(),
                            );
                            if (!urlListEmitResult.ok) {
                                log.warn('youtube_video_state: failed to emit url_list', {
                                    error: urlListEmitResult.error,
                                });
                            }

                            const persistResult = repository.persistRemove(videoId);
                            if (!persistResult.ok) {
                                log.warn('youtube_video_state: failed to persist removal', {
                                    error: persistResult.error,
                                    videoId,
                                });
                            }
                            log.info('youtube_video_state: music removed on ended', {
                                connectionId,
                                socketId: socket.id,
                                url,
                                videoId,
                            });
                        } else {
                            log.warn('youtube_video_state: failed to remove music', {
                                error: removeResult.error,
                                videoId,
                            });
                        }
                    }

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

                log.debug(`youtube_video_state: received ${state}`, {
                    currentTime: incomingCurrentTime,
                    duration: incomingDuration,
                    url,
                });

                let match: { url: string; title?: string } | null = null;
                let isExternalVideo = false;
                let externalVideoId: string | undefined;

                if (url) {
                    const { watchUrl, extractYoutubeId } = await import('@/shared/utils/youtube');

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

                const remoteStatus: RemoteStatus = match
                    ? (state === 'playing'
                        ? {
                            isAdvertisement,
                            isExternalVideo,
                            musicId: undefined,
                            musicTitle: match.title ?? '',
                            type: 'playing' as const,
                            videoId: externalVideoId,
                        }
                        : {
                            musicId: undefined,
                            musicTitle: match.title ?? '',
                            videoId: externalVideoId,
                            type: 'paused' as const,
                            currentTime: incomingCurrentTime,
                            duration: incomingDuration,
                        })
                    : (state === 'playing'
                        ? {
                            isAdvertisement,
                            musicId: undefined,
                            musicTitle: '',
                            type: 'playing' as const,
                        }
                        : {
                            musicId: undefined,
                            musicTitle: undefined,
                            type: 'paused' as const,
                            currentTime: incomingCurrentTime,
                            duration: incomingDuration,
                        });

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
                const { extractYoutubeId } = await import('@/shared/utils/youtube');
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
                const { extractYoutubeId } = await import('@/shared/utils/youtube');
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
                const { extractYoutubeId } = await import('@/shared/utils/youtube');
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
                const { extractYoutubeId } = await import('@/shared/utils/youtube');
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

                // Hard rule: once paused, do not transition to playing from ad events.
                // Only youtube_video_state(state=playing) is allowed to resume.
                if (isPausedLocked()) {
                    log.debug('ad_state_changed: ignored due to paused lock', {
                        connectionId,
                        isAd,
                        socketId: socket.id,
                        videoId,
                    });
                    return;
                }

                if (isAd) {
                    const currentStatus = manager.getCurrent();
                    const music = repository.get(videoId);
                    const adStatus: RemoteStatus = music
                        ? {
                            adTimestamp: timestamp,
                            currentTime: currentStatus.type === 'playing'
                                ? currentStatus.currentTime
                                : undefined,
                            duration: currentStatus.type === 'playing'
                                ? currentStatus.duration
                                : undefined,
                            isAdvertisement: true,
                            musicId: videoId,
                            musicTitle: music.title,
                            progressPercent: currentStatus.type === 'playing'
                                ? currentStatus.progressPercent
                                : undefined,
                            type: 'playing',
                        }
                        : {
                            adTimestamp: timestamp,
                            currentTime: currentStatus.type === 'playing'
                                ? currentStatus.currentTime
                                : undefined,
                            duration: currentStatus.type === 'playing'
                                ? currentStatus.duration
                                : undefined,
                            isAdvertisement: true,
                            musicId: undefined,
                            musicTitle: '',
                            progressPercent: currentStatus.type === 'playing'
                                ? currentStatus.progressPercent
                                : undefined,
                            type: 'playing',
                        };
                    manager.update(adStatus, 'ad_started');
                } else {
                    const music = repository.get(videoId);
                    if (music) {
                        const contentStatus: RemoteStatus = {
                            adTimestamp: undefined,
                            isAdvertisement: false,
                            musicId: videoId,
                            musicTitle: music.title,
                            type: 'playing',
                        };
                        manager.update(contentStatus, 'ad_ended');
                    }
                }
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
                const { extractYoutubeId, watchUrl } = await import('@/shared/utils/youtube');
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

                const removeResult = repository.remove(videoId);
                if (removeResult.ok) {
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
                }

                const musicList = repository.list();
                if (musicList.length > 0) {
                    const nextMusic = musicList[0];
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
                        'video_ended',
                    );

                    log.info('video_ended: navigating to next', {
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

                    manager.update({ type: 'closed' }, 'video_ended_no_next');

                    log.info('video_ended: no next video available', {
                        connectionId,
                        socketId: socket.id,
                        tabId,
                        videoId,
                    });
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

    const progressState = new Map<
        string,
        {
            lastTime: number;
            lastTimestamp: number;
            consecutiveStalls: number;
            lastAdDecisionAt: number;
        }
    >();

    const isPausedLocked = (): boolean => pausedLockActive || manager.getCurrent().type === 'paused';

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

        // Hard rule: once paused, do not transition to playing from progress events.
        // Only youtube_video_state(state=playing) is allowed to resume.
        if (isPausedLocked()) {
            log.debug(`${eventName}: ignored due to paused lock`, {
                currentTime,
                duration,
                timestamp,
                videoId,
            });
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

            const authoritative = authoritativeVideoState.get(videoId);
            const AUTHORITATIVE_TTL_MS = 30000; // 30秒以内の authoritative pause のみ尊重
            const AUTHORITATIVE_GRACE_MS = 2000; // pause直後2秒は無条件で尊重
            const authoritativeAge = authoritative ? (Date.now() - authoritative.receivedAt) : Infinity;
            const isAuthoritativeRecent = authoritativeAge < AUTHORITATIVE_TTL_MS;
            const isInGracePeriod = authoritativeAge < AUTHORITATIVE_GRACE_MS;
            const hasSeqInfo = typeof incomingSeq === 'number' && typeof authoritative?.seq === 'number';
            const isSameOrBeforeAuthoritativeSeq = hasSeqInfo && incomingSeq <= (authoritative?.seq as number);
            const shouldRespectAuthoritativePause = authoritative?.state === 'paused'
                && isAuthoritativeRecent
                && !seekDetected
                && (
                    // If seq is available, never let older/same-session progress override paused.
                    isSameOrBeforeAuthoritativeSeq
                    // Fallback to legacy heuristic when seq is unavailable.
                    || (!hasSeqInfo && (isInGracePeriod || Math.abs(deltaPlayback) < 0.1))
                );

            if (shouldRespectAuthoritativePause) {
                log.debug(`${eventName}: respecting authoritative pause`, {
                    authoritativeAge,
                    currentTime: currentTime.toFixed(2),
                    deltaPlayback: deltaPlayback.toFixed(3),
                    videoId,
                    seq: incomingSeq,
                    authoritativeSeq: authoritative?.seq,
                });
                const pausedUpdate: RemoteStatus = {
                    currentTime,
                    duration,
                    musicId: videoId,
                    musicTitle: music?.title,
                    playbackRate,
                    type: 'paused',
                };
                manager.update(pausedUpdate, eventName);
            } else {
                const shouldPreservePausedDueToZeroProgress = eventName === 'progress_update_batch'
                    && authoritative?.state === 'paused'
                    && !seekDetected
                    && Math.abs(deltaPlayback) < 0.1;

                if (shouldPreservePausedDueToZeroProgress) {
                    log.debug(`${eventName}: preserving paused due to zero progress`, {
                        authoritativeAge,
                        currentTime: currentTime.toFixed(2),
                        deltaPlayback: deltaPlayback.toFixed(3),
                        videoId,
                        seq: incomingSeq,
                        authoritativeSeq: authoritative?.seq,
                    });

                    const pausedUpdate: RemoteStatus = {
                        currentTime,
                        duration,
                        musicId: videoId,
                        musicTitle: incomingMusicTitle || music?.title,
                        playbackRate,
                        type: 'paused',
                    };
                    manager.update(pausedUpdate, eventName);
                    return;
                }

                if (authoritative?.state === 'paused' && !isAuthoritativeRecent) {
                    log.debug(`${eventName}: ignoring stale authoritative pause`, {
                        authoritativeAge,
                        videoId,
                    });
                }
                const statusUpdate: RemoteStatus = {
                    consecutiveStalls,
                    currentTime,
                    duration,
                    isAdvertisement,
                    isExternalVideo: !music,
                    lastProgressUpdate: timestamp,
                    musicId: videoId,
                    musicTitle: incomingMusicTitle || music?.title || '',
                    progressPercent,
                    playbackRate,
                    isBuffering,
                    type: 'playing',
                    videoId: videoId,
                };
                manager.update(statusUpdate, eventName);
            }

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
                const { extractYoutubeId } = await import('@/shared/utils/youtube');
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
