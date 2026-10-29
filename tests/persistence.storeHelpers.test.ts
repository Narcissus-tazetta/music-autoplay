import { MusicRepository } from '@/server/music/musicRepository';
import type { Music } from '@/shared/types/music';
import { persistAdd, persistRemove } from '../src/server/persistence/storeHelpers';
import type { Store } from '../src/server/persistence/types';
import { describe, expect, it } from './bunTestCompat';

/**
 * A failing disk/mongo write must reach the caller. These helpers used to catch and log,
 * then return normally, so MusicRepository always reported success and the `!ok` branches
 * above it could never run.
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

    it('propagates a synchronous store failure', async () => {
        const store = storeWith({
            add: () => {
                throw new Error('disk full');
            },
        });

        await expect(persistAdd(store, music)).rejects.toThrow('disk full');
    });

    it('propagates a rejected async add', async () => {
        const store = storeWith({ add: () => Promise.reject(new Error('mongo down')) });

        await expect(persistAdd(store, music)).rejects.toThrow('mongo down');
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

    it('propagates a rejected async remove', async () => {
        const store = storeWith({ remove: () => Promise.reject(new Error('mongo down')) });

        await expect(persistRemove(store, 'abc')).rejects.toThrow('mongo down');
    });
});

describe('MusicRepository persistence results', () => {
    const repositoryWith = (store: Store) => new MusicRepository(new Map(), store);

    it('reports a failed add as an error result', async () => {
        const repository = repositoryWith(storeWith({ add: () => Promise.reject(new Error('disk full')) }));

        const result = await repository.persistAdd(music);

        expect(result.ok).toBe(false);
    });

    it('reports a failed remove as an error result', async () => {
        const repository = repositoryWith(storeWith({ remove: () => Promise.reject(new Error('disk full')) }));

        const result = await repository.persistRemove('abc');

        expect(result.ok).toBe(false);
    });

    it('reports a failed reorder as an error result', async () => {
        const repository = repositoryWith(
            storeWith({ reorder: () => Promise.reject(new Error('disk full')) }),
        );

        const result = await repository.persistReorder();

        expect(result.ok).toBe(false);
    });

    it('reports success when the store accepts the write', async () => {
        const repository = repositoryWith(storeWith({}));

        expect((await repository.persistAdd(music)).ok).toBe(true);
        expect((await repository.persistRemove('abc')).ok).toBe(true);
    });
});
