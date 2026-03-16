import type { HistoryItem } from '@/shared/types/history';
import { MongoClient } from 'mongodb';
import type { Collection, Db } from 'mongodb';
import logger from '../logger';
import type { HistoryStore } from './historyStore';

const HISTORY_TTL_YEARS = 3;
const HISTORY_TTL_MS = HISTORY_TTL_YEARS * 365 * 24 * 60 * 60 * 1000;

export interface HistoryMongoStoreOptions {
    uri: string;
    dbName: string;
    collectionName: string;
    client?: MongoClient;
}

type HistoryDoc = HistoryItem & {
    _id: string;
    createdAt?: Date;
    expireAt?: Date;
    updatedAt?: Date;
};

function computeExpireAt(lastPlayedAt: string): Date {
    const baseMs = Date.parse(lastPlayedAt);
    const safeBase = Number.isFinite(baseMs) ? baseMs : Date.now();
    return new Date(safeBase + HISTORY_TTL_MS);
}

export class HistoryMongoStore {
    private client: MongoClient;
    private dbName: string;
    private collectionName: string;
    private ownsClient: boolean;

    private connected: Promise<MongoClient> | null = null;

    constructor(opts: HistoryMongoStoreOptions) {
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

    private async getCollection(): Promise<Collection<HistoryDoc>> {
        const db = await this.getDb();
        return db.collection<HistoryDoc>(this.collectionName);
    }

    async initialize(): Promise<void> {
        const col = await this.getCollection();
        try {
            await col.createIndex({ lastPlayedAt: -1 });
            await col.createIndex(
                { expireAt: 1 },
                {
                    expireAfterSeconds: 0,
                    name: 'history_expireAt_ttl',
                },
            );
        } catch (error) {
            logger.debug('HistoryMongoStore: createIndex failed (non-fatal)', { error });
        }
    }

    async loadAll(): Promise<HistoryItem[]> {
        const col = await this.getCollection();
        const docs = await col.find({}, { sort: { lastPlayedAt: -1, _id: 1 } }).toArray();

        return docs.map(d => {
            const { _id, ...rest } = d;
            const id = typeof rest.id === 'string' && rest.id.length > 0 ? rest.id : _id;
            return Object.assign(rest as Record<string, unknown>, { id }) as unknown as HistoryItem;
        });
    }

    async upsert(item: HistoryItem): Promise<void> {
        const col = await this.getCollection();
        await col.updateOne(
            { _id: item.id },
            {
                $set: {
                    ...item,
                    expireAt: computeExpireAt(item.lastPlayedAt),
                    updatedAt: new Date(),
                },
                $setOnInsert: {
                    createdAt: new Date(),
                },
            },
            { upsert: true },
        );
    }

    async remove(id: string): Promise<void> {
        const col = await this.getCollection();
        await col.deleteOne({ _id: id });
    }

    async close(): Promise<void> {
        if (!this.ownsClient) return;
        try {
            await this.client.close();
        } catch (error) {
            logger.warn('HistoryMongoStore: client.close failed', { error });
        }
    }
}

export class HistoryMongoHybridStore implements HistoryStore {
    private current: HistoryItem[] = [];
    private readonly mongo: HistoryMongoStore;
    private pendingWrites: Promise<unknown>[] = [];

    constructor(mongo: HistoryMongoStore, initial: HistoryItem[] = []) {
        this.mongo = mongo;
        this.current = initial;
    }

    load() {
        return {
            items: this.current,
            lastUpdated: new Date().toISOString(),
        };
    }

    upsert(item: HistoryItem): void {
        const idx = this.current.findIndex(v => v.id === item.id);
        if (idx !== -1) this.current[idx] = item;
        else this.current.push(item);

        const p = this.mongo
            .upsert(item)
            .catch(error => logger.warn('HistoryMongoHybridStore: failed to upsert', { error }));
        this.pendingWrites.push(p);
        void p.finally(() => {
            this.pendingWrites = this.pendingWrites.filter(x => x !== p);
        });
    }

    remove(id: string): void {
        this.current = this.current.filter(v => v.id !== id);
        const p = this.mongo
            .remove(id)
            .catch(error => logger.warn('HistoryMongoHybridStore: failed to remove', { error }));
        this.pendingWrites.push(p);
        void p.finally(() => {
            this.pendingWrites = this.pendingWrites.filter(x => x !== p);
        });
    }

    async flush(): Promise<void> {
        try {
            await Promise.all(this.pendingWrites);
        } catch (error) {
            logger.warn('HistoryMongoHybridStore: flush encountered errors', { error });
        }
    }

    closeSync(): void {
        void this.flush().catch(error => {
            logger.warn('HistoryMongoHybridStore: closeSync failed', { error });
        });
    }
}
