import logger from '@/server/logger';
import { RequestLogMongoHybridStore, RequestLogMongoStore } from '@/server/requestLog/requestLogMongoStore';
import type { RequestLogEntry, RequestLogQuery } from '@/shared/types/requestLog';
import { describe, expect, jest, test } from 'bun:test';

const makeEntry = (id: string, overrides?: Partial<RequestLogEntry>): RequestLogEntry => ({
    id,
    musicId: 'aaaaaaaaaaa',
    requesterHash: 'abc123def4567890abcdef1234567890abcdef1234567890abcdef1234567890',
    requesterName: '550e8400...',
    requestedAt: new Date().toISOString(),
    title: `title-${id}`,
    url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa',
    ...overrides,
});

class MockRequestLogMongoStore {
    public appended: string[] = [];
    public prunedAt: Date | undefined;
    public queriedInput: RequestLogQuery | undefined;
    public queryRows: RequestLogEntry[] = [];
    public shouldFail = false;

    async append(entry: RequestLogEntry): Promise<void> {
        if (this.shouldFail) throw new Error('mongo write failed');
        this.appended.push(entry.id);
    }

    async pruneExpired(now: Date): Promise<void> {
        this.prunedAt = now;
    }

    async query(input?: RequestLogQuery): Promise<RequestLogEntry[]> {
        this.queriedInput = input;
        return this.queryRows;
    }
}

class FakeFindCursor {
    public limitValue: number | undefined;

    constructor(
        private readonly docs: unknown[],
        private readonly onLimit?: (limit: number) => void,
    ) {}

    limit(limit: number): this {
        this.limitValue = limit;
        this.onLimit?.(limit);
        return this;
    }

    async toArray(): Promise<unknown[]> {
        return this.docs;
    }
}

class FakeCollection {
    public createdIndexes: unknown[] = [];
    public deleteFilter: unknown;
    public findFilter: unknown;
    public findOptions: unknown;
    public limitValue: number | undefined;
    public shouldFailTtlIndex = false;

    constructor(private readonly docs: unknown[] = []) {}

    async createIndex(index: unknown, opts?: { name?: string }): Promise<string> {
        if (opts?.name === 'request_logs_expireAt_ttl' && this.shouldFailTtlIndex) throw new Error('ttl index failed');
        this.createdIndexes.push({ index, opts });
        return opts?.name ?? 'index';
    }

    find(filter: unknown, options: unknown): FakeFindCursor {
        this.findFilter = filter;
        this.findOptions = options;
        return new FakeFindCursor(this.docs, limit => {
            this.limitValue = limit;
        });
    }

    async deleteMany(filter: unknown): Promise<{ deletedCount: number }> {
        this.deleteFilter = filter;
        return { deletedCount: 1 };
    }

    async updateOne(): Promise<void> {
        return undefined;
    }
}

class FakeMongoClient {
    constructor(private readonly collection: FakeCollection) {}

    async connect(): Promise<this> {
        return this;
    }

    db(): { collection: () => FakeCollection } {
        return { collection: () => this.collection };
    }
}

function createMongoStore(collection: FakeCollection): RequestLogMongoStore {
    return new RequestLogMongoStore({
        client: new FakeMongoClient(collection) as never,
        collectionName: 'requestLogs',
        dbName: 'test',
        uri: 'mongodb://example.test',
    });
}

describe('RequestLogMongoHybridStore', () => {
    test('append をインメモリ状態とMongo書き込みに反映する', async () => {
        const mongo = new MockRequestLogMongoStore();
        const store = new RequestLogMongoHybridStore(mongo as never, [makeEntry('a')]);

        store.append(makeEntry('a', { title: 'updated-a' }));
        store.append(makeEntry('b'));
        await store.flush();

        expect(store.load().entries.map(v => v.id)).toEqual(['a', 'b']);
        expect(store.load().entries[0]?.title).toBe('updated-a');
        expect(mongo.appended).toEqual(['a', 'b']);
    });

    test('Mongo書き込み失敗でもインメモリ状態とflushは落ちない', async () => {
        const mongo = new MockRequestLogMongoStore();
        mongo.shouldFail = true;
        const store = new RequestLogMongoHybridStore(mongo as never);

        store.append(makeEntry('a'));
        await expect(store.flush()).resolves.toBeUndefined();
        expect(store.load().entries.map(v => v.id)).toEqual(['a']);
    });

    test('pruneExpired はメモリとMongoの期限切れ削除に反映する', () => {
        const mongo = new MockRequestLogMongoStore();
        const now = new Date();
        const oldDate = new Date(now.getTime() - (31 * 24 * 60 * 60 * 1000)).toISOString();
        const store = new RequestLogMongoHybridStore(mongo as never, [
            makeEntry('fresh'),
            makeEntry('old', { requestedAt: oldDate }),
        ]);

        store.pruneExpired(now);

        expect(store.load().entries.map(v => v.id)).toEqual(['fresh']);
        expect(mongo.prunedAt).toBe(now);
    });

    test('query はMongo query結果とメモリ上の未同期ログを統合する', async () => {
        const mongo = new MockRequestLogMongoStore();
        mongo.queryRows = [makeEntry('mongo-row', { requestedAt: '2026-01-01T00:00:00.000Z' })];
        const store = new RequestLogMongoHybridStore(mongo as never, [
            makeEntry('memory-row', { requestedAt: '2025-01-01T00:00:00.000Z' }),
        ]);

        const rows = await store.query({ limit: 10, requesterHash: makeEntry('x').requesterHash });

        expect(mongo.queriedInput?.limit).toBe(10);
        expect(rows.map(row => row.id)).toEqual(['mongo-row', 'memory-row']);
    });
});

describe('RequestLogMongoStore', () => {
    test('loadAll は期限内ログだけを上限付きで読む', async () => {
        const collection = new FakeCollection([makeEntry('a')]);
        const store = createMongoStore(collection);

        await store.loadAll();

        expect(collection.findFilter).toEqual({
            expireAt: { $gt: expect.any(Date) },
            requestedAt: { $gte: expect.any(String) },
        });
        expect(collection.limitValue).toBe(5000);
    });

    test('query は requesterHash をMongo filterに渡す', async () => {
        const hash = makeEntry('a').requesterHash;
        const collection = new FakeCollection([makeEntry('a')]);
        const store = createMongoStore(collection);

        await store.query({ limit: 20, requesterHash: hash });

        expect(collection.findFilter).toEqual({
            expireAt: { $gt: expect.any(Date) },
            requestedAt: { $gte: expect.any(String) },
            requesterHash: hash,
        });
        expect(collection.limitValue).toBe(20);
    });

    test('initialize はTTL index失敗をwarnしつつ通常index作成を分離する', async () => {
        const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger as never);
        const collection = new FakeCollection();
        collection.shouldFailTtlIndex = true;
        const store = createMongoStore(collection);

        await store.initialize();

        expect(collection.createdIndexes).toHaveLength(2);
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    test('pruneExpired はexpireAtとrequestedAtの両方で削除条件を作る', async () => {
        const collection = new FakeCollection();
        const store = createMongoStore(collection);
        const now = new Date();

        await store.pruneExpired(now);

        expect(collection.deleteFilter).toEqual({
            $or: [
                { expireAt: { $lte: now } },
                { requestedAt: { $lt: expect.any(String) } },
            ],
        });
    });
});
