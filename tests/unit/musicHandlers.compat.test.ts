import type { Store } from '@/server/persistence';
import type { YouTubeService } from '@/server/services/youtubeService';
import { createMusicHandlers } from '@/server/socket/handlers/musicHandlers';
import type { Music } from '@/shared/stores/musicStore';
import { ok } from '@/shared/utils/errors/result-handlers';
import { afterEach, describe, expect, test } from 'bun:test';
import type { Socket } from 'socket.io';
import { resetMusicService } from '../../src/server/music/musicServiceFactory';

type RegisteredHandler = (...args: unknown[]) => void;

function createSocket(data: Socket['data'] = {}) {
    const handlers = new Map<string, RegisteredHandler>();
    const socket = {
        data,
        handshake: { address: '127.0.0.1' },
        id: 'socket-1',
        on: (event: string, handler: RegisteredHandler) => {
            handlers.set(event, handler);
            return socket;
        },
    } as unknown as Socket;

    return { handlers, socket };
}

function createDeps() {
    const musicDB = new Map<string, Music>();
    const added: Music[] = [];
    return {
        added,
        deps: {
            emit: () => true,
            fileStore: {
                add: (music: Music) => {
                    added.push(music);
                },
                clear: () => {},
                load: () => [],
                remove: () => {},
            } satisfies Store,
            musicDB,
            youtubeService: {
                getVideoDetails: (id: string) =>
                    Promise.resolve(ok({
                        channelId: 'channel',
                        channelTitle: 'Channel',
                        duration: 'PT1M',
                        isAgeRestricted: false,
                        title: `Video ${id}`,
                    })),
            } as unknown as YouTubeService,
        },
        musicDB,
    };
}

function waitForReply(handler: RegisteredHandler, ...args: unknown[]) {
    return new Promise<unknown>(resolve => handler(...args, resolve));
}

describe('musicHandlers Socket.IO compatibility', () => {
    afterEach(() => {
        resetMusicService();
    });

    test('addMusic は旧 url + requesterHash + requesterName payload を受け付ける', async () => {
        const { deps, musicDB } = createDeps();
        const { handlers, socket } = createSocket();
        createMusicHandlers(deps).register(socket);

        const reply = await waitForReply(
            handlers.get('addMusic')!,
            'https://www.youtube.com/watch?v=abcdefghijk',
            'legacy-hash',
            'Legacy Name',
        );

        expect(reply).toEqual({});
        expect(musicDB.get('abcdefghijk')?.requesterHash).toBe('legacy-hash');
        expect(musicDB.get('abcdefghijk')?.requesterName).toBe('Legacy Name');
    });

    test('addMusic は socket.data の identity を旧 payload より優先する', async () => {
        const { deps, musicDB } = createDeps();
        const { handlers, socket } = createSocket({
            requesterHash: 'socket-hash',
            requesterName: 'Socket Name',
        });
        createMusicHandlers(deps).register(socket);

        const reply = await waitForReply(
            handlers.get('addMusic')!,
            'https://www.youtube.com/watch?v=lmnopqrstuv',
            'legacy-hash',
            'Legacy Name',
        );

        expect(reply).toEqual({});
        expect(musicDB.get('lmnopqrstuv')?.requesterHash).toBe('socket-hash');
        expect(musicDB.get('lmnopqrstuv')?.requesterName).toBe('Socket Name');
    });
});
