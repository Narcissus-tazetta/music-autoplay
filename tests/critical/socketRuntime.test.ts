import type { Server as IOServer } from 'socket.io';
import { MusicService } from '../../src/server/music/musicService';
import type { Store } from '../../src/server/persistence';
import { type WindowCloseManager } from '../../src/server/services/windowCloseManager';
import type { YouTubeService } from '../../src/server/services/youtubeService';
import { SocketManager } from '../../src/server/socket/managers/manager';
import { SocketRuntime } from '../../src/server/socket/managers/runtime';
import type { TimerManager } from '../../src/server/utils/timerManager';
import type { Music } from '../../src/shared/stores/musicStore';
import { describe, expect, it, vi } from '../bunTestCompat';

describe('SocketRuntime', () => {
    it('creates and returns a manager instance and retains it', () => {
        const emitSpy = vi.fn();
        const ioGetter = () => ({ emit: emitSpy }) as unknown;
        const musicDB = new Map<string, Music>();
        const youtubeService = {} as unknown as YouTubeService;
        const fileStore = {
            add: () => {},
            clear: () => {},
            load: () => [],
            remove: () => {},
        } as unknown as Store;
        const timerManager = {
            clear: () => {},
            start: () => {},
        } as unknown as TimerManager;
        const windowCloseManager = {
            clearForOrigin: () => {},
            processEvent: () => ({ processed: false }),
        } as unknown as InstanceType<typeof WindowCloseManager>;

        const runtime = new SocketRuntime(
            ioGetter as unknown as () => IOServer,
            musicDB,
            youtubeService,
            fileStore,
            timerManager,
            windowCloseManager,
            { debounceMs: 250, graceMs: 5000, inactivityMs: 10_000 },
        );

        expect(runtime.getManager()).toBeUndefined();
        const mgr = runtime.createManager();
        expect(mgr).toBeInstanceOf(SocketManager);
        expect(runtime.getManager()).toBe(mgr);
    });

    it('creates and returns a MusicService instance and caches it', () => {
        const emitSpy = vi.fn();
        const ioGetter = () => ({ emit: emitSpy }) as unknown;
        const musicDB = new Map<string, Music>();
        const youtubeService = {} as unknown as YouTubeService;
        const fileStore = {
            add: () => {},
            clear: () => {},
            load: () => [],
            remove: () => {},
        } as unknown as Store;
        const timerManager = {
            clear: () => {},
            start: () => {},
        } as unknown as TimerManager;
        const windowCloseManager = {
            clearForOrigin: () => {},
            processEvent: () => ({ processed: false }),
        } as unknown as InstanceType<typeof WindowCloseManager>;

        const runtime = new SocketRuntime(
            ioGetter as unknown as () => IOServer,
            musicDB,
            youtubeService,
            fileStore,
            timerManager,
            windowCloseManager,
            { debounceMs: 250, graceMs: 5000, inactivityMs: 10_000 },
        );

        const svcA = runtime.getMusicService();
        const svcB = runtime.getMusicService();
        expect(svcA).toBeInstanceOf(MusicService);
        expect(svcA).toBe(svcB);
    });

    it('emit delegates to underlying io.emit', () => {
        const emitSpy = vi.fn();
        const ioGetter = () => ({ emit: emitSpy }) as unknown;
        const musicDB = new Map<string, Music>();
        const youtubeService = {} as unknown as YouTubeService;
        const fileStore = {
            add: () => {},
            clear: () => {},
            load: () => [],
            remove: () => {},
        } as unknown as Store;
        const timerManager = {
            clear: () => {},
            start: () => {},
        } as unknown as TimerManager;
        const windowCloseManager = {
            clearForOrigin: () => {},
            processEvent: () => ({ processed: false }),
        } as unknown as InstanceType<typeof WindowCloseManager>;

        const runtime = new SocketRuntime(
            ioGetter as any,
            musicDB,
            youtubeService,
            fileStore,
            timerManager,
            windowCloseManager,
            { debounceMs: 250, graceMs: 5000, inactivityMs: 10_000 },
        );

        runtime.emit('testEvent', { foo: 'bar' });
        expect(emitSpy).toHaveBeenCalledWith('testEvent', { foo: 'bar' });
    });

    it('manager emits remoteStatusUpdated when update called', () => {
        const emitSpy = vi.fn();
        const ioGetter = () => ({ emit: emitSpy }) as unknown;
        const musicDB = new Map();
        const youtubeService = {} as any;
        const fileStore = { add: () => {}, remove: () => {} } as any;
        const timerManager = { clear: () => {}, start: () => {} } as any;
        const windowCloseManager = {} as any;

        const runtime = new SocketRuntime(
            ioGetter as any,
            musicDB,
            youtubeService,
            fileStore,
            timerManager,
            windowCloseManager,
            { debounceMs: 250, graceMs: 5000, inactivityMs: 10_000 },
        );
        const mgr = runtime.createManager();
        (mgr as any).update({ type: 'open' }, 'test');
        expect(emitSpy).toHaveBeenCalled();
    });
});
