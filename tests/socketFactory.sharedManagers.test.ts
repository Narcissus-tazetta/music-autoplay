import { afterAll, describe, expect, it } from 'bun:test';
import { createServer } from 'node:http';
import type { Store } from '../src/server/persistence';
import { initSocketServer } from '../src/server/socket/core/factory';
import { TimerManager } from '../src/server/utils/timerManager';

/**
 * SocketServerInstance owns a TimerManager and a WindowCloseManager: getDiagnostics() reports
 * their stats and close() tears them down. initSocketServer used to construct its own pair and
 * hand those to SocketRuntime, so the instance-level stats were always zero and shutdown left
 * the live timers running. The factory must adopt the instances it is given.
 */
describe('initSocketServer shared managers', () => {
    const servers: ReturnType<typeof createServer>[] = [];
    const ios: { close: () => void }[] = [];

    afterAll(() => {
        for (const io of ios) io.close();
        for (const server of servers) server.close();
    });

    it('uses the caller-provided TimerManager', async () => {
        const server = createServer();
        servers.push(server);
        await new Promise<void>(resolve => server.listen(0, resolve));

        const timerManager = new TimerManager();
        const fileStore = { load: () => [] } as unknown as Store;

        const { io, runtime } = await initSocketServer(server, {
            fileStore,
            musicDB: new Map(),
            opts: { debounceMs: 0, graceMs: 0, inactivityMs: 0 },
            timerManager,
        });
        ios.push(io);

        const internals = runtime as unknown as { timerManager: TimerManager };
        expect(internals.timerManager).toBe(timerManager);
    }, 30_000);

    it('still builds its own TimerManager when none is supplied', async () => {
        const server = createServer();
        servers.push(server);
        await new Promise<void>(resolve => server.listen(0, resolve));

        const fileStore = { load: () => [] } as unknown as Store;
        const { io, runtime } = await initSocketServer(server, {
            fileStore,
            musicDB: new Map(),
            opts: { debounceMs: 0, graceMs: 0, inactivityMs: 0 },
        });
        ios.push(io);

        const internals = runtime as unknown as { timerManager: TimerManager };
        expect(internals.timerManager).toBeInstanceOf(TimerManager);
    }, 30_000);
});
