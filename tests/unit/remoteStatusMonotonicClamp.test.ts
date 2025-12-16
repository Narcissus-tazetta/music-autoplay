import { useMusicStore } from '@/shared/stores/musicStore';
import { beforeEach, describe, expect, test } from 'bun:test';

describe('remoteStatus monotonic clamp', () => {
    beforeEach(() => {
        (useMusicStore as any).setState({
            remoteStatus: null,
            lastAuthoritativePause: null,
            lastSequenceNumber: 0,
            lastServerTimestamp: 0,
            lastTraceId: '',
            lastEventReceivedAt: 0,
        });
    });

    test('clamps small backward jitter for same video', () => {
        const now = Date.now();
        useMusicStore.getState().remoteStatusUpdated({
            type: 'playing',
            musicId: 'v1',
            videoId: 'v1',
            currentTime: 30,
            duration: 100,
            progressPercent: 30,
            lastProgressUpdate: now,
            _meta: { sequenceNumber: 10, serverTimestamp: now, traceId: 't1' },
        } as any);

        useMusicStore.getState().remoteStatusUpdated({
            type: 'playing',
            musicId: 'v1',
            videoId: 'v1',
            currentTime: 29.4,
            duration: 100,
            lastProgressUpdate: now + 1000,
            _meta: { sequenceNumber: 11, serverTimestamp: now + 1000, traceId: 't2' },
        } as any);

        const state = useMusicStore.getState();
        expect((state.remoteStatus as any).type).toBe('playing');
        expect((state.remoteStatus as any).currentTime).toBe(30);
    });

    test('allows large backward seek', () => {
        const now = Date.now();
        useMusicStore.getState().remoteStatusUpdated({
            type: 'playing',
            musicId: 'v1',
            videoId: 'v1',
            currentTime: 30,
            duration: 100,
            lastProgressUpdate: now,
            _meta: { sequenceNumber: 10, serverTimestamp: now, traceId: 't1' },
        } as any);

        useMusicStore.getState().remoteStatusUpdated({
            type: 'playing',
            musicId: 'v1',
            videoId: 'v1',
            currentTime: 20,
            duration: 100,
            lastProgressUpdate: now + 1000,
            _meta: { sequenceNumber: 11, serverTimestamp: now + 1000, traceId: 't2' },
        } as any);

        const state = useMusicStore.getState();
        expect((state.remoteStatus as any).currentTime).toBe(20);
    });
});
