import { beforeEach, describe, expect, test } from 'bun:test';
import { WindowCloseManager } from '../../src/server/services/windowCloseManager';
import { SocketManager } from '../../src/server/socket/managers/manager';
import { TimerManager } from '../../src/server/utils/timerManager';

describe('SocketManager getSnapshot extrapolation', () => {
    let manager: SocketManager;
    let timerManager: TimerManager;
    let windowCloseManager: WindowCloseManager;

    beforeEach(() => {
        timerManager = new TimerManager();
        windowCloseManager = new WindowCloseManager(500);
        manager = new SocketManager(() => true, timerManager, windowCloseManager, {
            debounceMs: 100,
            graceMs: 200,
            inactivityMs: 60_000,
        });
    });

    test('extrapolates playing currentTime forward based on elapsed time and playbackRate', () => {
        const now = Date.now();
        const eventTimestamp = now - 5000;
        (manager as any).remoteStatus = {
            type: 'playing',
            currentTime: 10,
            playbackRate: 2,
            duration: 200,
        };
        (manager as any).remoteStatusUpdatedAt = eventTimestamp;
        (manager as any).sequenceNumber = 7;
        (manager as any).lastTraceId = 't1';

        const snap = manager.getSnapshot();
        const s = snap as any;
        expect(Math.abs((s.currentTime ?? 0) - 20)).toBeLessThan(0.01);
        expect(s.lastProgressUpdate).toBeGreaterThanOrEqual(now - 50);
        expect(snap._meta.serverTimestamp).toBe(eventTimestamp);
        expect(snap._meta.sequenceNumber).toBe(7);
    });
});
