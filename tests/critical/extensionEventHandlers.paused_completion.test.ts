import { describe, expect, test } from 'bun:test';
import { MusicRepository } from '../../src/server/music/musicRepository';
import { setupExtensionEventHandlers } from '../../src/server/socket/handlers/extensionEventHandlers';
import createFakeSocket from '../helpers/fakeSocket';

/**
 * Auto-advance driven by a `paused` report sitting at 100% of the duration — the path the
 * extension takes when it never sends `video_ended`. It had no coverage while it was also
 * the one place that ignored emit/persist failures, so these tests pin both the happy path
 * and the error reporting.
 */

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

function createEmitter(overrides: Record<string, unknown> = {}) {
    const calls: { event: string; payload: unknown }[] = [];
    const okEmit = (event: string) => (payload: unknown) => {
        calls.push({ event, payload });
        return { ok: true };
    };
    return {
        calls,
        emitHistoryAdded: okEmit('historyAdded'),
        emitMusicRemoved: okEmit('musicRemoved'),
        emitUrlList: okEmit('urlList'),
        ...overrides,
    };
}

function createHistoryService() {
    const recorded: { id: string }[] = [];
    return {
        recorded,
        recordPlayed(music: { id: string; title: string; channelName: string }) {
            recorded.push({ id: music.id });
            return {
                channelId: 'channel-1',
                channelName: music.channelName,
                duration: 'PT3M',
                firstPlayedAt: new Date().toISOString(),
                id: music.id,
                lastPlayedAt: new Date().toISOString(),
                playCount: 1,
                title: music.title,
            };
        },
    };
}

function createLog() {
    const warns: { message: string; meta: unknown }[] = [];
    const noop = () => {};
    return {
        warns,
        debug: noop,
        error: noop,
        info: noop,
        warn: (message: string, meta?: unknown) => {
            warns.push({ message, meta });
        },
    };
}

/** Drives youtube_video_state into the paused-at-100% branch for `videoId`. */
function pausedAtEnd(socket: ReturnType<typeof createFakeSocket>, videoId: string, tabId = 7) {
    socket.trigger('youtube_video_state', {
        currentTime: 180,
        duration: 180,
        isAdvertisement: false,
        state: 'paused',
        tabId,
        url: `https://youtu.be/${videoId}`,
    });
}

function setup(ids: string[], emitterOverrides: Record<string, unknown> = {}) {
    const socket = createFakeSocket();
    const musicMap = new Map(ids.map(id => [id, makeMusic(id)]));
    const repository = new MusicRepository(musicMap, undefined as never);
    const emitter = createEmitter(emitterOverrides);
    const historyService = createHistoryService();
    const log = createLog();
    const updates: { status: { type: string; musicId?: string }; reason?: string }[] = [];

    setupExtensionEventHandlers({
        connectionId: 'conn',
        emitter: emitter as never,
        historyService: historyService as never,
        log: log as never,
        manager: {
            getCurrent: () => ({ type: 'paused', videoId: ids[0] }),
            update: (status: { type: string; musicId?: string }, reason?: string) => {
                updates.push({ reason, status });
            },
        } as never,
        repository: repository as never,
        socket: socket as never,
        youtubeService: {} as never,
    });

    return { emitter, historyService, log, repository, socket, updates };
}

const settle = () => new Promise(res => setTimeout(res, 0));

describe('paused-at-100% auto advance', () => {
    test('removes the finished video, records history and navigates to the next one', async () => {
        const { emitter, historyService, repository, socket, updates } = setup([
            'AAAAAAAAAAA',
            'BBBBBBBBBBB',
        ]);

        pausedAtEnd(socket, 'AAAAAAAAAAA');
        await settle();

        expect(repository.list().map(m => m.id)).toEqual(['BBBBBBBBBBB']);
        expect(historyService.recorded.map(r => r.id)).toEqual(['AAAAAAAAAAA']);

        const events = emitter.calls.map(c => c.event);
        expect(events).toContain('musicRemoved');
        expect(events).toContain('urlList');

        const navigate = socket.getEmitted().find(e => e.event === 'next_video_navigate');
        expect(navigate).toBeDefined();
        expect(navigate?.data[0].nextUrl).toBe('https://www.youtube.com/watch?v=BBBBBBBBBBB');
        expect(updates.some(u => u.reason === 'paused_100_navigate' && u.status.musicId === 'BBBBBBBBBBB')).toBe(true);
    });

    test('wraps to the first entry when the finished video was last', async () => {
        const { socket } = setup(['AAAAAAAAAAA', 'BBBBBBBBBBB']);

        pausedAtEnd(socket, 'BBBBBBBBBBB');
        await settle();

        const navigate = socket.getEmitted().find(e => e.event === 'next_video_navigate');
        expect(navigate?.data[0].nextUrl).toBe('https://www.youtube.com/watch?v=AAAAAAAAAAA');
    });

    test('reports no next video once the queue empties', async () => {
        const { repository, socket, updates } = setup(['AAAAAAAAAAA']);

        pausedAtEnd(socket, 'AAAAAAAAAAA');
        await settle();

        expect(repository.list()).toHaveLength(0);
        expect(socket.getEmitted().some(e => e.event === 'no_next_video')).toBe(true);
        expect(socket.getEmitted().some(e => e.event === 'next_video_navigate')).toBe(false);
        expect(updates.some(u => u.reason === 'paused_100_no_next' && u.status.type === 'closed')).toBe(true);
    });

    test('a failed musicRemoved broadcast is logged instead of silently swallowed', async () => {
        const { log, socket } = setup(['AAAAAAAAAAA', 'BBBBBBBBBBB'], {
            emitMusicRemoved: () => ({ error: new Error('socket down'), ok: false }),
        });

        pausedAtEnd(socket, 'AAAAAAAAAAA');
        await settle();

        expect(log.warns.some(w => w.message.includes('failed to emit musicRemoved'))).toBe(true);
    });

    test('a failed url_list broadcast is logged and does not stop the advance', async () => {
        const { log, socket } = setup(['AAAAAAAAAAA', 'BBBBBBBBBBB'], {
            emitUrlList: () => ({ error: new Error('socket down'), ok: false }),
        });

        pausedAtEnd(socket, 'AAAAAAAAAAA');
        await settle();

        expect(log.warns.some(w => w.message.includes('failed to emit url_list'))).toBe(true);
        // The broadcast failing must not prevent the queue from moving on.
        expect(socket.getEmitted().some(e => e.event === 'next_video_navigate')).toBe(true);
    });

    test('ignores a paused report for a video that is not queued', async () => {
        const { repository, socket } = setup(['AAAAAAAAAAA']);

        pausedAtEnd(socket, 'ZZZZZZZZZZZ');
        await settle();

        expect(repository.list().map(m => m.id)).toEqual(['AAAAAAAAAAA']);
        expect(socket.getEmitted().some(e => e.event === 'next_video_navigate')).toBe(false);
    });

    test('does not fire while an advertisement is playing at the end of the video', async () => {
        const { repository, socket } = setup(['AAAAAAAAAAA', 'BBBBBBBBBBB']);

        socket.trigger('youtube_video_state', {
            currentTime: 180,
            duration: 180,
            isAdvertisement: true,
            state: 'paused',
            tabId: 7,
            url: 'https://youtu.be/AAAAAAAAAAA',
        });
        await settle();

        expect(repository.list().map(m => m.id)).toEqual(['AAAAAAAAAAA', 'BBBBBBBBBBB']);
    });
});
