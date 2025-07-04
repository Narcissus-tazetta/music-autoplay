import type { Music } from '../features/music/stores/musicStore';
import { log } from './logger';
import { loadMusicRequests } from './musicPersistence';
import type { AppState, ClientsMap } from './types';

export const currentState: AppState = {
    currentYoutubeState: { state: '', url: '' },
    lastYoutubeStatus: null,
    currentPlayingId: null,
};

// 永続化されたリクエストを読み込み
export const musics: Music[] = loadMusicRequests();
export const clients: ClientsMap = new Map();

// 初期化ログ
log.info(`🎵 Initialized with ${musics.length} persistent music requests`);
