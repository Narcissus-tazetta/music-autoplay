import type { Music } from '@/shared/types/music';
import { isRecord } from '@/shared/utils/typeGuards';
import { extractYoutubeId, watchUrl } from '@/shared/utils/youtube';
import {
    addMusicAndBroadcast,
    createEventRegistrar,
    type ExtensionContext,
    removeMusicAndBroadcast,
} from './extensionHandlerContext';

/**
 * Queue mutations requested by the extension: `delete_url`,
 * `external_music_add`, plus the `request_first_url` lookup it uses on startup.
 */
export function registerQueueHandlers(ctx: ExtensionContext): void {
    const { connectionId, log, repository, socket, youtubeService } = ctx;
    const on = createEventRegistrar(ctx);

    on('delete_url', async (url: unknown) => {
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

            if (!repository.has(videoId)) {
                log.debug('delete_url: video not in database', {
                    socketId: socket.id,
                    url,
                    videoId,
                });
                return;
            }

            removeMusicAndBroadcast(ctx, videoId, 'delete_url');

            log.info('delete_url: music removed', {
                connectionId,
                socketId: socket.id,
                url,
                videoId,
            });
        } catch (error) {
            log.warn('delete_url: failed to process', {
                error: error,
                socketId: socket.id,
                url,
            });
        }
    });

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

    on('external_music_add', async payload => {
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

            await addMusicAndBroadcast(ctx, music, 'external_music_add');

            log.info('external_music_add: music added', {
                connectionId,
                socketId: socket.id,
                title: music.title,
                videoId,
            });
        } catch (error) {
            log.warn('external_music_add: failed to process', {
                error: error,
                socketId: socket.id,
                url,
            });
        }
    });
}
