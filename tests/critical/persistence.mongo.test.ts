import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoHybridStore, MongoStore } from '../../src/server/persistence/mongo';
import { afterEach, beforeEach, describe, expect, it } from '../bunTestCompat';

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
});
