import { describe, expect, test } from 'bun:test';
import { MusicRepository } from '../../src/server/music/repository/musicRepository';
import { setupExtensionEventHandlers } from '../../src/server/socket/handlers/extensionEventHandlers';
import createFakeEmitter from '../helpers/fakeEmitter';
import createFakeSocket from '../helpers/fakeSocket';

describe('ad_state_changed sequences', () => {
    test('ad_start -> ad_end toggles isAdvertisement and video_ended still triggers next', async () => {
        const socket = createFakeSocket();
        const musicMap = new Map();
        musicMap.set('AAAaaaAAA00', {
            id: 'AAAaaaAAA00',
            title: 'A',
            channelId: 'c',
            channelName: 'cn',
            duration: 'PT1M',
            requestedAt: new Date().toISOString(),
            requesterHash: 't',
        });
        musicMap.set('BBBbbbBBB11', {
            id: 'BBBbbbBBB11',
            title: 'B',
            channelId: 'c',
            channelName: 'cn',
            duration: 'PT1M',
            requestedAt: new Date().toISOString(),
            requesterHash: 't',
        });
        const repo = new MusicRepository(musicMap, undefined as any);
        const emitter = createFakeEmitter();
        const updates: any[] = [];
        const manager: any = {
            update: (s: any, reason: any) => updates.push({ s, reason }),
            getCurrent: () => ({ type: 'playing', currentTime: 12, duration: 60, progressPercent: 20 }),
        };
        const youtubeService: any = {};
        const log: any = { info() {}, warn() {}, debug() {} };

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

        socket.trigger('ad_state_changed', { url: 'https://youtu.be/AAAaaaAAA00', isAd: true, timestamp: Date.now() });
        await new Promise(res => setTimeout(res, 0));
        expect(updates.some(u => u.reason === 'ad_started' && u.s.isAdvertisement === true)).toBe(true);

        socket.trigger('ad_state_changed', { url: 'https://youtu.be/AAAaaaAAA00', isAd: false, timestamp: Date.now() });
        await new Promise(res => setTimeout(res, 0));
        expect(updates.some(u => u.reason === 'ad_ended' && u.s.isAdvertisement === false)).toBe(true);

        socket.trigger('video_ended', { url: 'https://youtu.be/AAAaaaAAA00', tabId: 5 });
        await new Promise(res => setTimeout(res, 0));
        const emitted = socket.getEmitted();
        const next = emitted.find(e => e.event === 'next_video_navigate');
        expect(next).toBeDefined();
        expect((next!.data[0].nextUrl as string).includes('BBBbbbBBB11')).toBe(true);
    });
});
