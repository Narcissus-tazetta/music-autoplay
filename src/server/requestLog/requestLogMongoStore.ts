import type {
    RequestLogEntry,
    RequestLogPersistFile,
    RequestLogQuery,
    RequestLogStore,
} from '@/shared/types/requestLog';
import { MongoClient } from 'mongodb';
import type { Collection, Db, Filter } from 'mongodb';
import logger from '../logger';

const REQUEST_LOG_TTL_DAYS = 30;
const REQUEST_LOG_TTL_MS = REQUEST_LOG_TTL_DAYS * 24 * 60 * 60 * 1000;
const REQUEST_LOG_LOAD_LIMIT = 5_000;
const PENDING_WRITE_WARN_THRESHOLD = 100;
const FAILED_WRITE_QUEUE_LIMIT = 500;

export interface RequestLogMongoStoreOptions {
    uri: string;
    dbName: string;
    collectionName: string;
    client?: MongoClient;
}

type RequestLogDoc = RequestLogEntry & {
    _id: string;
    createdAt?: Date;
    expireAt?: Date;
    updatedAt?: Date;
};

function computeExpireAt(requestedAt: string): Date {
    const baseMs = Date.parse(requestedAt);
    const safeBase = Number.isFinite(baseMs) ? baseMs : Date.now();
    return new Date(safeBase + REQUEST_LOG_TTL_MS);
}

function toEntry(doc: RequestLogDoc): RequestLogEntry {
    const { _id, createdAt: _createdAt, expireAt: _expireAt, updatedAt: _updatedAt, ...rest } = doc;
    const id = typeof rest.id === 'string' && rest.id.length > 0 ? rest.id : _id;
    return Object.assign(rest as Record<string, unknown>, { id }) as unknown as RequestLogEntry;
}

function buildRecentFilter(input?: RequestLogQuery, now = new Date()): Filter<RequestLogDoc> {
    const cutoff = new Date(now.getTime() - REQUEST_LOG_TTL_MS).toISOString();
    const filter: Filter<RequestLogDoc> = {
        expireAt: { $gt: now },
        requestedAt: { $gte: cutoff },
    };
    const requesterHash = input?.requesterHash?.trim().toLowerCase();
    const hashPrefix = input?.hashPrefix?.trim().toLowerCase();

    if (requesterHash) filter.requesterHash = requesterHash;
    else if (hashPrefix) filter.requesterHash = { $regex: `^${hashPrefix}` };

    return filter;
}

function matchesQuery(entry: RequestLogEntry, input?: RequestLogQuery): boolean {
    const requesterHash = input?.requesterHash?.trim().toLowerCase();
    const hashPrefix = input?.hashPrefix?.trim().toLowerCase();
    const entryHash = entry.requesterHash.toLowerCase();

    if (requesterHash) return entryHash === requesterHash;
    if (hashPrefix) return entryHash.startsWith(hashPrefix);
    return true;
}

export class RequestLogMongoStore {
    private client: MongoClient;
    private dbName: string;
    private collectionName: string;
    private ownsClient: boolean;
    private connected: Promise<MongoClient> | null = null;

    constructor(opts: RequestLogMongoStoreOptions) {
        this.dbName = opts.dbName;
        this.collectionName = opts.collectionName;

        if (opts.client) {
            this.client = opts.client;
            this.ownsClient = false;
        } else {
            this.client = new MongoClient(opts.uri, {
                serverSelectionTimeoutMS: 5_000,
            });
            this.ownsClient = true;
        }
    }

    private async ensureConnected(): Promise<void> {
        if (!this.connected) {
            this.connected = this.client.connect().catch(error => {
                this.connected = null;
                throw error;
            });
        }
        await this.connected;
    }

    private async getDb(): Promise<Db> {
        await this.ensureConnected();
        return this.client.db(this.dbName);
    }

    private async getCollection(): Promise<Collection<RequestLogDoc>> {
        const db = await this.getDb();
        return db.collection<RequestLogDoc>(this.collectionName);
    }

    async initialize(): Promise<void> {
        const col = await this.getCollection();

        try {
            await col.createIndex({ requesterHash: 1, requestedAt: -1 });
        } catch (error) {
            logger.debug('RequestLogMongoStore: requesterHash index creation failed (non-fatal)', { error });
        }

        try {
            await col.createIndex({ requestedAt: -1 });
        } catch (error) {
            logger.debug('RequestLogMongoStore: requestedAt index creation failed (non-fatal)', { error });
        }

        try {
            await col.createIndex(
                { expireAt: 1 },
                {
                    expireAfterSeconds: 0,
                    name: 'request_logs_expireAt_ttl',
                },
            );
        } catch (error) {
            logger.warn('RequestLogMongoStore: TTL index creation failed; expired request logs may persist', {
                error,
            });
        }
    }

    async loadAll(): Promise<RequestLogEntry[]> {
        const col = await this.getCollection();
        const docs = await col
            .find(buildRecentFilter(), { sort: { requestedAt: -1, _id: 1 } })
            .limit(REQUEST_LOG_LOAD_LIMIT)
            .toArray();

        return docs.map(toEntry);
    }

    async query(input?: RequestLogQuery): Promise<RequestLogEntry[]> {
        const col = await this.getCollection();
        const limit = typeof input?.limit === 'number' && Number.isFinite(input.limit)
            ? Math.min(Math.max(input.limit, 1), REQUEST_LOG_LOAD_LIMIT)
            : 50;
        const docs = await col
            .find(buildRecentFilter(input), { sort: { requestedAt: -1, _id: 1 } })
            .limit(limit)
            .toArray();

        return docs.map(toEntry);
    }

    async append(entry: RequestLogEntry): Promise<void> {
        const col = await this.getCollection();
        await col.updateOne(
            { _id: entry.id },
            {
                $set: {
                    ...entry,
                    expireAt: computeExpireAt(entry.requestedAt),
                    updatedAt: new Date(),
                },
                $setOnInsert: {
                    createdAt: new Date(),
                },
            },
            { upsert: true },
        );
    }

    async pruneExpired(now: Date): Promise<void> {
        const col = await this.getCollection();
        await col.deleteMany({
            $or: [
                { expireAt: { $lte: now } },
                { requestedAt: { $lt: new Date(now.getTime() - REQUEST_LOG_TTL_MS).toISOString() } },
            ],
        });
    }

    async close(): Promise<void> {
        if (!this.ownsClient) return;
        try {
            await this.client.close();
        } catch (error) {
            logger.warn('RequestLogMongoStore: client.close failed', { error });
        }
    }
}

export class RequestLogMongoHybridStore implements RequestLogStore {
    private current: RequestLogEntry[] = [];
    private readonly mongo: RequestLogMongoStore;
    private pendingWrites: Promise<unknown>[] = [];
    private failedWrites: RequestLogEntry[] = [];
    private failedWriteCount = 0;

    constructor(mongo: RequestLogMongoStore, initial: RequestLogEntry[] = []) {
        this.mongo = mongo;
        this.current = initial;
    }

    load(): RequestLogPersistFile {
        return {
            entries: [...this.current],
            lastUpdated: new Date().toISOString(),
        };
    }

    async query(input?: RequestLogQuery): Promise<RequestLogEntry[]> {
        await this.flush();
        try {
            const rows = await this.mongo.query(input);
            const merged = new Map<string, RequestLogEntry>();
            for (const row of rows) merged.set(row.id, row);
            for (const row of this.current) if (matchesQuery(row, input)) merged.set(row.id, row);
            return [...merged.values()]
                .toSorted((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt))
                .slice(0, input?.limit);
        } catch (error) {
            logger.warn('RequestLogMongoHybridStore: falling back to memory query', { error });
            return this.current
                .filter(row => matchesQuery(row, input))
                .toSorted((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt))
                .slice(0, input?.limit);
        }
    }

    append(entry: RequestLogEntry): void {
        const idx = this.current.findIndex(v => v.id === entry.id);
        if (idx !== -1) this.current[idx] = entry;
        else this.current.push(entry);

        this.scheduleWrite(entry);
    }

    pruneExpired(now: Date): void {
        const cutoffMs = now.getTime() - REQUEST_LOG_TTL_MS;
        this.current = this.current.filter(entry => {
            const requestedAtMs = Date.parse(entry.requestedAt);
            return Number.isFinite(requestedAtMs) && requestedAtMs >= cutoffMs;
        });

        const p = this.mongo
            .pruneExpired(now)
            .catch(error => logger.warn('RequestLogMongoHybridStore: failed to prune expired logs', { error }));
        this.pendingWrites.push(p);
        void p.finally(() => {
            this.pendingWrites = this.pendingWrites.filter(x => x !== p);
        });
    }

    private scheduleWrite(entry: RequestLogEntry): void {
        const p = this.mongo
            .append(entry)
            .catch(error => {
                this.failedWriteCount += 1;
                if (this.failedWrites.length < FAILED_WRITE_QUEUE_LIMIT) this.failedWrites.push(entry);
                logger.warn('RequestLogMongoHybridStore: failed to append', {
                    error,
                    failedWriteCount: this.failedWriteCount,
                    queuedRetryCount: this.failedWrites.length,
                });
            });
        this.pendingWrites.push(p);
        if (this.pendingWrites.length > PENDING_WRITE_WARN_THRESHOLD) {
            logger.warn('RequestLogMongoHybridStore: pending write queue is growing', {
                pendingWrites: this.pendingWrites.length,
            });
        }
        void p.finally(() => {
            this.pendingWrites = this.pendingWrites.filter(x => x !== p);
        });
    }

    async flush(): Promise<void> {
        await Promise.allSettled(this.pendingWrites);

        if (this.failedWrites.length > 0) {
            const retryEntries = this.failedWrites;
            this.failedWrites = [];
            const results = await Promise.allSettled(retryEntries.map(entry => this.mongo.append(entry)));
            const retryFailures = results.filter(result => result.status === 'rejected');
            if (retryFailures.length > 0) {
                this.failedWrites.push(
                    ...retryEntries.filter((_, index) => results[index]?.status === 'rejected').slice(
                        0,
                        FAILED_WRITE_QUEUE_LIMIT,
                    ),
                );
                logger.warn('RequestLogMongoHybridStore: retrying failed writes left unresolved entries', {
                    failedWriteCount: this.failedWriteCount,
                    unresolvedRetryCount: retryFailures.length,
                    queuedRetryCount: this.failedWrites.length,
                });
            } else {
                logger.warn('RequestLogMongoHybridStore: recovered failed writes on flush', {
                    recoveredWriteCount: retryEntries.length,
                    failedWriteCount: this.failedWriteCount,
                });
                this.failedWriteCount = 0;
            }
        }
    }

    closeSync(): void {
        void this.flush().catch(error => {
            logger.warn('RequestLogMongoHybridStore: closeSync failed', { error });
        });
    }
}
