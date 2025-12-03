import { describe, expect, test } from 'bun:test';
import { usePlayingMusic } from '../../src/app/hooks/usePlayingMusic';
import type { Music, RemoteStatus } from '../../src/shared/stores/musicStore';

describe('usePlayingMusic hook', () => {
    const musics: Music[] = [
        {
            id: 'abc123',
            title: 'Test Song 1',
            channelName: 'Test Channel',
            channelId: 'channel1',
            duration: '3:45',
        },
        {
            id: 'def456',
            title: 'Test Song 2',
            channelName: 'Test Channel 2',
            channelId: 'channel2',
            duration: '4:20',
        },
    ];

    test('returns undefined when remoteStatus is null', () => {
        const result = usePlayingMusic(musics, null);
        expect(result).toBeUndefined();
    });

    test('returns undefined when remoteStatus type is paused without title or id', () => {
        const status: RemoteStatus = { type: 'paused' };
        const result = usePlayingMusic(musics, status);
        expect(result).toBeUndefined();
    });

    test('returns music when remoteStatus type is paused and title matches', () => {
        const status: RemoteStatus = { type: 'paused', musicTitle: 'Test Song 1' };
        const result = usePlayingMusic(musics, status);
        expect(result?.id).toBe('abc123');
    });

    test('returns undefined when remoteStatus type is closed', () => {
        const status: RemoteStatus = { type: 'closed' };
        const result = usePlayingMusic(musics, status);
        expect(result).toBeUndefined();
    });

    test('finds music by musicId when available', () => {
        const status: RemoteStatus = {
            type: 'playing',
            musicTitle: 'Wrong Title',
            musicId: 'abc123',
        };
        const result = usePlayingMusic(musics, status);
        expect(result?.id).toBe('abc123');
        expect(result?.title).toBe('Test Song 1');
    });

    test('falls back to title matching when musicId not available', () => {
        const status: RemoteStatus = {
            type: 'playing',
            musicTitle: 'Test Song 2',
        };
        const result = usePlayingMusic(musics, status);
        expect(result?.id).toBe('def456');
        expect(result?.title).toBe('Test Song 2');
    });

    test('returns undefined when no music matches', () => {
        const status: RemoteStatus = {
            type: 'playing',
            musicTitle: 'Nonexistent Song',
        };
        const result = usePlayingMusic(musics, status);
        expect(result).toBeUndefined();
    });

    test('prioritizes musicId over title when both present', () => {
        const status: RemoteStatus = {
            type: 'playing',
            musicTitle: 'Test Song 2',
            musicId: 'abc123',
        };
        const result = usePlayingMusic(musics, status);
        expect(result?.id).toBe('abc123');
        expect(result?.title).toBe('Test Song 1');
    });

    test('handles empty musics array', () => {
        const status: RemoteStatus = {
            type: 'playing',
            musicTitle: 'Test Song',
            musicId: 'abc123',
        };
        const result = usePlayingMusic([], status);
        expect(result).toBeUndefined();
    });

    test('handles empty musicId string', () => {
        const status: RemoteStatus = {
            type: 'playing',
            musicTitle: 'Test Song 1',
            musicId: '',
        };
        const result = usePlayingMusic(musics, status);
        expect(result?.id).toBe('abc123');
    });
});
