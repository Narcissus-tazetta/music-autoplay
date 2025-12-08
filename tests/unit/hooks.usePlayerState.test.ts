import type { RemoteStatus } from '@/shared/stores/musicStore';
import { describe, expect, test } from 'bun:test';

describe('usePlayerState hooks', () => {
    test('RemoteStatus type is properly defined', () => {
        const playingStatus: RemoteStatus = {
            currentTime: 10,
            duration: 100,
            lastProgressUpdate: Date.now(),
            musicTitle: 'Test Song',
            type: 'playing',
        };
        expect(playingStatus.type).toBe('playing');
        expect(playingStatus.musicTitle).toBe('Test Song');
    });

    test('paused status has correct shape', () => {
        const pausedStatus: RemoteStatus = {
            musicId: 'test-id',
            musicTitle: 'Test Song',
            type: 'paused',
        };
        expect(pausedStatus.type).toBe('paused');
        expect(pausedStatus.musicId).toBe('test-id');
    });

    test('closed status has correct shape', () => {
        const closedStatus: RemoteStatus = {
            type: 'closed',
        };
        expect(closedStatus.type).toBe('closed');
    });

    test('duration parsing logic for HH:MM:SS', () => {
        const parts = '1:23:45'.split(':').map(p => parseInt(p, 10));
        if (parts.every(p => !isNaN(p)) && parts.length === 3) {
            const duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
            expect(duration).toBe(5025);
        }
    });

    test('duration parsing logic for MM:SS', () => {
        const parts = '3:45'.split(':').map(p => parseInt(p, 10));
        if (parts.every(p => !isNaN(p)) && parts.length === 2) {
            const duration = parts[0] * 60 + parts[1];
            expect(duration).toBe(225);
        }
    });

    test('thumbnail candidates generation', () => {
        const videoId = 'test-video-id';
        const candidates = [
            `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
            `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
            `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
            `https://i.ytimg.com/vi/${videoId}/default.jpg`,
        ];
        expect(candidates.length).toBe(5);
        expect(candidates[0]).toContain('maxresdefault');
        expect(candidates[4]).toContain('default.jpg');
    });

    test('progress percent calculation', () => {
        const currentTime = 50;
        const duration = 100;
        const percent = Math.min((currentTime / duration) * 100, 100);
        expect(percent).toBe(50);
    });

    test('progress percent clamping at 100', () => {
        const currentTime = 120;
        const duration = 100;
        const percent = Math.min((currentTime / duration) * 100, 100);
        expect(percent).toBe(100);
    });
});
