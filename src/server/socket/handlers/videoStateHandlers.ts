import type { RemoteStatus } from '@/shared/stores/musicStore';
import { isRecord } from '@/shared/utils/typeGuards';
import { extractYoutubeId } from '@/shared/utils/youtube';
import { createEventRegistrar, type ExtensionContext, isSameVideoOrUnknown } from './extensionHandlerContext';
import { handlePausedVideoCompletion } from './playbackHandlers';

const AUTHORITATIVE_PAUSE_HOLD_MS = 3000;
const AUTHORITATIVE_RESUME_EPSILON_SEC = 0.75;
const EXTERNAL_VIDEO_TITLE_CACHE_TTL_MS = 10 * 60 * 1000;
const EXTERNAL_VIDEO_TITLE_CACHE_MAX = 500;

/**
 * `youtube_video_state` / `ad_state_changed` / `tab_closed`: the extension's
 * authoritative view of what the tab is doing right now.
 */
export function registerVideoStateHandlers(ctx: ExtensionContext): void {
    const { connectionId, history, log, manager, repository, socket, state, youtubeService } = ctx;
    const { authoritativeVideoState, lastAdSnapshotByVideoId, lastProgressSnapshotByVideoId } = state;
    const on = createEventRegistrar(ctx);

    const externalVideoTitleCache = new Map<string, { title: string; cachedAt: number }>();

    const getExternalVideoTitle = async (videoId: string): Promise<string> => {
        const now = Date.now();
        const cached = externalVideoTitleCache.get(videoId);
        if (cached && now - cached.cachedAt <= EXTERNAL_VIDEO_TITLE_CACHE_TTL_MS) {
            externalVideoTitleCache.delete(videoId);
            externalVideoTitleCache.set(videoId, cached);
            return cached.title;
        }

        const result = await youtubeService.getVideoDetails(videoId, 1, 2000);
        const title = result.ok ? result.value.title : `動画ID: ${videoId}`;

        externalVideoTitleCache.set(videoId, { cachedAt: now, title });
        while (externalVideoTitleCache.size > EXTERNAL_VIDEO_TITLE_CACHE_MAX) {
            const oldestVideoId = externalVideoTitleCache.keys().next().value;
            if (!oldestVideoId) break;
            externalVideoTitleCache.delete(oldestVideoId);
        }

        return title;
    };

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

    on('youtube_video_state', async payload => {
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
                history.rememberRecordableMusic(music);

                // Avoid leaving remoteStatus stuck in 'playing' if video_ended is missed.
                if (videoId) {
                    history.recordCompletedHistory(videoId, 'youtube_video_state:ended', music);
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

            const videoState = stateRaw === 'playing' ? 'playing' : 'paused';

            const resolvedVideoId = url
                ? (extractYoutubeId(url) ?? undefined)
                : undefined;
            if (
                videoState === 'playing'
                && shouldIgnorePlayingFromStaleAuthoritative(resolvedVideoId, {
                    seq: incomingSeq,
                    currentTime: incomingCurrentTime,
                })
            ) {
                log.debug('youtube_video_state: stale playing ignored after authoritative pause', {
                    currentTime: incomingCurrentTime,
                    seq: incomingSeq,
                    url,
                    videoId: resolvedVideoId,
                });
                return;
            }

            log.debug(`youtube_video_state: received ${videoState}`, {
                currentTime: incomingCurrentTime,
                duration: incomingDuration,
                url,
            });

            let match: { url: string; title?: string } | null = null;
            let isExternalVideo = false;
            let externalVideoId: string | undefined;

            if (url) {
                const videoId = extractYoutubeId(url);
                if (videoId) {
                    const localMusic = repository.get(videoId);
                    if (localMusic) {
                        history.rememberRecordableMusic(localMusic);
                        match = {
                            title: localMusic.title,
                            url,
                        };
                    } else {
                        isExternalVideo = true;
                        externalVideoId = videoId;
                        try {
                            log.debug('Fetching external video details', { state: videoState, url, videoId });
                            const title = await getExternalVideoTitle(videoId);
                            match = {
                                title,
                                url,
                            };
                            if (title.startsWith('動画ID: ')) {
                                log.warn('Failed to fetch external video details', {
                                    state: videoState,
                                    videoId,
                                });
                            } else {
                                log.info('External video title fetched', {
                                    state: videoState,
                                    title,
                                    videoId,
                                });
                            }
                        } catch (error) {
                            log.warn('Exception while fetching external video details', {
                                error: error,
                                state: videoState,
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
                    state: videoState,
                    url,
                    videoId: externalVideoId,
                });
            }

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
            if (videoState === 'playing') {
                history.clearHistoryCompletionIfReplayStarted(
                    resolvedVideoId,
                    mergedCurrentTime,
                    mergedDuration,
                    'youtube_video_state:playing',
                );
            }

            const remoteStatus: RemoteStatus = videoState === 'playing'
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

            if (resolvedVideoId) {
                authoritativeVideoState.set(resolvedVideoId, {
                    state: videoState,
                    receivedAt: Date.now(),
                    seq: incomingSeq,
                    currentTime: incomingCurrentTime,
                    duration: incomingDuration,
                });
                log.debug(`youtube_video_state: set authoritative ${videoState}`, {
                    currentTime: incomingCurrentTime,
                    videoId: resolvedVideoId,
                    seq: incomingSeq,
                });
            }

            try {
                manager.update(remoteStatus, 'extension');
                log.info('youtube_video_state processed', {
                    connectionId,
                    isAdvertisement: videoState === 'playing' ? isAdvertisement : undefined,
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
                videoState === 'paused'
                && !isAdvertisement
                && typeof mergedCurrentTime === 'number'
                && typeof mergedDuration === 'number'
                && mergedDuration > 0
                && Math.abs(mergedCurrentTime - mergedDuration) < 0.5
                && resolvedVideoId
                && repository.has(resolvedVideoId)
            ) {
                handlePausedVideoCompletion(ctx, resolvedVideoId);
            }
            return;
        }

        log.debug('youtube_video_state: unknown state value', {
            payload,
            state: stateRaw,
        });
    });

    on('tab_closed', payload => {
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
    });

    on('ad_state_changed', async payload => {
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
    });
}
