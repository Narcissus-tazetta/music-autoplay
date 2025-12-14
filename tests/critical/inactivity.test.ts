import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { WindowCloseManager } from '../../src/server/services/windowCloseManager';
import { SocketManager } from '../../src/server/socket/managers/manager';
import type { EmitFn, ManagerConfig } from '../../src/server/socket/managers/manager';
import { TimerManager } from '../../src/server/utils/timerManager';
import type { RemoteStatus } from '../../src/shared/stores/musicStore';

describe('SocketManager inactivity behavior', () => {
    let manager: SocketManager;
    let emitMock: ReturnType<typeof mock>;
    let emittedEvents: { event: string; payload: any }[];
    let timerManager: TimerManager;
    let windowCloseManager: WindowCloseManager;

    beforeEach(() => {
        emittedEvents = [];
        emitMock = mock((event: string, payload: unknown) => {
            emittedEvents.push({ event, payload });
            return true;
        });
        timerManager = new TimerManager();
        windowCloseManager = new WindowCloseManager(50);
    });

    test('should close playing status after configured inactivityMsPlaying', async () => {
        const config: ManagerConfig = {
            debounceMs: 50,
            graceMs: 50,
            inactivityMs: 0,
            inactivityMsPlaying: 50,
            inactivityMsPaused: 200,
        } as unknown as ManagerConfig;

        manager = new SocketManager(emitMock as unknown as EmitFn, timerManager, windowCloseManager, config);

        manager.update({
            currentTime: 0,
            musicId: 'song1',
            musicTitle: 'Song 1',
            type: 'playing',
        }, 'test');

        await new Promise(resolve => setTimeout(resolve, 75));

        const finalStatus = manager.getCurrent();
        expect(finalStatus.type).toBe('closed');
    });

    test('should close paused status after configured inactivityMsPaused', async () => {
        const config: ManagerConfig = {
            debounceMs: 50,
            graceMs: 50,
            inactivityMs: 0,
            inactivityMsPlaying: 100,
            inactivityMsPaused: 50,
        } as unknown as ManagerConfig;

        manager = new SocketManager(emitMock as unknown as EmitFn, timerManager, windowCloseManager, config);

        manager.update({
            musicId: 'song2',
            musicTitle: 'Song 2',
            type: 'paused',
        }, 'test');

        await new Promise(resolve => setTimeout(resolve, 75));

        const finalStatus = manager.getCurrent();
        expect(finalStatus.type).toBe('closed');
    });

    test('heartbeat should reset inactivity timer for playing', async () => {
        const config: ManagerConfig = {
            debounceMs: 50,
            graceMs: 50,
            inactivityMs: 0,
            inactivityMsPlaying: 120,
            inactivityMsPaused: 120,
        } as unknown as ManagerConfig;

        manager = new SocketManager(emitMock as unknown as EmitFn, timerManager, windowCloseManager, config);

        const status: RemoteStatus = {
            currentTime: 0,
            musicId: 'song1',
            musicTitle: 'Song 1',
            type: 'playing',
        };

        manager.update(status, 'test');

        await new Promise(resolve => setTimeout(resolve, 50));

        manager.update(status, 'extension_heartbeat');

        await new Promise(resolve => setTimeout(resolve, 100));

        const finalStatus = manager.getCurrent();
        expect(finalStatus.type).toBe('playing');
    });
});
