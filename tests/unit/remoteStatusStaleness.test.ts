import { useMusicStore } from '@/shared/stores/musicStore';
import { beforeEach, describe, expect, test } from 'bun:test';

describe('remoteStatus staleness tie-break', () => {
    beforeEach(() => {
        (useMusicStore as any).setState({
            remoteStatus: null,
            lastAuthoritativePause: null,
            lastSequenceNumber: 0,
            lastServerTimestamp: 0,
        });
    });

    test('accepts same sequence updates with newer serverTimestamp', () => {
        const now = Date.now();
        useMusicStore.getState().remoteStatusUpdated({
            type: 'playing',
            currentTime: 10,
            lastProgressUpdate: now,
            _meta: { sequenceNumber: 5, serverTimestamp: now, traceId: 'initial' },
        } as any);

        const later = now + 1500;
        useMusicStore.getState().remoteStatusUpdated({
            type: 'playing',
            currentTime: 12,
            lastProgressUpdate: later,
            _meta: { sequenceNumber: 5, serverTimestamp: later, traceId: 'poll' },
        } as any);

        const state = useMusicStore.getState();
        expect(state.lastSequenceNumber).toBe(5);
        expect(state.lastServerTimestamp).toBe(later);
        expect((state.remoteStatus as any)?.currentTime).toBe(12);
        expect((state.remoteStatus as any)?.lastProgressUpdate).toBe(later);
    });

    test('ignores same sequence updates without newer serverTimestamp', () => {
        const now = Date.now();
        useMusicStore.getState().remoteStatusUpdated({
            type: 'playing',
            currentTime: 15,
            lastProgressUpdate: now,
            _meta: { sequenceNumber: 7, serverTimestamp: now, traceId: 'initial' },
        } as any);

        const older = now - 1000;
        useMusicStore.getState().remoteStatusUpdated({
            type: 'playing',
            currentTime: 20,
            lastProgressUpdate: older,
            _meta: { sequenceNumber: 7, serverTimestamp: older, traceId: 'stale' },
        } as any);

        const state = useMusicStore.getState();
        expect(state.lastSequenceNumber).toBe(7);
        expect(state.lastServerTimestamp).toBe(now);
        expect((state.remoteStatus as any)?.currentTime).toBe(15);
    });
});
