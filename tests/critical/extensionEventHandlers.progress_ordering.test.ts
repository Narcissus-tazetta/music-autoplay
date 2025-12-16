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
});
