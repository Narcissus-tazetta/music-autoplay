import type { Music } from '@/shared/types/music';
import type { Store } from '../persistence';
import type { YouTubeService } from '../services/youtubeService';
import { AuthChecker } from './authChecker';
import { MusicEventEmitter } from './musicEventEmitter';
import type { EmitFn } from './musicEventEmitter';
import { MusicRepository } from './musicRepository';
import { MusicService } from './musicService';
import { YouTubeResolver } from './youtubeResolver';

export interface MusicServiceFactoryOptions {
    youtubeService: YouTubeService;
    musicDB: Map<string, Music>;
    fileStore: Store;
    emitFn: EmitFn;
}

/**
 * Wires up a MusicService from its collaborators.
 *
 * This used to memoise one process-wide instance, so the *first* caller's dependencies won
 * and every later caller silently received someone else's youtubeService / musicDB / emitFn
 * regardless of what it passed in. That made test results depend on file execution order
 * (the suite passed on macOS and failed on Linux CI with
 * "this.youtubeService.getVideoDetails is not a function"), and in the server it meant
 * SocketRuntime and SocketServerInstance shared an instance by accident rather than design.
 *
 * Ownership is now explicit: SocketRuntime owns the instance used by socket connections,
 * SocketServerInstance owns the one used by the HTTP action path.
 */
export function createMusicService(options: MusicServiceFactoryOptions): MusicService {
    const { emitFn, fileStore, musicDB, youtubeService } = options;

    return new MusicService(
        new AuthChecker(),
        new YouTubeResolver(youtubeService),
        new MusicRepository(musicDB, fileStore),
        new MusicEventEmitter(emitFn),
    );
}
