import type { Server, Socket } from 'socket.io';
import type { C2S, S2C } from '../../shared/types/socket';
import { log } from '../logger';
import { removeMusicRequest } from '../musicPersistence';
import { extractYouTubeId } from '../utils';
import { fetchVideoInfo } from '../youtubeApi';
import { currentState, musics } from '../youtubeState';

export function registerYouTubeHandlers(io: Server<C2S, S2C>, socket: Socket<C2S, S2C>) {
    socket.on('youtube_video_state', async data => {
        const previousState = currentState.currentYoutubeState.state;
        const previousUrl = currentState.currentYoutubeState.url;

        currentState.currentYoutubeState.state = data.state;
        currentState.currentYoutubeState.url = data.url;

        // 音楽が再生完了した場合の自動削除処理
        if (
            previousState === 'playing'
            && (data.state === 'paused' || data.state === 'stopped')
            && previousUrl
            && previousUrl !== data.url
        ) {
            // 前の曲がリクエストリストにあった場合は削除
            const previousVideoId = extractYouTubeId(previousUrl);
            const requestIndex = musics.findIndex(m => extractYouTubeId(m.url) === previousVideoId);

            if (requestIndex !== -1) {
                const removedRequest = musics.splice(requestIndex, 1)[0];
                removeMusicRequest(musics, previousUrl);
                log.info(`🎵 Auto-removed completed music: "${removedRequest.title}"`);
                io.emit('url_list', musics);
                io.emit('delete_url', previousUrl);
            }
        }

        if (data.state === 'playing') currentState.currentPlayingId = extractYouTubeId(data.url);
        else if (data.state === 'paused') {
            if (!currentState.currentPlayingId) currentState.currentPlayingId = extractYouTubeId(data.url);
        } else if (data.state === 'window_close') {
            currentState.currentPlayingId = null;
        }

        let nowMusic = null;
        let isMatch = false;
        if (currentState.currentPlayingId) {
            nowMusic = musics.find(m => extractYouTubeId(m.url) === currentState.currentPlayingId) || null;
            isMatch = nowMusic ? extractYouTubeId(data.url) === currentState.currentPlayingId : false;
        } else {
            nowMusic = musics.at(0) || null;
            isMatch = nowMusic && nowMusic.url === data.url;
        }

        if (!isMatch && data.url) {
            const videoId = extractYouTubeId(data.url);
            if (videoId) {
                const videoInfo = await fetchVideoInfo(videoId);
                if (videoInfo) {
                    nowMusic = {
                        url: data.url,
                        title: videoInfo.title,
                        thumbnail: videoInfo.thumbnail,
                    };
                } else {
                    nowMusic = {
                        url: data.url,
                        title: 'Unknown Video',
                        thumbnail: '',
                    };
                }
            }
        }

        log.youtube(`▶️  YouTube: ${data.state} | Match: ${isMatch ? '✅' : '❌'}`);

        if (data.state === 'window_close') {
            currentState.lastYoutubeStatus = null;
            io.emit('current_youtube_status', {
                state: 'window_close',
                url: data.url,
                match: isMatch,
                music: nowMusic,
            });
        } else {
            currentState.lastYoutubeStatus = {
                state: data.state,
                url: data.url,
                match: isMatch,
                music: nowMusic,
            };
            io.emit('current_youtube_status', currentState.lastYoutubeStatus);
        }
    });

    socket.on('youtube_tab_closed', async data => {
        currentState.currentYoutubeState.state = 'window_close';
        currentState.currentYoutubeState.url = data.url;

        let nowMusic = musics.at(0) || null;
        const isMatch = nowMusic && nowMusic.url === data.url;

        if (!isMatch && data.url) {
            const videoId = extractYouTubeId(data.url);
            if (videoId) {
                log.youtube(`🔍 Fetching info for closed unlisted video: ${videoId}`);
                const videoInfo = await fetchVideoInfo(videoId);
                if (videoInfo) {
                    nowMusic = {
                        url: data.url,
                        title: videoInfo.title,
                        thumbnail: videoInfo.thumbnail,
                    };
                    log.youtube(`📺 Got closed unlisted video: "${videoInfo.title}"`);
                } else {
                    nowMusic = {
                        url: data.url,
                        title: 'Unknown Video',
                        thumbnail: '',
                    };
                    log.youtube(`❓ Could not fetch closed video info for: ${videoId}`);
                }
            }
        }

        log.youtube(`❌ YouTube tab closed | Match: ${isMatch ? '✅' : '❌'}`);
        currentState.lastYoutubeStatus = null;
        io.emit('current_youtube_status', {
            state: 'window_close',
            url: data.url,
            match: isMatch,
            music: nowMusic,
        });
    });
}
