import type { Music } from '@/shared/types/music';
import { persistAdd, persistRemove } from '../src/server/persistence/storeHelpers';
import type { Store } from '../src/server/persistence/types';
import { describe, expect, it } from './bunTestCompat';

/**
 * These helpers exist so a failing disk/mongo write never takes down an in-memory queue
 * mutation that already succeeded. Only the happy path was covered, which meant the
 * swallow-and-log branches - the entire reason the helpers exist - were never executed.
 */
const music: Music = {
    channelId: 'UCtest',
    channelName: 'Test Channel',
    duration: 'PT3M30S',
    id: 'dQw4w9WgXcQ',
    title: 'Test Song',
};

const storeWith = (overrides: Partial<Store>): Store => ({
    add: () => {},
    clear: () => {},
    load: () => [],
    remove: () => {},
    ...overrides,
});

describe('persistAdd', () => {
    it('forwards the music and index to the store', async () => {
        const calls: [Music, number | undefined][] = [];
        await persistAdd(storeWith({ add: (m, i) => void calls.push([m, i]) }), music, 2);

        expect(calls).toEqual([[music, 2]]);
    });

    it('awaits an async add', async () => {
        let settled = false;
        await persistAdd(
            storeWith({
                add: async () => {
                    await Promise.resolve();
                    settled = true;
                },
            }),
            music,
        );

        expect(settled).toBe(true);
    });

    it('swallows a synchronous store failure', async () => {
        const store = storeWith({
            add: () => {
                throw new Error('disk full');
            },
        });

        await expect(persistAdd(store, music)).resolves.toBeUndefined();
    });

    it('swallows a rejected async add', async () => {
        const store = storeWith({ add: () => Promise.reject(new Error('mongo down')) });

        await expect(persistAdd(store, music)).resolves.toBeUndefined();
    });

    it('is a no-op when the store is missing or has no add', async () => {
        await expect(persistAdd(undefined, music)).resolves.toBeUndefined();
        await expect(
            persistAdd({ add: undefined } as unknown as Store, music),
        ).resolves.toBeUndefined();
    });
});

describe('persistRemove', () => {
    it('forwards the id to the store', async () => {
        const removed: string[] = [];
        await persistRemove(storeWith({ remove: id => void removed.push(id) }), 'abc');

        expect(removed).toEqual(['abc']);
    });

    it('awaits an async remove', async () => {
        let settled = false;
        await persistRemove(
            storeWith({
                remove: async () => {
                    await Promise.resolve();
                    settled = true;
                },
            }),
            'abc',
        );

        expect(settled).toBe(true);
    });

    it('swallows a synchronous store failure', async () => {
        const store = storeWith({
            remove: () => {
                throw new Error('disk full');
            },
        });

        await expect(persistRemove(store, 'abc')).resolves.toBeUndefined();
    });

    it('swallows a rejected async remove', async () => {
        const store = storeWith({ remove: () => Promise.reject(new Error('mongo down')) });

        await expect(persistRemove(store, 'abc')).resolves.toBeUndefined();
    });

    it('is a no-op when the store is missing or has no remove', async () => {
        await expect(persistRemove(undefined, 'abc')).resolves.toBeUndefined();
        await expect(
            persistRemove({ remove: undefined } as unknown as Store, 'abc'),
        ).resolves.toBeUndefined();
    });
});
