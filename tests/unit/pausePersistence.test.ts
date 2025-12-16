import { useMusicStore } from '@/shared/stores/musicStore';
import { beforeEach, describe, expect, test } from 'bun:test';

describe('pause persistence and suppression', () => {
    beforeEach(() => {
        // reset store
        (useMusicStore as any).setState({
            remoteStatus: null,
            lastAuthoritativePause: null,
            lastSequenceNumber: 0,
            lastServerTimestamp: 0,
        });
    });

    test('authoritative pause stored and transient play suppressed', () => {
        const now = Date.now();

        useMusicStore.getState().remoteStatusUpdated({
            type: 'paused',
            currentTime: 22,
            _meta: { sequenceNumber: 100, serverTimestamp: now, traceId: 't1' },
        } as any);

        const s1 = useMusicStore.getState();
        expect(s1.remoteStatus?.type).toBe('paused');
        expect(s1.lastAuthoritativePause).toBeTruthy();
        expect(s1.lastAuthoritativePause?.time).toBe(22);

        // transient playing update close to paused time should be suppressed
        useMusicStore.getState().remoteStatusUpdated({
            type: 'playing',
            currentTime: 22.1,
            _meta: { sequenceNumber: 101, serverTimestamp: now + 1000, traceId: 't2' },
        } as any);

        const s2 = useMusicStore.getState();
        expect(s2.remoteStatus?.type).toBe('paused');
        expect(s2.lastAuthoritativePause).toBeTruthy();

        // a clear seek ahead should clear the pause
        useMusicStore.getState().remoteStatusUpdated({
            type: 'playing',
            currentTime: 40,
            _meta: { sequenceNumber: 102, serverTimestamp: now + 2000, traceId: 't3' },
        } as any);

        const s3 = useMusicStore.getState();
        expect(s3.remoteStatus?.type).toBe('playing');
        expect(s3.lastAuthoritativePause).toBeNull();
    });

    test('paused update without currentTime falls back to previous time', () => {
        const now = Date.now();

        // set initial playing status with a known currentTime
        useMusicStore.getState().remoteStatusUpdated({
            type: 'playing',
            currentTime: 34,
            _meta: { sequenceNumber: 1, serverTimestamp: now, traceId: 'a' },
        } as any);

        const s1 = useMusicStore.getState();
        expect(s1.remoteStatus?.type).toBe('playing');
        expect((s1.remoteStatus as any).currentTime).toBe(34);

        // receive paused without currentTime
        useMusicStore.getState().remoteStatusUpdated({
            type: 'paused',
            _meta: { sequenceNumber: 2, serverTimestamp: now + 1000, traceId: 'b' },
        } as any);

        const s2 = useMusicStore.getState();
        expect(s2.remoteStatus?.type).toBe('paused');
        // should have preserved previous currentTime
        expect((s2.remoteStatus as any).currentTime).toBe(34);
    });
});
