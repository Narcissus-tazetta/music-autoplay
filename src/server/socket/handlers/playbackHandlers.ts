import type { Music } from '@/shared/stores/musicStore';
import { isRecord } from '@/shared/utils/typeGuards';
import { extractYoutubeId, watchUrl } from '@/shared/utils/youtube';
import { createEventRegistrar, type ExtensionContext, indexOfMusicById } from './extensionHandlerContext';

const VIDEO_END_DEBOUNCE_MS = 500;
const PENDING_NEXT_TTL_MS = 15000;

/**
 * Auto-advance triggered by a `paused` state report that sits at 100% of the
 * duration, i.e. the extension never sent `video_ended` for this video.
 */
export function handlePausedVideoCompletion(ctx: ExtensionContext, videoId: string): void {
    const { emitter, history, log, manager, repository, socket } = ctx;

    const preList = repository.list();
    const preIdx = indexOfMusicById(preList, videoId);
    if (preIdx === -1) return;
    const endedMusic = preList[preIdx];
    history.rememberRecordableMusic(endedMusic);

    let nextId: string | undefined;
    if (preList.length > 1) {
        let nIdx = preIdx + 1;
        if (nIdx >= preList.length) nIdx = 0;
        nextId = preList[nIdx].id;
    }

    repository.remove(videoId);
    history.recordCompletedHistory(videoId, 'paused_ended', endedMusic);
    emitter.emitMusicRemoved(videoId);
    emitter.emitUrlList(repository.buildCompatList());
    repository.persistRemove(videoId);

    const postList = repository.list();
    if (postList.length === 0) {
        socket.emit('no_next_video', { tabId: -1 });
        manager.update({ type: 'closed' }, 'paused_100_no_next');
        log.info('paused+100%: no next video', { videoId });
        return;
    }

    const nextIdx = nextId ? indexOfMusicById(postList, nextId) : -1;
    const nextMusic = nextIdx >= 0 ? postList[nextIdx] : postList[0];
    if (!nextMusic) return;

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
        from: videoId,
        to: nextMusic.id,
    });
}

export function registerPlaybackHandlers(ctx: ExtensionContext): void {
    const { connectionId, emitter, history, log, manager, repository, socket, state } = ctx;
    const { pendingNextByTabId, videoEndDebounce } = state;
    const on = createEventRegistrar(ctx);

    on('move_prev_video', async payload => {
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
            const currentIndex = indexOfMusicById(musicList, currentId);

            if (currentIndex === -1) {
                log.debug('move_prev_video: current music not found', { currentId });
                return;
            }

            const prevIndex = currentIndex === 0 ? musicList.length - 1 : currentIndex - 1;
            const prevMusic = musicList[prevIndex];

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
    });

    on('move_next_video', async payload => {
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
            const currentIndex = indexOfMusicById(musicList, currentId);

            if (currentIndex === -1) {
                log.debug('move_next_video: current music not found', { currentId });
                return;
            }

            const nextIndex = (currentIndex + 1) % musicList.length;
            const nextMusic = musicList[nextIndex];

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
    });

    on('video_ended', async payload => {
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
            const preIndex = indexOfMusicById(preRemoveList, videoId);
            let nextCandidateId: string | undefined;
            const endedMusic = preIndex !== -1 ? preRemoveList[preIndex] : undefined;
            history.rememberRecordableMusic(endedMusic);

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

            repository.remove(videoId);
            history.recordCompletedHistory(videoId, 'video_ended', endedMusic);
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
        } catch (error) {
            log.warn('video_ended: failed to process', {
                error: error,
                socketId: socket.id,
                url,
            });
        }
    });

    on('video_next', async payload => {
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
            let nextMusic = undefined as Music | undefined;
            if (nextCandidateId) {
                const nextCandidateIndex = indexOfMusicById(postList, nextCandidateId);
                nextMusic = nextCandidateIndex >= 0 ? postList[nextCandidateIndex] : postList[0];
            }

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
