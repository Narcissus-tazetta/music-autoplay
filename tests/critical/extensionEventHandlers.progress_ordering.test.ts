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
        const manager: any = { update: (s: any) => updates.push(s), getCurrent: () => ({ type: 'closed' }) };
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

        expect(updates.length).toBe(2);
        expect(updates[0].currentTime).toBe(10);
        expect(updates[1].currentTime).toBe(12);
        expect(updates[1].lastProgressUpdate).toBe(base + 2000);
    });

    test('ignores regressive progress updates with same timestamp', async () => {
        const socket = createFakeSocket();
        const repo = createFakeRepo([{ id: 'dQw4w9WgXcQ', url: 'https://youtu.be/dQw4w9WgXcQ' }]);
        const emitter = createFakeEmitter();
        const updates: any[] = [];
        const manager: any = { update: (s: any) => updates.push(s), getCurrent: () => ({ type: 'closed' }) };
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

        expect(updates.length).toBe(1);
        expect(updates[0].currentTime).toBe(10);
    });

    test('does not override authoritative paused with older/equal seq progress', async () => {
        const socket = createFakeSocket();
        const repo = createFakeRepo([{ id: 'dQw4w9WgXcQ', url: 'https://youtu.be/dQw4w9WgXcQ' }]);
        const emitter = createFakeEmitter();
        const updates: any[] = [];
        const manager: any = { update: (s: any) => updates.push(s), getCurrent: () => ({ type: 'closed' }) };
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

        // Last update must remain paused (no forced playing override)
        expect(updates.length).toBeGreaterThan(0);
        expect(updates[updates.length - 1].type).toBe('paused');
    });

    test('keeps paused after authoritative TTL when batch has zero progress, and resumes on youtube_video_state:playing', async () => {
        const socket = createFakeSocket();
        const repo = createFakeRepo([{ id: 'dQw4w9WgXcQ', url: 'https://youtu.be/dQw4w9WgXcQ' }]);
        const emitter = createFakeEmitter();
        const updates: any[] = [];
        const manager: any = { update: (s: any) => updates.push(s), getCurrent: () => ({ type: 'closed' }) };
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

            // Advance beyond authoritative TTL (30s)
            now += 31_000;

            // Zero progress batch should NOT flip to playing even after TTL
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
});
