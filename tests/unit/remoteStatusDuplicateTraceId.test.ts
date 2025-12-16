import { useMusicStore } from '@/shared/stores/musicStore';
import { beforeEach, describe, expect, test } from 'bun:test';

describe('remoteStatus duplicate traceId rejection', () => {
    beforeEach(() => {
        (useMusicStore as any).setState({
            remoteStatus: null,
            lastAuthoritativePause: null,
            lastSequenceNumber: 0,
            lastServerTimestamp: 0,
        });
    });

    test('rejects exact duplicate with same sequence and traceId', () => {
        const now = Date.now();
        useMusicStore.getState().remoteStatusUpdated({
            type: 'playing',
            currentTime: 10,
            lastProgressUpdate: now,
            _meta: { sequenceNumber: 10, serverTimestamp: now, traceId: 'event-abc' },
        } as any);

        const later = now + 1000;
        useMusicStore.getState().remoteStatusUpdated({
            type: 'playing',
            currentTime: 12,
            lastProgressUpdate: later,
            _meta: { sequenceNumber: 10, serverTimestamp: now, traceId: 'event-abc' },
        } as any);

        const state = useMusicStore.getState();
        expect(state.lastSequenceNumber).toBe(10);
        expect(state.lastServerTimestamp).toBe(now);
        expect((state.remoteStatus as any)?.currentTime).toBe(10);
    });

    test('accepts same sequence with different traceId and newer timestamp', () => {
        const now = Date.now();
        useMusicStore.getState().remoteStatusUpdated({
            type: 'playing',
            currentTime: 10,
            lastProgressUpdate: now,
            _meta: { sequenceNumber: 10, serverTimestamp: now, traceId: 'event-abc' },
        } as any);

        const later = now + 1000;
        useMusicStore.getState().remoteStatusUpdated({
            type: 'playing',
            currentTime: 12,
            lastProgressUpdate: later,
            _meta: { sequenceNumber: 10, serverTimestamp: later, traceId: 'poll-xyz' },
        } as any);

        const state = useMusicStore.getState();
        expect(state.lastSequenceNumber).toBe(10);
        expect(state.lastServerTimestamp).toBe(later);
        expect((state.remoteStatus as any)?.currentTime).toBe(12);
    });
});
