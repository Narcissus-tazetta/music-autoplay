import { describe, expect, test } from 'bun:test';
import { MusicRepository } from '../../src/server/music/repository/musicRepository';
import { setupExtensionEventHandlers } from '../../src/server/socket/handlers/extensionEventHandlers';
import createFakeEmitter from '../helpers/fakeEmitter';
import createFakeSocket from '../helpers/fakeSocket';
// removed unused import to satisfy lint

const makeMusic = (id: string, title = id) => ({
    channelId: 'channel-1',
    channelName: 'channel name',
    duration: 'PT3M',
    id,
    requestedAt: '2026-06-27T00:00:00.000Z',
    requesterHash: 'requester-hash',
    requesterName: 'guest',
    title,
});

function createFakeHistoryService() {
    const calls: any[] = [];
    return {
        calls,
        recordPlayed(music: any) {
            calls.push(music);
            return {
                channelId: music.channelId,
                channelName: music.channelName,
                duration: music.duration,
                firstPlayedAt: new Date().toISOString(),
                id: music.id,
                lastPlayedAt: new Date().toISOString(),
                playCount: calls.filter(call => call.id === music.id).length,
                requesterHashPrefix: music.requesterHash?.slice(0, 8),
                requesterName: music.requesterName,
                title: music.title,
            };
        },
    };
}

const createManager = () => {
    let current: any = { type: 'playing', musicId: 'AAAAAAAAAAA', videoId: 'AAAAAAAAAAA' };
    return {
        getCurrent: () => current,
        update: (next: any) => {
            current = next;
        },
    };
};

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

    test('records history from youtube_video_state ended even when video_ended is not received', async () => {
        const socket = createFakeSocket();
        const musicMap = new Map();
        musicMap.set('AAAAAAAAAAA', makeMusic('AAAAAAAAAAA', 'A'));
        const repo = new MusicRepository(musicMap, undefined as any);
        const emitter = createFakeEmitter();
        const manager = createManager();
        const youtubeService: any = {};
        const historyService = createFakeHistoryService();
        const log: any = { debug() {}, info() {}, warn() {} };

        setupExtensionEventHandlers(
            socket as any,
            log,
            'conn',
            new Map(),
            manager as any,
            repo as any,
            emitter as any,
            youtubeService,
            historyService as any,
        );

        socket.trigger('youtube_video_state', {
            state: 'ended',
            url: 'https://youtu.be/AAAAAAAAAAA',
            currentTime: 180,
            duration: 180,
        });
        await new Promise(res => setTimeout(res, 0));

        expect(historyService.calls.map(m => m.id)).toEqual(['AAAAAAAAAAA']);
        expect(emitter.getCalls().filter(call => call.event === 'historyAdded')).toHaveLength(1);
    });

    test('records near-end progress and dedupes later video_ended', async () => {
        const socket = createFakeSocket();
        const musicMap = new Map();
        musicMap.set('AAAAAAAAAAA', makeMusic('AAAAAAAAAAA', 'A'));
        musicMap.set('BBBBBBBBBBB', makeMusic('BBBBBBBBBBB', 'B'));
        const repo = new MusicRepository(musicMap, undefined as any);
        const emitter = createFakeEmitter();
        const manager = createManager();
        const youtubeService: any = {};
        const historyService = createFakeHistoryService();
        const log: any = { debug() {}, info() {}, warn() {} };

        setupExtensionEventHandlers(
            socket as any,
            log,
            'conn',
            new Map(),
            manager as any,
            repo as any,
            emitter as any,
            youtubeService,
            historyService as any,
        );

        socket.trigger('youtube_video_state', {
            state: 'playing',
            url: 'https://youtu.be/AAAAAAAAAAA',
            currentTime: 170,
            duration: 180,
            seq: 1,
        });
        socket.trigger('progress_update', {
            url: 'https://youtu.be/AAAAAAAAAAA',
            currentTime: 179.2,
            duration: 180,
            playbackRate: 1,
            timestamp: Date.now(),
            visibilityState: 'visible',
            seq: 2,
        });
        await new Promise(res => setTimeout(res, 0));

        socket.trigger('video_ended', { url: 'https://youtu.be/AAAAAAAAAAA', tabId: 42 });
        await new Promise(res => setTimeout(res, 0));

        expect(historyService.calls.map(m => m.id)).toEqual(['AAAAAAAAAAA']);
        expect(emitter.getCalls().filter(call => call.event === 'historyAdded')).toHaveLength(1);
        expect(repo.list().map(r => r.id)).toEqual(['BBBBBBBBBBB']);
    });

    test('does not recount repeated near-end progress after completion', async () => {
        const socket = createFakeSocket();
        const musicMap = new Map();
        musicMap.set('AAAAAAAAAAA', makeMusic('AAAAAAAAAAA', 'A'));
        const repo = new MusicRepository(musicMap, undefined as any);
        const emitter = createFakeEmitter();
        const manager = createManager();
        const youtubeService: any = {};
        const historyService = createFakeHistoryService();
        const log: any = { debug() {}, info() {}, warn() {} };

        setupExtensionEventHandlers(
            socket as any,
            log,
            'conn',
            new Map(),
            manager as any,
            repo as any,
            emitter as any,
            youtubeService,
            historyService as any,
        );

        const now = Date.now();
        socket.trigger('youtube_video_state', {
            state: 'playing',
            url: 'https://youtu.be/AAAAAAAAAAA',
            currentTime: 170,
            duration: 180,
            seq: 1,
        });
        socket.trigger('progress_update', {
            url: 'https://youtu.be/AAAAAAAAAAA',
            currentTime: 179.2,
            duration: 180,
            playbackRate: 1,
            timestamp: now,
            visibilityState: 'visible',
            seq: 2,
        });
        socket.trigger('progress_update', {
            url: 'https://youtu.be/AAAAAAAAAAA',
            currentTime: 179.8,
            duration: 180,
            playbackRate: 1,
            timestamp: now + 6000,
            visibilityState: 'visible',
            seq: 3,
        });
        await new Promise(res => setTimeout(res, 0));

        expect(historyService.calls.map(m => m.id)).toEqual(['AAAAAAAAAAA']);
        expect(emitter.getCalls().filter(call => call.event === 'historyAdded')).toHaveLength(1);
    });

    test('allows recount after the same video starts over from the beginning', async () => {
        const socket = createFakeSocket();
        const musicMap = new Map();
        musicMap.set('AAAAAAAAAAA', makeMusic('AAAAAAAAAAA', 'A'));
        const repo = new MusicRepository(musicMap, undefined as any);
        const emitter = createFakeEmitter();
        const manager = createManager();
        const youtubeService: any = {};
        const historyService = createFakeHistoryService();
        const log: any = { debug() {}, info() {}, warn() {} };

        setupExtensionEventHandlers(
            socket as any,
            log,
            'conn',
            new Map(),
            manager as any,
            repo as any,
            emitter as any,
            youtubeService,
            historyService as any,
        );

        const now = Date.now();
        socket.trigger('youtube_video_state', {
            state: 'playing',
            url: 'https://youtu.be/AAAAAAAAAAA',
            currentTime: 170,
            duration: 180,
            seq: 1,
        });
        socket.trigger('progress_update', {
            url: 'https://youtu.be/AAAAAAAAAAA',
            currentTime: 179.2,
            duration: 180,
            playbackRate: 1,
            timestamp: now,
            visibilityState: 'visible',
            seq: 2,
        });
        socket.trigger('progress_update', {
            url: 'https://youtu.be/AAAAAAAAAAA',
            currentTime: 2,
            duration: 180,
            playbackRate: 1,
            timestamp: now + 1000,
            visibilityState: 'visible',
            seq: 3,
        });
        socket.trigger('progress_update', {
            url: 'https://youtu.be/AAAAAAAAAAA',
            currentTime: 179.4,
            duration: 180,
            playbackRate: 1,
            timestamp: now + 2000,
            visibilityState: 'visible',
            seq: 4,
        });
        await new Promise(res => setTimeout(res, 0));

        expect(historyService.calls.map(m => m.id)).toEqual(['AAAAAAAAAAA', 'AAAAAAAAAAA']);
        expect(emitter.getCalls().filter(call => call.event === 'historyAdded')).toHaveLength(2);
    });
});
