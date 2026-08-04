import type { Music } from '@/shared/types/music';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoHybridStore, MongoStore } from '../src/server/persistence/mongo';
import { afterEach, beforeEach, describe, expect, it } from './bunTestCompat';

/**
 * persistence.mongo.test.ts covers loadAll/add/remove/clear on MongoStore and one add on the
 * hybrid. The queue-ordering paths - reorderAll, insert-at-index, and the hybrid's remove /
 * clear / reorder write-through - had no coverage, and those are exactly what a consolidation
 * of the file and mongo backends would rewrite.
 *
 * The hybrid answers reads from memory and writes to mongo in the background, so every
 * assertion about persistence goes through flush() and then re-reads the collection.
 */
const makeMusic = (id: string): Music => ({
    channelId: 'UCtest',
    channelName: 'Test Channel',
    duration: 'PT3M30S',
    id,
    title: `title-${id}`,
});

describe('mongo queue ordering', () => {
    let mongod: MongoMemoryServer;
    let mongo: MongoStore;
    let uri: string;

    /** Reads the raw docs with their `order` stamp, which loadAll does not expose. */
    const readOrderStamps = async (): Promise<{ _id: string; order?: number }[]> => {
        const client = new MongoClient(uri);
        try {
            await client.connect();
            return await client
                .db('testdb')
                .collection<{ _id: string; order?: number }>('musicRequests')
                .find({})
                .sort({ order: 1 })
                .toArray();
        } finally {
            await client.close();
        }
    };

    beforeEach(async () => {
        mongod = await MongoMemoryServer.create();
        uri = mongod.getUri();
        mongo = new MongoStore({ collectionName: 'musicRequests', dbName: 'testdb', uri });
        await mongo.initialize();
    });

    afterEach(async () => {
        await mongo.close();
        await mongod.stop();
    });

    describe('MongoStore.reorderAll', () => {
        it('stamps each document with its queue index', async () => {
            await mongo.add(makeMusic('a'));
            await mongo.add(makeMusic('b'));
            await mongo.add(makeMusic('c'));

            await mongo.reorderAll([makeMusic('c'), makeMusic('a'), makeMusic('b')]);

            expect((await readOrderStamps()).map(d => d._id)).toEqual(['c', 'a', 'b']);
        });

        it('is a no-op for an empty queue', async () => {
            // bulkWrite rejects an empty operation list, so the early return is load-bearing.
            await expect(mongo.reorderAll([])).resolves.toBeUndefined();
        });
    });

    describe('MongoHybridStore', () => {
        it('appends to memory immediately and persists in the background', async () => {
            const store = new MongoHybridStore(mongo, []);

            store.add(makeMusic('a'));
            store.add(makeMusic('b'));
            expect(store.load().map(m => m.id)).toEqual(['a', 'b']);

            await store.flush();

            expect((await mongo.loadAll()).map(m => m.id).toSorted()).toEqual(['a', 'b']);
        });

        it('inserts at an index and restamps the whole order', async () => {
            const store = new MongoHybridStore(mongo, []);
            store.add(makeMusic('a'));
            store.add(makeMusic('c'));
            await store.flush();

            store.add(makeMusic('b'), 1);
            expect(store.load().map(m => m.id)).toEqual(['a', 'b', 'c']);

            await store.flush();

            expect((await readOrderStamps()).map(d => d._id)).toEqual(['a', 'b', 'c']);
        });

        it('clamps an out-of-range insert index', async () => {
            const store = new MongoHybridStore(mongo, []);
            store.add(makeMusic('a'));

            store.add(makeMusic('b'), 99);
            store.add(makeMusic('c'), -5);

            expect(store.load().map(m => m.id)).toEqual(['c', 'a', 'b']);
            await store.flush();
        });

        it('replaces an existing id in place instead of duplicating', async () => {
            const store = new MongoHybridStore(mongo, []);
            store.add(makeMusic('a'));
            store.add(makeMusic('b'));

            store.add({ ...makeMusic('a'), title: 'renamed' });

            expect(store.load().map(m => m.id)).toEqual(['a', 'b']);
            expect(store.load()[0]?.title).toBe('renamed');

            await store.flush();
            expect(await mongo.loadAll()).toHaveLength(2);
        });

        it('reorder writes the new order through to mongo', async () => {
            const store = new MongoHybridStore(mongo, []);
            store.add(makeMusic('a'));
            store.add(makeMusic('b'));
            store.add(makeMusic('c'));
            await store.flush();

            store.reorder([makeMusic('c'), makeMusic('b'), makeMusic('a')]);
            expect(store.load().map(m => m.id)).toEqual(['c', 'b', 'a']);

            await store.flush();
            expect((await readOrderStamps()).map(d => d._id)).toEqual(['c', 'b', 'a']);
        });

        it('remove drops the item from memory and mongo', async () => {
            const store = new MongoHybridStore(mongo, []);
            store.add(makeMusic('a'));
            store.add(makeMusic('b'));
            await store.flush();

            store.remove('a');
            expect(store.load().map(m => m.id)).toEqual(['b']);

            await store.flush();
            expect((await mongo.loadAll()).map(m => m.id)).toEqual(['b']);
        });

        it('clear empties memory and mongo', async () => {
            const store = new MongoHybridStore(mongo, []);
            store.add(makeMusic('a'));
            store.add(makeMusic('b'));
            await store.flush();

            store.clear();
            expect(store.load()).toEqual([]);

            await store.flush();
            expect(await mongo.loadAll()).toEqual([]);
        });

        it('seeds memory from the initial snapshot', () => {
            const store = new MongoHybridStore(mongo, [makeMusic('a'), makeMusic('b')]);

            expect(store.load().map(m => m.id)).toEqual(['a', 'b']);
        });

        it('keeps the in-memory queue usable when every mongo write rejects', async () => {
            // The whole point of the hybrid: a backend outage must not lose the user's queue.
            // A stub that always rejects makes the failure deterministic - closing a real
            // MongoStore is not enough, since the driver may transparently reconnect.
            const fail = () => Promise.reject(new Error('mongo down'));
            const broken = {
                add: fail,
                clear: fail,
                close: fail,
                remove: fail,
                reorderAll: fail,
            } as unknown as MongoStore;
            const store = new MongoHybridStore(broken, []);

            store.add(makeMusic('a'));
            store.add(makeMusic('b'), 0);
            expect(store.load().map(m => m.id)).toEqual(['b', 'a']);

            store.reorder([makeMusic('a'), makeMusic('b')]);
            store.remove('a');
            expect(store.load().map(m => m.id)).toEqual(['b']);

            store.clear();

            // Every rejection is swallowed; flush must still settle rather than throw.
            await expect(store.flush()).resolves.toBeUndefined();
            expect(store.load()).toEqual([]);
        });

        it('closeSync flushes pending writes and closes the connection', async () => {
            // Runs on process exit, where an unhandled rejection would be the last thing
            // standing between a queued write and losing it.
            const closed: string[] = [];
            const stub = {
                add: () => Promise.resolve(),
                clear: () => Promise.resolve(),
                close: () => {
                    closed.push('close');
                    return Promise.resolve();
                },
                remove: () => Promise.resolve(),
                reorderAll: () => Promise.resolve(),
            } as unknown as MongoStore;
            const store = new MongoHybridStore(stub, []);
            store.add(makeMusic('a'));

            expect(() => store.closeSync()).not.toThrow();

            await store.flush();
            // closeSync chains close() after the flush promise, so yield once more.
            await Promise.resolve();
            expect(closed).toEqual(['close']);
        });

        it('closeSync swallows a failing close', async () => {
            const stub = {
                add: () => Promise.resolve(),
                clear: () => Promise.resolve(),
                close: () => Promise.reject(new Error('close failed')),
                remove: () => Promise.resolve(),
                reorderAll: () => Promise.resolve(),
            } as unknown as MongoStore;
            const store = new MongoHybridStore(stub, []);
            store.add(makeMusic('a'));

            expect(() => store.closeSync()).not.toThrow();
            await store.flush();
        });
    });
});
