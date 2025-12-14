import { describe, expect, test } from 'bun:test';
import { setupExtensionEventHandlers } from '../../src/server/socket/handlers/extensionEventHandlers';
import createFakeEmitter from '../helpers/fakeEmitter';
import createFakeRepo from '../helpers/fakeRepo';
import createFakeSocket from '../helpers/fakeSocket';

describe('visibility state handling', () => {
    test('hidden visibility resets consecutive stalls and prevents ad decision', () => {
        const socket = createFakeSocket();
        const repo = createFakeRepo([{ id: 'a', url: 'https://youtu.be/a' }]);
        const emitter = createFakeEmitter();
        const manager: any = { update: () => {} };
        const youtubeService: any = {};
        const log: any = { debug() {}, info() {}, warn() {} };
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

        const now = Date.now();
        socket.trigger('progress_update', {
            type: 'progress_update',
            url: 'https://youtu.be/a',
            currentTime: 10,
            duration: 100,
            timestamp: now,
        });
        socket.trigger('progress_update', {
            type: 'progress_update',
            url: 'https://youtu.be/a',
            currentTime: 10,
            duration: 100,
            timestamp: now + 1000,
        });
        socket.trigger('progress_update', {
            type: 'progress_update',
            url: 'https://youtu.be/a',
            currentTime: 10,
            duration: 100,
            visibilityState: 'hidden',
            timestamp: now + 2000,
        });

        const emitted = socket.getEmitted();
        const adEvents = emitted.filter(e => e.event === 'ad_state_changed');
        expect(adEvents.length).toBe(0);
    });
});
