import { describe, expect, test } from 'bun:test';
import { MusicRepository } from '../../src/server/music/repository/musicRepository';
import { setupExtensionEventHandlers } from '../../src/server/socket/handlers/extensionEventHandlers';
import createFakeEmitter from '../helpers/fakeEmitter';
import createFakeSocket from '../helpers/fakeSocket';
// removed unused import to satisfy lint

describe('video_ended handler', () => {
    test('removes ended video and does not navigate', async () => {
        const socket = createFakeSocket();
        const musicMap = new Map();
        musicMap.set('AAAAAAAAAAA', { id: 'AAAAAAAAAAA', title: 'A' });
        musicMap.set('BBBBBBBBBBB', { id: 'BBBBBBBBBBB', title: 'B' });
        const repo = new MusicRepository(musicMap, undefined as any);
        const emitter = createFakeEmitter();
        const manager: any = { update: () => {} };
        const youtubeService: any = {};
        const log: any = console;

        setupExtensionEventHandlers(
            socket as any,
            log,
            'conn',
            new Map(),
            manager,
            repo as any,
            emitter as any,
            youtubeService,
        );

        expect(repo.has('AAAAAAAAAAA')).toBe(true);

        // sanity check fake socket emits are recorded
        socket.emit('sanity_test', { ok: true });
        expect(socket.getEmitted().some(e => e.event === 'sanity_test')).toBe(true);

        socket.trigger('video_ended', { url: 'https://youtu.be/AAAAAAAAAAA', tabId: 42 });

        await new Promise(res => setTimeout(res, 0));

        const emitted = socket.getEmitted();
        const next = emitted.find(e => e.event === 'next_video_navigate');
        expect(next).toBeUndefined();
        const repoState = repo.list();
        expect(repoState.length).toBe(1);
        expect(repoState[0].id).toBe('BBBBBBBBBBB');
    });

    test('video_next navigates using pending candidate from video_ended', async () => {
        const socket = createFakeSocket();
        const musicMap = new Map();
        musicMap.set('AAAAAAAAAAA', { id: 'AAAAAAAAAAA', title: 'A' });
        musicMap.set('BBBBBBBBBBB', { id: 'BBBBBBBBBBB', title: 'B' });
        musicMap.set('CCCCCCCCCCC', { id: 'CCCCCCCCCCC', title: 'C' });
        const repo = new MusicRepository(musicMap, undefined as any);
        const emitter = createFakeEmitter();
        const manager: any = { update: () => {} };
        const youtubeService: any = {};
        const log: any = console;

        setupExtensionEventHandlers(
            socket as any,
            log,
            'conn',
            new Map(),
            manager,
            repo as any,
            emitter as any,
            youtubeService,
        );

        socket.trigger('video_ended', { url: 'https://youtu.be/BBBBBBBBBBB', tabId: 11 });
        await new Promise(res => setTimeout(res, 0));
        socket.trigger('video_next', { url: 'https://youtu.be/BBBBBBBBBBB', tabId: 11 });
        await new Promise(res => setTimeout(res, 0));

        const emitted = socket.getEmitted();
        const next = emitted.find(e => e.event === 'next_video_navigate');
        expect(next).toBeDefined();
        expect(next?.data[0].nextUrl).toBe('https://www.youtube.com/watch?v=CCCCCCCCCCC');

        const remaining = repo.list();
        expect(remaining.map(r => r.id)).toEqual(['AAAAAAAAAAA', 'CCCCCCCCCCC']);
    });

    test('video_next navigates using current list when pending missing', async () => {
        const socket = createFakeSocket();
        const musicMap = new Map();
        musicMap.set('AAAAAAAAAAA', { id: 'AAAAAAAAAAA', title: 'A' });
        musicMap.set('BBBBBBBBBBB', { id: 'BBBBBBBBBBB', title: 'B' });
        musicMap.set('CCCCCCCCCCC', { id: 'CCCCCCCCCCC', title: 'C' });
        const repo = new MusicRepository(musicMap, undefined as any);
        const emitter = createFakeEmitter();
        const manager: any = { update: () => {} };
        const youtubeService: any = {};
        const log: any = console;

        setupExtensionEventHandlers(
            socket as any,
            log,
            'conn',
            new Map(),
            manager,
            repo as any,
            emitter as any,
            youtubeService,
        );

        socket.trigger('video_next', { url: 'https://youtu.be/CCCCCCCCCCC', tabId: 22 });
        await new Promise(res => setTimeout(res, 0));

        const emitted = socket.getEmitted();
        const next = emitted.find(e => e.event === 'next_video_navigate');
        expect(next).toBeDefined();
        expect(next?.data[0].nextUrl).toBe('https://www.youtube.com/watch?v=AAAAAAAAAAA');
        expect(repo.list().map(r => r.id)).toEqual(['AAAAAAAAAAA', 'BBBBBBBBBBB', 'CCCCCCCCCCC']);
    });

    test('video_next ignored when video not in repository', async () => {
        const socket = createFakeSocket();
        const musicMap = new Map();
        musicMap.set('AAAAAAAAAAA', { id: 'AAAAAAAAAAA', title: 'A' });
        musicMap.set('BBBBBBBBBBB', { id: 'BBBBBBBBBBB', title: 'B' });
        const repo = new MusicRepository(musicMap, undefined as any);
        const emitter = createFakeEmitter();
        const manager: any = { update: () => {} };
        const youtubeService: any = {};
        const log: any = console;

        setupExtensionEventHandlers(
            socket as any,
            log,
            'conn',
            new Map(),
            manager,
            repo as any,
            emitter as any,
            youtubeService,
        );
        socket.trigger('video_next', { url: 'https://youtu.be/ZZZZZZZZZZZ', tabId: 9 });
        await new Promise(res => setTimeout(res, 0));

        const emitted = socket.getEmitted();
        const next = emitted.find(e => e.event === 'next_video_navigate');
        const noNext = emitted.find(e => e.event === 'no_next_video');
        expect(next).toBeUndefined();
        expect(noNext).toBeUndefined();
        expect(repo.list().map(r => r.id)).toEqual(['AAAAAAAAAAA', 'BBBBBBBBBBB']);
    });
});
