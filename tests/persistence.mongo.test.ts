import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoHybridStore, MongoStore } from '../src/server/persistence/mongo';
import { afterEach, beforeEach, describe, expect, it } from './bunTestCompat';

describe('MongoStore persistence basic operations', () => {
    let mongod: MongoMemoryServer | null = null;
    let uri: string;

    beforeEach(async () => {
        mongod = await MongoMemoryServer.create();
        uri = mongod.getUri();
    });

    afterEach(async () => {
        if (mongod) {
            await mongod.stop();
            mongod = null;
        }
    });

    it('loadAll returns empty then persists add/remove/clear', async () => {
        const mongo = new MongoStore({
            uri,
            dbName: 'testdb',
            collectionName: 'musicRequests',
        });
        await mongo.initialize();

        const initial = await mongo.loadAll();
        expect(Array.isArray(initial)).toBe(true);
        expect(initial.length).toBe(0);

        const m = {
            id: 'm1',
            title: 'T',
            channelId: '',
            channelName: '',
            duration: '',
        } as any;

        await mongo.add(m);
        const afterAdd = await mongo.loadAll();
        expect(afterAdd.length).toBe(1);
        expect(afterAdd[0].id).toBe('m1');

        await mongo.remove('m1');
        const afterRemove = await mongo.loadAll();
        expect(afterRemove.length).toBe(0);

        await mongo.add(m);
        await mongo.clear();
        const afterClear = await mongo.loadAll();
        expect(afterClear.length).toBe(0);

        await mongo.close();
    });

    it('MongoHybridStore load() is synchronous and reflects updates', async () => {
        const mongo = new MongoStore({
            uri,
            dbName: 'testdb',
            collectionName: 'musicRequests',
        });
        await mongo.initialize();
        const initial = await mongo.loadAll();

        const store = new MongoHybridStore(mongo, initial);
        expect(store.load().length).toBe(0);

        store.add({ id: 'x1', title: 'X' } as any);
        expect(store.load().length).toBe(1);

        await store.flush?.();
        await mongo.close();
    });

    // Production hands the same MongoClient to the music, history and request-log stores
    // (see persistence/provider.ts) and closes it once at the end. A store must therefore
    // never close a client it did not create, or the siblings sharing it break.
    it('close() leaves a caller-supplied client open for the stores sharing it', async () => {
        const { MongoClient } = await import('mongodb');
        const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5_000 });

        const a = new MongoStore({ client, collectionName: 'shared_a', dbName: 'testdb', uri });
        const b = new MongoStore({ client, collectionName: 'shared_b', dbName: 'testdb', uri });
        await a.initialize();
        await b.initialize();

        await a.add({ id: 'a1', title: 'A' } as any);
        await a.close();

        // b still shares the client, so it must remain usable after a.close().
        await b.add({ id: 'b1', title: 'B' } as any);
        expect((await b.loadAll()).map(m => m.id)).toEqual(['b1']);
        expect((await a.loadAll()).map(m => m.id)).toEqual(['a1']);

        await b.close();
        await client.close();
    });

    it('close() does close a client the store created itself', async () => {
        const owned = new MongoStore({ collectionName: 'owned', dbName: 'testdb', uri });
        await owned.initialize();
        await owned.close();

        // The pool is gone, so further use must fail rather than silently reconnect.
        await expect(owned.loadAll()).rejects.toThrow();
    });
});
