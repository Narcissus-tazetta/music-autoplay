import type { HistoryItem } from '@/shared/types/history';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { HistoryMongoStore } from '../src/server/history/historyMongoStore';
import { afterEach, beforeEach, describe, expect, it } from './bunTestCompat';

/**
 * historyMongoHybridStore.test.ts drives the hybrid through a MockHistoryMongoStore, so the
 * real mongo I/O - the id mapping in loadAll, the upsert merge, the TTL stamp - had no
 * coverage at all. These run against a real mongod so a consolidation cannot quietly change
 * the document shape or the ordering the UI depends on.
 */
const makeItem = (id: string, overrides?: Partial<HistoryItem>): HistoryItem => ({
    channelId: 'channel-1',
    channelName: 'channel',
    duration: 'PT3M',
    firstPlayedAt: '2026-03-01T10:00:00.000Z',
    id,
    lastPlayedAt: '2026-03-01T10:00:00.000Z',
    playCount: 1,
    title: `title-${id}`,
    ...overrides,
});

describe('HistoryMongoStore', () => {
    let mongod: MongoMemoryServer;
    let store: HistoryMongoStore;

    /** Reads the stored document directly, bypassing loadAll's id/_id remapping. */
    const readRawDoc = async (id: string): Promise<{ expireAt?: Date } | null> => {
        const client = new MongoClient(mongod.getUri());
        try {
            await client.connect();
            return await client
                .db('historyTestDb')
                .collection<{ _id: string; expireAt?: Date }>('history')
                .findOne({ _id: id });
        } finally {
            await client.close();
        }
    };

    beforeEach(async () => {
        mongod = await MongoMemoryServer.create();
        store = new HistoryMongoStore({
            collectionName: 'history',
            dbName: 'historyTestDb',
            uri: mongod.getUri(),
        });
        await store.initialize();
    });

    afterEach(async () => {
        await store.close();
        await mongod.stop();
    });

    it('starts empty', async () => {
        expect(await store.loadAll()).toEqual([]);
    });

    it('upserts an item and reads it back with its id intact', async () => {
        const item = makeItem('aaa');
        await store.upsert(item);

        const loaded = await store.loadAll();

        expect(loaded).toHaveLength(1);
        expect(loaded[0]).toMatchObject(item);
        // loadAll strips _id and republishes it as `id`; the UI keys off `id`.
        expect(loaded[0]).not.toHaveProperty('_id');
        expect(loaded[0]?.id).toBe('aaa');
    });

    it('upsert on an existing id merges rather than duplicating', async () => {
        await store.upsert(makeItem('aaa', { playCount: 1 }));
        await store.upsert(makeItem('aaa', { playCount: 5, title: 'renamed' }));

        const loaded = await store.loadAll();

        expect(loaded).toHaveLength(1);
        expect(loaded[0]?.playCount).toBe(5);
        expect(loaded[0]?.title).toBe('renamed');
    });

    it('sorts by lastPlayedAt descending', async () => {
        await store.upsert(makeItem('old', { lastPlayedAt: '2026-03-01T10:00:00.000Z' }));
        await store.upsert(makeItem('new', { lastPlayedAt: '2026-03-03T10:00:00.000Z' }));
        await store.upsert(makeItem('mid', { lastPlayedAt: '2026-03-02T10:00:00.000Z' }));

        expect((await store.loadAll()).map(i => i.id)).toEqual(['new', 'mid', 'old']);
    });

    it('removes an item by id and leaves the rest', async () => {
        await store.upsert(makeItem('aaa'));
        await store.upsert(makeItem('bbb'));

        await store.remove('aaa');

        expect((await store.loadAll()).map(i => i.id)).toEqual(['bbb']);
    });

    it('removing an unknown id is a no-op', async () => {
        await store.upsert(makeItem('aaa'));

        await store.remove('does-not-exist');

        expect(await store.loadAll()).toHaveLength(1);
    });

    it('stamps expireAt three years past lastPlayedAt for the TTL index', async () => {
        const lastPlayedAt = '2026-03-01T10:00:00.000Z';
        await store.upsert(makeItem('aaa', { lastPlayedAt }));

        const raw = await readRawDoc('aaa');

        const expected = Date.parse(lastPlayedAt) + 3 * 365 * 24 * 60 * 60 * 1000;
        expect(raw?.expireAt?.getTime()).toBe(expected);
    });

    it('falls back to now when lastPlayedAt is unparseable', async () => {
        const before = Date.now();
        await store.upsert(makeItem('aaa', { lastPlayedAt: 'not-a-date' }));

        const raw = await readRawDoc('aaa');

        const ttlMs = 3 * 365 * 24 * 60 * 60 * 1000;
        expect(raw?.expireAt?.getTime()).toBeGreaterThanOrEqual(before + ttlMs);
        expect(raw?.expireAt?.getTime()).toBeLessThanOrEqual(Date.now() + ttlMs);
    });
});
