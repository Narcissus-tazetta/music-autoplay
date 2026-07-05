import { describe, expect, test } from 'bun:test';
import { setupExtensionEventHandlers } from '../../src/server/socket/handlers/extensionEventHandlers';
import createFakeEmitter from '../helpers/fakeEmitter';
import createFakeRepo from '../helpers/fakeRepo';
import createFakeSocket from '../helpers/fakeSocket';

describe('progress ordering', () => {
    test('ignores out-of-order progress updates by timestamp', async () => {
        const socket = createFakeSocket();
        const repo = createFakeRepo([{ id: 'dQw4w9WgXcQ', url: 'https://youtu.be/dQw4w9WgXcQ' }]);
        const emitter = createFakeEmitter();
        const updates: any[] = [];
        let current: any = { type: 'closed' };
        const manager: any = {
            update: (s: any) => {
                current = s;
                updates.push(s);
            },
            getCurrent: () => current,
        };
        const youtubeService: any = {};
        const log: any = { debug() {}, info() {}, warn() {} };

        (socket as any).id = 'test-socket-id';

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

        const base = Date.now();
        socket.trigger('youtube_video_state', {
            state: 'playing',
            url: 'https://youtu.be/dQw4w9WgXcQ',
            timestamp: base,
            seq: 1,
        });
        const p = (currentTime: number, timestamp: number) => ({
            url: 'https://youtu.be/dQw4w9WgXcQ',
            currentTime,
            duration: 100,
            playbackRate: 1,
            timestamp,
            visibilityState: 'visible',
            isBuffering: false,
        });

        socket.trigger('progress_update', p(10, base + 1000));
        socket.trigger('progress_update', p(12, base + 2000));
        socket.trigger('progress_update', p(11, base + 1500));

        await new Promise(resolve => setTimeout(resolve, 100));

        const progressUpdates = updates.filter(
            u => u.type === 'playing' && typeof u.lastProgressUpdate === 'number',
        );
        expect(progressUpdates.length).toBe(2);
        expect(progressUpdates[0].currentTime).toBe(10);
        expect(progressUpdates[1].currentTime).toBe(12);
        expect(progressUpdates[1].lastProgressUpdate).toBe(base + 2000);
    });

    test('ignores regressive progress updates with same timestamp', async () => {
        const socket = createFakeSocket();
        const repo = createFakeRepo([{ id: 'dQw4w9WgXcQ', url: 'https://youtu.be/dQw4w9WgXcQ' }]);
        const emitter = createFakeEmitter();
        const updates: any[] = [];
        let current: any = { type: 'closed' };
        const manager: any = {
            update: (s: any) => {
                current = s;
                updates.push(s);
            },
            getCurrent: () => current,
        };
        const youtubeService: any = {};
        const log: any = { debug() {}, info() {}, warn() {} };

        (socket as any).id = 'test-socket-id';

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

        const ts = Date.now();
        socket.trigger('youtube_video_state', {
            state: 'playing',
            url: 'https://youtu.be/dQw4w9WgXcQ',
            timestamp: ts,
            seq: 1,
        });
        const p = (currentTime: number) => ({
            url: 'https://youtu.be/dQw4w9WgXcQ',
            currentTime,
            duration: 100,
            playbackRate: 1,
            timestamp: ts,
            visibilityState: 'visible',
            isBuffering: false,
        });

        socket.trigger('progress_update', p(10));
        socket.trigger('progress_update', p(9));

        await new Promise(resolve => setTimeout(resolve, 100));

        const progressUpdates = updates.filter(
            u => u.type === 'playing' && typeof u.lastProgressUpdate === 'number',
        );
        expect(progressUpdates.length).toBe(1);
        expect(progressUpdates[0].currentTime).toBe(10);
    });

    test('does not override authoritative paused with older/equal seq progress', async () => {
        const socket = createFakeSocket();
        const repo = createFakeRepo([{ id: 'dQw4w9WgXcQ', url: 'https://youtu.be/dQw4w9WgXcQ' }]);
        const emitter = createFakeEmitter();
        const updates: any[] = [];
        let current: any = { type: 'closed' };
        const manager: any = {
            update: (s: any) => {
                current = s;
                updates.push(s);
            },
            getCurrent: () => current,
        };
        const youtubeService: any = {};
        const log: any = { debug() {}, info() {}, warn() {} };

        (socket as any).id = 'test-socket-id';

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

        const base = Date.now();
        socket.trigger('youtube_video_state', {
            state: 'paused',
            url: 'https://youtu.be/dQw4w9WgXcQ',
            currentTime: 10,
            duration: 100,
            timestamp: base,
            seq: 5,
        });

        socket.trigger('progress_update', {
            url: 'https://youtu.be/dQw4w9WgXcQ',
            currentTime: 12,
            duration: 100,
            playbackRate: 1,
            timestamp: base + 5000,
            visibilityState: 'visible',
            isBuffering: false,
            seq: 5,
        });

        socket.trigger('progress_update', {
            url: 'https://youtu.be/dQw4w9WgXcQ',
            currentTime: 13,
            duration: 100,
            playbackRate: 1,
            timestamp: base + 6000,
            visibilityState: 'visible',
            isBuffering: false,
            seq: 4,
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        // progress must not flip status to playing; youtube_video_state is authoritative
        expect(updates.length).toBe(1);
        expect(updates[updates.length - 1].type).toBe('paused');
    });

    test('keeps paused even if progress arrives, and resumes only on youtube_video_state:playing', async () => {
        const socket = createFakeSocket();
        const repo = createFakeRepo([{ id: 'dQw4w9WgXcQ', url: 'https://youtu.be/dQw4w9WgXcQ' }]);
        const emitter = createFakeEmitter();
        const updates: any[] = [];
        let current: any = { type: 'closed' };
        const manager: any = {
            update: (s: any) => {
                current = s;
                updates.push(s);
            },
            getCurrent: () => current,
        };
        const youtubeService: any = {};
        const log: any = { debug() {}, info() {}, warn() {} };

        (socket as any).id = 'test-socket-id';

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

        const realDateNow = Date.now;
        try {
            let now = 1_000_000;
            (Date as any).now = () => now;

            // Authoritative pause at time T
            socket.trigger('youtube_video_state', {
                state: 'paused',
                url: 'https://youtu.be/dQw4w9WgXcQ',
                currentTime: 10,
                duration: 100,
                timestamp: now,
                seq: 2,
            });

            // First batch update (within grace) seeds prevTime/prevTimestamp
            socket.trigger('progress_update_batch', {
                updates: [
                    {
                        url: 'https://youtu.be/dQw4w9WgXcQ',
                        currentTime: 10,
                        duration: 100,
                        playbackRate: 1,
                        timestamp: now + 100,
                        visibilityState: 'visible',
                        isBuffering: false,
                    },
                ],
            });

            // Progress arriving while paused should NOT flip to playing
            socket.trigger('progress_update_batch', {
                updates: [
                    {
                        url: 'https://youtu.be/dQw4w9WgXcQ',
                        currentTime: 10,
                        duration: 100,
                        playbackRate: 1,
                        timestamp: now,
                        visibilityState: 'hidden',
                        isBuffering: false,
                    },
                ],
            });

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(updates.length).toBeGreaterThan(0);
            expect(updates[updates.length - 1].type).toBe('paused');

            // Authoritative playing should allow immediate resume
            socket.trigger('youtube_video_state', {
                state: 'playing',
                url: 'https://youtu.be/dQw4w9WgXcQ',
                currentTime: 10,
                duration: 100,
                timestamp: now + 1,
                seq: 3,
            });

            socket.trigger('progress_update_batch', {
                updates: [
                    {
                        url: 'https://youtu.be/dQw4w9WgXcQ',
                        currentTime: 10.5,
                        duration: 100,
                        playbackRate: 1,
                        timestamp: now + 1000,
                        visibilityState: 'visible',
                        isBuffering: false,
                    },
                ],
            });

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(updates[updates.length - 1].type).toBe('playing');
        } finally {
            (Date as any).now = realDateNow;
        }
    });

    test('does not promote closed to playing from progress_update_batch without authoritative playing', async () => {
        const socket = createFakeSocket();
        const repo = createFakeRepo([{ id: 'dQw4w9WgXcQ', url: 'https://youtu.be/dQw4w9WgXcQ' }]);
        const emitter = createFakeEmitter();
        const updates: any[] = [];
        let current: any = { type: 'closed' };
        const manager: any = {
            update: (s: any) => {
                current = s;
                updates.push(s);
            },
            getCurrent: () => current,
        };
        const youtubeService: any = {};
        const log: any = { debug() {}, info() {}, warn() {} };

        (socket as any).id = 'test-socket-id';

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

        const base = Date.now();
        socket.trigger('progress_update_batch', {
            updates: [
                {
                    url: 'https://youtu.be/dQw4w9WgXcQ',
                    currentTime: 1,
                    duration: 100,
                    playbackRate: 1,
                    timestamp: base + 1000,
                    visibilityState: 'visible',
                    isBuffering: false,
                },
            ],
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(updates.length).toBe(0);
        expect(current.type).toBe('closed');

        socket.trigger('youtube_video_state', {
            state: 'playing',
            url: 'https://youtu.be/dQw4w9WgXcQ',
            timestamp: base + 1200,
            seq: 1,
        });

        socket.trigger('progress_update_batch', {
            updates: [
                {
                    url: 'https://youtu.be/dQw4w9WgXcQ',
                    currentTime: 2,
                    duration: 100,
                    playbackRate: 1,
                    timestamp: base + 1300,
                    visibilityState: 'visible',
                    isBuffering: false,
                    seq: 1,
                },
            ],
        });

        await new Promise(resolve => setTimeout(resolve, 50));
        expect(current.type).toBe('playing');
    });

    test('ignores stale youtube_video_state playing shortly after paused', async () => {
        const socket = createFakeSocket();
        const repo = createFakeRepo([{ id: 'dQw4w9WgXcQ', url: 'https://youtu.be/dQw4w9WgXcQ' }]);
        const emitter = createFakeEmitter();
        const updates: any[] = [];
        let current: any = { type: 'closed' };
        const manager: any = {
            update: (s: any) => {
                current = s;
                updates.push(s);
            },
            getCurrent: () => current,
        };
        const youtubeService: any = {};
        const log: any = { debug() {}, info() {}, warn() {} };

        (socket as any).id = 'test-socket-id';

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

        const realDateNow = Date.now;
        try {
            let now = 2_000_000;
            (Date as any).now = () => now;

            socket.trigger('youtube_video_state', {
                state: 'paused',
                url: 'https://youtu.be/dQw4w9WgXcQ',
                currentTime: 10,
                duration: 100,
                timestamp: now,
                seq: 5,
            });

            await new Promise(resolve => setTimeout(resolve, 30));

            now += 1000;

            socket.trigger('youtube_video_state', {
                state: 'playing',
                url: 'https://youtu.be/dQw4w9WgXcQ',
                currentTime: 10.2,
                duration: 100,
                timestamp: now,
                seq: 5,
            });

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(updates[updates.length - 1].type).toBe('paused');
        } finally {
            (Date as any).now = realDateNow;
        }
    });

    test('progress_update_batch processes only the latest update', async () => {
        const socket = createFakeSocket();
        const repo = createFakeRepo([{ id: 'dQw4w9WgXcQ', url: 'https://youtu.be/dQw4w9WgXcQ' }]);
        const emitter = createFakeEmitter();
        const updates: any[] = [];
        let current: any = { type: 'closed' };
        const manager: any = {
            update: (s: any) => {
                current = s;
                updates.push(s);
            },
            getCurrent: () => current,
        };
        const youtubeService: any = {};
        const log: any = { debug() {}, info() {}, warn() {} };

        (socket as any).id = 'test-socket-id';

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

        const base = Date.now();
        socket.trigger('youtube_video_state', {
            state: 'playing',
            url: 'https://youtu.be/dQw4w9WgXcQ',
            timestamp: base,
            seq: 1,
        });
        socket.trigger('progress_update_batch', {
            updates: [
                {
                    url: 'https://youtu.be/dQw4w9WgXcQ',
                    currentTime: 10,
                    duration: 100,
                    playbackRate: 1,
                    timestamp: base + 1000,
                    visibilityState: 'visible',
                    isBuffering: false,
                    seq: 1,
                },
                {
                    url: 'https://youtu.be/dQw4w9WgXcQ',
                    currentTime: 12,
                    duration: 100,
                    playbackRate: 1,
                    timestamp: base + 2000,
                    visibilityState: 'visible',
                    isBuffering: false,
                    seq: 2,
                },
            ],
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        const progressUpdates = updates.filter(
            u => u.type === 'playing' && typeof u.lastProgressUpdate === 'number',
        );
        expect(progressUpdates.length).toBe(1);
        expect(progressUpdates[0].type).toBe('playing');
        expect(progressUpdates[0].currentTime).toBe(12);
        expect(progressUpdates[0].lastProgressUpdate).toBe(base + 2000);
    });

    test('progress_update_batch scans replay-start updates to reset completion dedupe', async () => {
        const music = {
            channelId: 'channel-1',
            channelName: 'channel name',
            duration: 'PT3M',
            id: 'dQw4w9WgXcQ',
            requestedAt: '2026-06-27T00:00:00.000Z',
            requesterHash: 'requester-hash',
            requesterName: 'guest',
            title: 'Test Song',
            url: 'https://youtu.be/dQw4w9WgXcQ',
        };
        const socket = createFakeSocket();
        const repo = createFakeRepo([music]);
        const emitter = createFakeEmitter();
        const historyCalls: any[] = [];
        const historyService = {
            recordPlayed(playedMusic: any) {
                historyCalls.push(playedMusic);
                return {
                    id: playedMusic.id,
                    playCount: historyCalls.filter(call => call.id === playedMusic.id).length,
                    title: playedMusic.title,
                };
            },
        };
        let current: any = { type: 'closed' };
        const manager: any = {
            update: (s: any) => {
                current = s;
            },
            getCurrent: () => current,
        };
        const youtubeService: any = {};
        const log: any = { debug() {}, info() {}, warn() {} };

        (socket as any).id = 'test-socket-id';

        setupExtensionEventHandlers(
            socket as any,
            log,
            'conn',
            new Map(),
            manager,
            repo as any,
            emitter as any,
            youtubeService,
            historyService as any,
        );

        const base = Date.now();
        const url = 'https://youtu.be/dQw4w9WgXcQ';
        const progress = (currentTime: number, timestamp: number, seq: number) => ({
            url,
            currentTime,
            duration: 100,
            playbackRate: 1,
            timestamp,
            visibilityState: 'visible',
            isBuffering: false,
            seq,
        });

        socket.trigger('youtube_video_state', {
            state: 'playing',
            url,
            timestamp: base,
            seq: 1,
        });
        socket.trigger('progress_update', progress(99, base + 1000, 2));
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(historyCalls.length).toBe(1);

        socket.trigger('progress_update_batch', {
            updates: [
                progress(2, base + 2000, 3),
                progress(99, base + 3000, 4),
            ],
        });
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(historyCalls.length).toBe(2);
        expect(historyCalls.every(call => call.id === 'dQw4w9WgXcQ')).toBe(true);
    });
});
