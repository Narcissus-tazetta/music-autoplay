import type { RequestLogEntry } from '@/shared/types/requestLog';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { RequestLogMongoStore } from '../src/server/requestLog/requestLogMongoStore';
import { afterEach, beforeEach, describe, expect, it } from './bunTestCompat';

/**
 * requestLogMongoHybridStore.test.ts exercises the hybrid against a fake, leaving the real
 * append/query path - the requester-hash filtering the admin UI relies on, and the TTL stamp
 * that expires old logs - untested. These run against a real mongod.
 */
const REQUEST_LOG_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const makeEntry = (id: string, overrides?: Partial<RequestLogEntry>): RequestLogEntry => ({
    id,
    musicId: `music-${id}`,
    requestedAt: new Date().toISOString(),
    requesterHash: 'abcdef0123456789',
    requesterName: 'tester',
    title: `title-${id}`,
    url: `https://youtu.be/${id}`,
    ...overrides,
});

describe('RequestLogMongoStore', () => {
    let mongod: MongoMemoryServer;
    let store: RequestLogMongoStore;
    let uri: string;

    const readRawDoc = async (id: string): Promise<{ expireAt?: Date } | null> => {
        const client = new MongoClient(uri);
        try {
            await client.connect();
            return await client
                .db('requestLogTestDb')
                .collection<{ _id: string; expireAt?: Date }>('requestLogs')
                .findOne({ _id: id });
        } finally {
            await client.close();
        }
    };

    beforeEach(async () => {
        mongod = await MongoMemoryServer.create();
        uri = mongod.getUri();
        store = new RequestLogMongoStore({
            collectionName: 'requestLogs',
            dbName: 'requestLogTestDb',
            uri,
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

    it('appends an entry and reads it back with its id intact', async () => {
        const entry = makeEntry('e1');
        await store.append(entry);

        const loaded = await store.loadAll();

        expect(loaded).toHaveLength(1);
        expect(loaded[0]).toEqual(entry);
        // toEntry drops the mongo bookkeeping fields before handing rows to callers.
        expect(loaded[0]).not.toHaveProperty('_id');
        expect(loaded[0]).not.toHaveProperty('expireAt');
        expect(loaded[0]).not.toHaveProperty('createdAt');
    });

    it('appending the same id twice updates rather than duplicates', async () => {
        await store.append(makeEntry('e1', { title: 'first' }));
        await store.append(makeEntry('e1', { title: 'second' }));

        const loaded = await store.loadAll();

        expect(loaded).toHaveLength(1);
        expect(loaded[0]?.title).toBe('second');
    });

    describe('query', () => {
        beforeEach(async () => {
            await store.append(makeEntry('e1', { requesterHash: 'aaaa1111' }));
            await store.append(makeEntry('e2', { requesterHash: 'aaaa2222' }));
            await store.append(makeEntry('e3', { requesterHash: 'bbbb3333' }));
        });

        it('returns every recent entry when no filter is given', async () => {
            expect(await store.query()).toHaveLength(3);
        });

        it('filters by exact requesterHash', async () => {
            const rows = await store.query({ requesterHash: 'aaaa1111' });

            expect(rows.map(r => r.id)).toEqual(['e1']);
        });

        it('filters by hash prefix', async () => {
            const rows = await store.query({ hashPrefix: 'aaaa' });

            expect(rows.map(r => r.id).toSorted()).toEqual(['e1', 'e2']);
        });

        it('matches requesterHash case-insensitively', async () => {
            const rows = await store.query({ requesterHash: 'AAAA1111' });

            expect(rows.map(r => r.id)).toEqual(['e1']);
        });

        it('honours the limit', async () => {
            expect(await store.query({ limit: 2 })).toHaveLength(2);
        });

        it('sorts newest first', async () => {
            await store.append(
                makeEntry('newest', { requestedAt: new Date(Date.now() + 1000).toISOString() }),
            );

            expect((await store.query())[0]?.id).toBe('newest');
        });

        it('hides entries older than the retention window from both readers', async () => {
            const old = new Date(Date.now() - REQUEST_LOG_TTL_MS - 60_000).toISOString();
            await store.append(makeEntry('ancient', { requestedAt: old }));

            // loadAll and query share buildRecentFilter, so both apply the cutoff...
            expect((await store.query()).map(r => r.id)).not.toContain('ancient');
            expect((await store.loadAll()).map(r => r.id)).not.toContain('ancient');
            // ...while the document itself is still in the collection until the TTL index or
            // pruneExpired removes it. Filtering and deletion are separate concerns here.
            expect(await readRawDoc('ancient')).not.toBeNull();
        });
    });

    it('stamps expireAt 30 days past requestedAt for the TTL index', async () => {
        const requestedAt = '2026-03-01T10:00:00.000Z';
        await store.append(makeEntry('e1', { requestedAt }));

        const raw = await readRawDoc('e1');

        expect(raw?.expireAt?.getTime()).toBe(Date.parse(requestedAt) + REQUEST_LOG_TTL_MS);
    });

    it('falls back to now when requestedAt is unparseable', async () => {
        const before = Date.now();
        await store.append(makeEntry('e1', { requestedAt: 'not-a-date' }));

        const raw = await readRawDoc('e1');

        expect(raw?.expireAt?.getTime()).toBeGreaterThanOrEqual(before + REQUEST_LOG_TTL_MS);
        expect(raw?.expireAt?.getTime()).toBeLessThanOrEqual(Date.now() + REQUEST_LOG_TTL_MS);
    });

    it('pruneExpired deletes rows past their expireAt', async () => {
        const old = new Date(Date.now() - REQUEST_LOG_TTL_MS - 60_000).toISOString();
        await store.append(makeEntry('ancient', { requestedAt: old }));
        await store.append(makeEntry('fresh'));

        await store.pruneExpired(new Date());

        // Assert on the raw collection: loadAll filters expired rows out either way, so it
        // cannot tell a deleted row from a merely hidden one.
        expect(await readRawDoc('ancient')).toBeNull();
        expect(await readRawDoc('fresh')).not.toBeNull();
        expect((await store.loadAll()).map(r => r.id)).toEqual(['fresh']);
    });
});
