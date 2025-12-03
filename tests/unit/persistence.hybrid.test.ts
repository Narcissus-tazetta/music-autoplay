import PgHybridStore from '../../src/server/persistence/hybrid';
import { describe, expect, it, vi } from '../bunTestCompat';

describe('PgHybridStore basic behavior', () => {
    it('adds and forwards to pg', async () => {
        const addSpy = vi.fn(() => Promise.resolve());
        const pgMock = {
            add: addSpy,
            remove: vi.fn(() => Promise.resolve()),
            clear: vi.fn(() => Promise.resolve()),
        } as any;
        const store = new PgHybridStore(pgMock, []);
        store.add({ id: 'p1', title: 'P' } as any);
        expect(store.load().length).toBe(1);
        await store.flush();
        expect(addSpy).toHaveBeenCalled();
    });

    it('remove forwards to pg and updates local', async () => {
        const removeSpy = vi.fn(() => Promise.resolve());
        const pgMock = {
            add: vi.fn(() => Promise.resolve()),
            remove: removeSpy,
            clear: vi.fn(() => Promise.resolve()),
        } as any;
        const store = new PgHybridStore(pgMock, [{ id: 'r1', title: 'R' } as any]);
        expect(store.load().length).toBe(1);
        store.remove('r1');
        expect(store.load().length).toBe(0);
        await store.flush();
        expect(removeSpy).toHaveBeenCalledWith('r1');
    });

    it('clear forwards to pg and empties local', async () => {
        const clearSpy = vi.fn(() => Promise.resolve());
        const pgMock = {
            add: vi.fn(() => Promise.resolve()),
            remove: vi.fn(() => Promise.resolve()),
            clear: clearSpy,
        } as any;
        const store = new PgHybridStore(pgMock, [{ id: 'c1', title: 'C' } as any]);
        store.clear();
        expect(store.load().length).toBe(0);
        await store.flush();
        expect(clearSpy).toHaveBeenCalled();
    });
});
