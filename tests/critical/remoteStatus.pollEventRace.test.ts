import { useMusicStore } from '@/shared/stores/musicStore';
import { beforeEach, describe, expect, test } from 'bun:test';

describe('remoteStatus poll and event ordering', () => {
    beforeEach(() => {
        (useMusicStore as any).setState({
            remoteStatus: null,
            lastAuthoritativePause: null,
            lastSequenceNumber: 0,
            lastServerTimestamp: 0,
        });
    });

    test('poll snapshot advances state after event', () => {
        const now = Date.now();
        useMusicStore.getState().remoteStatusUpdated({
            type: 'playing',
            currentTime: 10,
            lastProgressUpdate: now,
            _meta: { sequenceNumber: 15, serverTimestamp: now, traceId: 'event' },
        } as any);

        const pollTimestamp = now + 1200;
        useMusicStore.getState().remoteStatusUpdated({
            type: 'playing',
            currentTime: 12,
            lastProgressUpdate: pollTimestamp,
            _meta: { sequenceNumber: 15, serverTimestamp: pollTimestamp, traceId: 'poll' },
        } as any);

        const state = useMusicStore.getState();
        expect((state.remoteStatus as any)?.currentTime).toBe(12);
        expect(state.lastServerTimestamp).toBe(pollTimestamp);
    });

    test('later event does not regress snapshot when timestamp is older', () => {
        const now = Date.now();
        const pollTimestamp = now + 1000;
        useMusicStore.getState().remoteStatusUpdated({
            type: 'playing',
            currentTime: 25,
            lastProgressUpdate: pollTimestamp,
            _meta: { sequenceNumber: 20, serverTimestamp: pollTimestamp, traceId: 'poll' },
        } as any);

        const olderEventTimestamp = now + 500;
        useMusicStore.getState().remoteStatusUpdated({
            type: 'playing',
            currentTime: 23,
            lastProgressUpdate: olderEventTimestamp,
            _meta: { sequenceNumber: 20, serverTimestamp: olderEventTimestamp, traceId: 'event' },
        } as any);

        const state = useMusicStore.getState();
        expect((state.remoteStatus as any)?.currentTime).toBe(25);
        expect(state.lastServerTimestamp).toBe(pollTimestamp);
    });
});
