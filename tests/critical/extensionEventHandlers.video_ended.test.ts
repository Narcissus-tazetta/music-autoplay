import { describe, expect, test } from 'bun:test';
import { MusicRepository } from '../../src/server/music/repository/musicRepository';
import { setupExtensionEventHandlers } from '../../src/server/socket/handlers/extensionEventHandlers';
import createFakeEmitter from '../helpers/fakeEmitter';
import createFakeSocket from '../helpers/fakeSocket';
// removed unused import to satisfy lint

describe('video_ended handler', () => {
    test('removes ended video and emits next_video_navigate when repo has next', async () => {
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
        // next_video_navigate should have been emitted
        expect(next).toBeDefined();
        expect(next?.data[0].nextUrl).toBe('https://www.youtube.com/watch?v=BBBBBBBBBBB');
        const repoState = repo.list();
        expect(repoState.length).toBe(1);
        expect(repoState[0].id).toBe('BBBBBBBBBBB');
    });
});
