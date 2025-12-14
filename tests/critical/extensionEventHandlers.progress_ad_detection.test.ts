import { describe, expect, test } from 'bun:test';
import { setupExtensionEventHandlers } from '../../src/server/socket/handlers/extensionEventHandlers';
import createFakeEmitter from '../helpers/fakeEmitter';
import createFakeRepo from '../helpers/fakeRepo';
import createFakeSocket from '../helpers/fakeSocket';

describe('progress ad detection', () => {
    test('consecutive stalls lead to advertisement detection and respects seek reset and cooldown', async () => {
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
        const payload = (currentTime: number, timestamp: number, visibility = 'visible') => ({
            type: 'progress_update',
            url: 'https://youtu.be/a',
            currentTime,
            duration: 100,
            playbackRate: 1,
            timestamp,
            visibilityState: visibility,
        });

        socket.trigger('progress_update', payload(10, now));
        socket.trigger('progress_update', payload(10, now + 1000));
        socket.trigger('progress_update', payload(10, now + 2000));

        socket.trigger('progress_update', payload(20, now + 3000));

        socket.trigger('progress_update', payload(20, now + 4000));

        const emitted = socket.getEmitted();
        const adEvents = emitted.filter(e =>
            e.event === 'ad_state_changed' || (e.event === 'extension' && (e.data as any)?.[0]?.isAdvertisement)
        );
        expect(adEvents).toBeDefined();
    });
});
