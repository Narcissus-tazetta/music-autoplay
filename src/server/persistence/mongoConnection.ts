import logger from '@/server/logger.server';
import { MongoClient } from 'mongodb';
import type { Collection, Db, Document } from 'mongodb';

export interface MongoConnectionOptions {
    uri: string;
    dbName: string;
    collectionName: string;
    /** Shared client owned by the caller. When omitted this store creates and owns its own. */
    client?: MongoClient;
}

/**
 * Connection plumbing shared by MongoStore, HistoryMongoStore and RequestLogMongoStore.
 *
 * The official driver pattern is one long-lived MongoClient reused for every operation, so
 * `connect()` is memoised. A failed connect clears the memo, letting the next call retry
 * instead of awaiting a permanently rejected promise. Only a client this instance created
 * is closed by `close()` — a client passed in belongs to whoever passed it.
 */
export abstract class MongoConnection<TDoc extends Document> {
    protected readonly client: MongoClient;
    private readonly dbName: string;
    private readonly collectionName: string;
    private readonly ownsClient: boolean;
    private connected: Promise<MongoClient> | null = null;

    /** Prefixes this store's logs, e.g. `HistoryMongoStore`. */
    protected abstract readonly label: string;

    constructor(opts: MongoConnectionOptions) {
        this.dbName = opts.dbName;
        this.collectionName = opts.collectionName;

        if (opts.client) {
            this.client = opts.client;
            this.ownsClient = false;
        } else {
            this.client = new MongoClient(opts.uri, { serverSelectionTimeoutMS: 5_000 });
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

    protected async getDb(): Promise<Db> {
        await this.ensureConnected();
        return this.client.db(this.dbName);
    }

    protected async getCollection(): Promise<Collection<TDoc>> {
        const db = await this.getDb();
        return db.collection<TDoc>(this.collectionName);
    }

    async close(): Promise<void> {
        if (!this.ownsClient) return;
        try {
            await this.client.close();
        } catch (error) {
            logger.warn(`${this.label}: client.close failed`, { error });
        }
    }
}
