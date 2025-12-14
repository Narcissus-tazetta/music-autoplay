import { describe, expect, test } from 'bun:test';
import { MusicRepository } from '../../src/server/music/repository/musicRepository';
import { setupExtensionEventHandlers } from '../../src/server/socket/handlers/extensionEventHandlers';
import createFakeEmitter from '../helpers/fakeEmitter';
import createFakeSocket from '../helpers/fakeSocket';

describe('move_next_video / move_prev_video handlers', () => {
    test('move_next_video emits next_url and updates manager', async () => {
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
        musicMap.set('CCCcccCCC22', {
            id: 'CCCcccCCC22',
            title: 'C',
            channelId: 'c',
            channelName: 'cn',
            duration: 'PT1M',
            requestedAt: new Date().toISOString(),
            requesterHash: 't',
        });
        const repo = new MusicRepository(musicMap, undefined as any);
        const emitter = createFakeEmitter();
        const updatedCalls: any[] = [];
        const manager: any = {
            update: (s: any, reason: any) => updatedCalls.push({ s, reason }),
            getCurrent: () => ({ type: 'playing', currentTime: 0, duration: 60, progressPercent: 0 }),
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

        socket.trigger('move_next_video', { url: 'https://youtu.be/AAAaaaAAA00', tabId: 1 });
        await new Promise(res => setTimeout(res, 0));
        const emitted = socket.getEmitted();
        const next = emitted.find(e => e.event === 'next_video_navigate');
        expect(next).toBeDefined();
        expect((next!.data[0].nextUrl as string).includes('BBBbbbBBB11')).toBe(true);
        expect(updatedCalls.some(c => c.reason === 'move_next_video' && c.s.musicId === 'BBBbbbBBB11')).toBe(true);
    });

    test('move_prev_video emits previous url and updates manager', async () => {
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
        musicMap.set('CCCcccCCC22', {
            id: 'CCCcccCCC22',
            title: 'C',
            channelId: 'c',
            channelName: 'cn',
            duration: 'PT1M',
            requestedAt: new Date().toISOString(),
            requesterHash: 't',
        });
        const repo = new MusicRepository(musicMap, undefined as any);
        const emitter = createFakeEmitter();
        const updatedCalls: any[] = [];
        const manager: any = {
            update: (s: any, reason: any) => updatedCalls.push({ s, reason }),
            getCurrent: () => ({ type: 'playing', currentTime: 0, duration: 60, progressPercent: 0 }),
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

        socket.trigger('move_prev_video', { url: 'https://youtu.be/AAAaaaAAA00', tabId: 2 });
        await new Promise(res => setTimeout(res, 0));
        const emitted = socket.getEmitted();
        const next = emitted.find(e => e.event === 'next_video_navigate');
        expect(next).toBeDefined();
        expect((next!.data[0].nextUrl as string).includes('CCCcccCCC22')).toBe(true);
        expect(updatedCalls.some(c => c.reason === 'move_prev_video' && c.s.musicId === 'CCCcccCCC22')).toBe(true);
    });
});
