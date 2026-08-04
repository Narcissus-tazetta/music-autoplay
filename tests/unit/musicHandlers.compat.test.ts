import type { Store } from '@/server/persistence';
import type { YouTubeService } from '@/server/services/youtubeService';
import { createMusicHandlers } from '@/server/socket/handlers/musicHandlers';
import type { Music } from '@/shared/stores/musicStore';
import { ok } from '@/shared/utils/errors/result-handlers';
import { describe, expect, test } from 'bun:test';
import type { Socket } from 'socket.io';

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
    test('addMusic は旧 url + requesterHash + requesterName payload の形を受け付ける', async () => {
        const { deps, musicDB } = createDeps();
        const { handlers, socket } = createSocket();
        createMusicHandlers(deps).register(socket);

        const reply = await waitForReply(
            handlers.get('addMusic')!,
            'https://www.youtube.com/watch?v=abcdefghijk',
            'legacy-hash',
            'Legacy Name',
        );

        // 位置引数の payload 形状は引き続き解釈するが、identity は payload から取らない。
        // 名乗った hash がそのまま所有権になると、他人の hash で削除できてしまう。
        expect(reply).toEqual({});
        expect(musicDB.get('abcdefghijk')?.requesterHash).toBeUndefined();
        expect(musicDB.get('abcdefghijk')?.requesterName).toBe('guest');
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

    // 回帰: 公開されている一覧 (initMusics / url_list / /api/musics) には各曲の
    // requesterHash が含まれる。それを payload で名乗れると、識別情報を持たない
    // クライアント (拡張オリジンを騙るなど) が他人のエントリを削除できてしまう。
    test('removeMusic は payload の requesterHash では他人のエントリを消せない', async () => {
        const { deps, musicDB } = createDeps();
        musicDB.set('abcdefghijk', {
            channelId: 'channel',
            channelName: 'channel',
            duration: 'PT3M',
            id: 'abcdefghijk',
            requesterHash: 'victim-hash',
            requesterName: 'Victim',
            title: 'victim song',
        });

        // socket.data に identity が無い接続 (Cookie 無し / 拡張オリジン)
        const { handlers, socket } = createSocket();
        createMusicHandlers(deps).register(socket);

        const reply = await waitForReply(
            handlers.get('removeMusic')!,
            { requesterHash: 'victim-hash', url: 'https://www.youtube.com/watch?v=abcdefghijk' },
        );

        expect(reply).toHaveProperty('formErrors');
        expect(musicDB.has('abcdefghijk')).toBe(true);
    });

    test('removeMusic は socket.data の identity が所有者と一致すれば消せる', async () => {
        const { deps, musicDB } = createDeps();
        musicDB.set('abcdefghijk', {
            channelId: 'channel',
            channelName: 'channel',
            duration: 'PT3M',
            id: 'abcdefghijk',
            requesterHash: 'owner-hash',
            requesterName: 'Owner',
            title: 'own song',
        });

        const { handlers, socket } = createSocket({ requesterHash: 'owner-hash' });
        createMusicHandlers(deps).register(socket);

        const reply = await waitForReply(
            handlers.get('removeMusic')!,
            { url: 'https://www.youtube.com/watch?v=abcdefghijk' },
        );

        expect(reply).toEqual({});
        expect(musicDB.has('abcdefghijk')).toBe(false);
    });
});
