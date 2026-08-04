import type { Music } from '@/shared/types/music';
import { extractYoutubeId } from '@/shared/utils/youtube';
import {
    createEventRegistrar,
    type ExtensionContext,
    extractUrlAndTabId,
    indexOfMusicById,
    navigateToVideo,
    nextIndexWithWrap,
    removeMusicAndBroadcast,
    reportNoNextVideo,
} from './extensionHandlerContext';

const VIDEO_END_DEBOUNCE_MS = 500;
const PENDING_NEXT_TTL_MS = 15000;

/** Tab id used for events that carry no tab of their own (server-initiated auto-advance). */
const NO_TAB_ID = -1;

/**
 * Auto-advance triggered by a `paused` state report that sits at 100% of the
 * duration, i.e. the extension never sent `video_ended` for this video.
 */
export function handlePausedVideoCompletion(ctx: ExtensionContext, videoId: string): void {
    const { history, repository } = ctx;

    const preList = repository.list();
    const preIdx = indexOfMusicById(preList, videoId);
    if (preIdx === -1) return;
    const endedMusic = preList[preIdx];
    history.rememberRecordableMusic(endedMusic);

    const nextId = preList.length > 1 ? preList[nextIndexWithWrap(preList, preIdx)].id : undefined;

    history.recordCompletedHistory(videoId, 'paused_ended', endedMusic);
    removeMusicAndBroadcast(ctx, videoId, 'paused_100');

    const postList = repository.list();
    if (postList.length === 0) {
        reportNoNextVideo(ctx, {
            logMessage: 'paused+100%: no next video',
            reason: 'paused_100_no_next',
            tabId: NO_TAB_ID,
            videoId,
        });
        return;
    }

    const nextIdx = nextId ? indexOfMusicById(postList, nextId) : -1;
    const nextMusic = nextIdx >= 0 ? postList[nextIdx] : postList[0];
    if (!nextMusic) return;

    navigateToVideo(ctx, {
        from: videoId,
        logMessage: 'paused+100%: auto-navigate',
        music: nextMusic,
        reason: 'paused_100_navigate',
        tabId: NO_TAB_ID,
    });
}

/**
 * `move_prev_video` and `move_next_video` differ only in which neighbour they pick, so
 * they share one implementation parameterised by direction.
 */
function registerMoveVideoHandler(
    ctx: ExtensionContext,
    direction: 'prev' | 'next',
    on: ReturnType<typeof createEventRegistrar>,
): void {
    const { log, repository, socket } = ctx;
    const eventName = direction === 'prev' ? 'move_prev_video' : 'move_next_video';

    on(eventName, async payload => {
        const parsed = extractUrlAndTabId(payload, eventName, log);
        if (!parsed) return;
        const { tabId, url: currentUrl } = parsed;

        try {
            const currentId = extractYoutubeId(currentUrl);
            if (!currentId) {
                log.debug(`${eventName}: invalid YouTube URL`, { currentUrl });
                return;
            }

            const musicList = repository.list();
            const currentIndex = indexOfMusicById(musicList, currentId);
            if (currentIndex === -1) {
                log.debug(`${eventName}: current music not found`, { currentId });
                return;
            }

            const targetIndex = direction === 'prev'
                ? (currentIndex === 0 ? musicList.length - 1 : currentIndex - 1)
                : nextIndexWithWrap(musicList, currentIndex);

            navigateToVideo(ctx, {
                from: currentId,
                logMessage: `${eventName}: navigating to ${direction === 'prev' ? 'previous' : 'next'}`,
                music: musicList[targetIndex],
                reason: eventName,
                tabId,
            });
        } catch (error) {
            log.warn(`${eventName}: failed to process`, {
                currentUrl,
                error: error,
                socketId: socket.id,
            });
        }
    });
}

export function registerPlaybackHandlers(ctx: ExtensionContext): void {
    const { connectionId, history, log, manager, repository, socket, state } = ctx;
    const { pendingNextByTabId, videoEndDebounce } = state;
    const on = createEventRegistrar(ctx);

    registerMoveVideoHandler(ctx, 'prev', on);
    registerMoveVideoHandler(ctx, 'next', on);

    on('video_ended', async payload => {
        const parsed = extractUrlAndTabId(payload, 'video_ended', log);
        if (!parsed) return;
        const { tabId, url } = parsed;

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
            const preIndex = indexOfMusicById(preRemoveList, videoId);

            if (preIndex === -1) {
                history.recordCompletedHistory(videoId, 'video_ended_missing_repository');
                log.info('video_ended: ignored (video not in repository)', {
                    connectionId,
                    socketId: socket.id,
                    tabId,
                    videoId,
                });
                return;
            }

            const endedMusic = preRemoveList[preIndex];
            history.rememberRecordableMusic(endedMusic);

            const nextCandidateId = preRemoveList.length > 1
                ? preRemoveList[nextIndexWithWrap(preRemoveList, preIndex)].id
                : undefined;

            pendingNextByTabId.set(tabId, {
                videoId,
                nextCandidateId,
                createdAt: Date.now(),
            });

            history.recordCompletedHistory(videoId, 'video_ended', endedMusic);
            removeMusicAndBroadcast(ctx, videoId, 'video_ended');
        } catch (error) {
            log.warn('video_ended: failed to process', {
                error: error,
                socketId: socket.id,
                url,
            });
        }
    });

    on('video_next', async payload => {
        const parsed = extractUrlAndTabId(payload, 'video_next', log);
        if (!parsed) return;
        const { tabId, url } = parsed;

        try {
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

            if (postList.length === 0) {
                reportNoNextVideo(ctx, {
                    logMessage: 'video_next: no next video available',
                    reason: 'video_next_no_next',
                    tabId,
                    videoId,
                });
                return;
            }

            let nextMusic: Music | undefined;
            if (nextCandidateId) {
                const nextCandidateIndex = indexOfMusicById(postList, nextCandidateId);
                nextMusic = nextCandidateIndex >= 0 ? postList[nextCandidateIndex] : postList[0];
            }

            if (!nextMusic) {
                const currentIndex = indexOfMusicById(postList, videoId);
                if (currentIndex === -1) {
                    log.info('video_next: ignored (video not in repository)', {
                        connectionId,
                        socketId: socket.id,
                        tabId,
                        videoId,
                    });
                    return;
                }
                nextMusic = postList[nextIndexWithWrap(postList, currentIndex)];
            }

            navigateToVideo(ctx, {
                from: videoId,
                logMessage: 'video_next: navigating to next',
                music: nextMusic,
                reason: 'video_next',
                tabId,
            });
        } catch (error) {
            log.warn('video_next: failed to process', {
                error: error,
                socketId: socket.id,
                url,
            });
        }
    });

    on('no_next_video', payload => {
        log.info('no_next_video: end of playlist', {
            connectionId,
            payload,
            socketId: socket.id,
        });

        manager.update({ type: 'closed' }, 'no_next_video');
    });
}
