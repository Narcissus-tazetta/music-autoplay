import { MongoMemoryServer } from 'mongodb-memory-server';
import { SettingsMongoHybridStore, SettingsMongoStore } from '../src/server/settingsMongoStore';
import { afterEach, beforeEach, describe, expect, it } from './bunTestCompat';

const settingsOf = (ytStatusVisible: boolean) => ({
    ytAdminControlsEnabled: false,
    ytStatusMode: 'player',
    ytStatusVisible,
});

describe('settings mongo hybrid store', () => {
    let mongod: MongoMemoryServer;
    let uri: string;
    let mongo: SettingsMongoStore;

    beforeEach(async () => {
        mongod = await MongoMemoryServer.create();
        uri = mongod.getUri();
        mongo = new SettingsMongoStore({ collectionName: 'settings', dbName: 'testdb', uri });
    });

    afterEach(async () => {
        await mongo.close();
        await mongod.stop();
    });

    it('a saved value is readable immediately and survives a restart after flush', async () => {
        const store = new SettingsMongoHybridStore(mongo, await mongo.loadAll());
        store.save('user-1', settingsOf(false));
        expect(store.load('user-1')?.value).toEqual(settingsOf(false));

        await store.flush();

        const restarted = new SettingsMongoHybridStore(mongo, await mongo.loadAll());
        expect(restarted.load('user-1')?.value).toEqual(settingsOf(false));
        expect(restarted.load('someone-else')).toBeUndefined();
    });

    it('a later save overwrites the earlier one for the same user', async () => {
        const store = new SettingsMongoHybridStore(mongo, await mongo.loadAll());
        store.save('user-1', settingsOf(true));
        store.save('user-1', settingsOf(false));
        await store.flush();

        const restarted = new SettingsMongoHybridStore(mongo, await mongo.loadAll());
        expect(restarted.load('user-1')?.value).toEqual(settingsOf(false));
    });
});
