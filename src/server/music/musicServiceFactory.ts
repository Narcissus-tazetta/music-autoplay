import type { Music } from '@/shared/stores/musicStore';
import type { Store } from '../persistence';
import type { YouTubeService } from '../services/youtubeService';
import { AuthChecker } from './auth/authChecker';
import { MusicEventEmitter } from './emitter/musicEventEmitter';
import type { EmitFn } from './emitter/musicEventEmitter';
import { MusicService } from './musicService';
import { MusicRepository } from './repository/musicRepository';
import { YouTubeResolver } from './resolver/youtubeResolver';

let instance: MusicService | null;

export interface MusicServiceFactoryOptions {
    youtubeService: YouTubeService;
    musicDB: Map<string, Music>;
    fileStore: Store;
    emitFn: EmitFn;
}

export function createMusicService(
    options: MusicServiceFactoryOptions,
): MusicService {
    if (instance) return instance;

    const { youtubeService, musicDB, fileStore, emitFn } = options;

    const auth = new AuthChecker();
    const resolver = new YouTubeResolver(youtubeService);
    const repository = new MusicRepository(musicDB, fileStore);
    const emitter = new MusicEventEmitter(emitFn);

    instance = new MusicService(auth, resolver, repository, emitter);
    return instance;
}

export function getMusicService(): MusicService {
    if (!instance) {
        throw new Error(
            'MusicService not initialized. Call createMusicService first.',
        );
    }
    return instance;
}

export const resetMusicService = (): void => {
    instance = null;
};
