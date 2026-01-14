import logger from '@/server/logger';
import type { Music } from '@/shared/stores/musicStore';
import { MongoClient } from 'mongodb';
import type { Collection, Db } from 'mongodb';
import type { PersistFile, Store } from './types';

export interface MongoStoreOptions {
    uri: string;
    dbName: string;
    collectionName: string;
    client?: MongoClient;
}

type MusicDoc = Music & {
    _id: string;
    createdAt?: Date;
    updatedAt?: Date;
};

export class MongoStore {
    private client: MongoClient;
    private dbName: string;
    private collectionName: string;
    private ownsClient: boolean;

    private connected: Promise<MongoClient> | null = null;

    constructor(opts: MongoStoreOptions) {
        this.dbName = opts.dbName;
        this.collectionName = opts.collectionName;

        if (opts.client) {
            this.client = opts.client;
            this.ownsClient = false;
        } else {
            // Official driver pattern: keep a single MongoClient and reuse it.
            // We keep one per store instance; bootstrap creates just one.
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

    private async getCollection(): Promise<Collection<MusicDoc>> {
        const db = await this.getDb();
        return db.collection<MusicDoc>(this.collectionName);
    }

    async initialize(): Promise<void> {
        const col = await this.getCollection();
        // _id has a unique index by default; we rely on it for idempotent upserts.
        // Create a lightweight index for ordering queries.
        try {
            await col.createIndex({ createdAt: 1 });
        } catch (error) {
            logger.debug('MongoStore: createIndex failed (non-fatal)', { error });
        }
    }

    async loadAll(): Promise<Music[]> {
        const col = await this.getCollection();
        const docs = await col
            .find({}, { sort: { createdAt: 1, _id: 1 } })
            .toArray();

        return docs.map(d => {
            const { _id, ...rest } = d;
            const id = typeof rest.id === 'string' && rest.id.length > 0 ? rest.id : _id;
            return Object.assign(rest as Record<string, unknown>, { id }) as unknown as Music;
        });
    }

    async add(m: Music): Promise<void> {
        const col = await this.getCollection();
        await col.updateOne(
            { _id: m.id },
            {
                $set: {
                    ...m,
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

    async clear(): Promise<void> {
        const col = await this.getCollection();
        await col.deleteMany({});
    }

    async flush(): Promise<void> {
        // Intentional no-op: writes are immediate.
        await Promise.resolve();
        return;
    }

    async close(): Promise<void> {
        if (!this.ownsClient) return;
        try {
            await this.client.close();
        } catch (error) {
            logger.warn('MongoStore: client.close failed', { error });
        }
    }
}

export class MongoHybridStore implements Store {
    private current: PersistFile = {
        items: [],
        lastUpdated: new Date().toISOString(),
    };

    private mongo: MongoStore;
    private pendingWrites: Promise<unknown>[] = [];

    constructor(mongo: MongoStore, initial: Music[] = []) {
        this.mongo = mongo;
        this.current.items = initial;
    }

    load(): Music[] {
        this.current.items = this.current.items || [];
        return this.current.items;
    }

    addSync(m: Music) {
        this.current.items = this.current.items || [];
        const idx = this.current.items.findIndex(x => x.id === m.id);
        if (idx !== -1) this.current.items[idx] = m;
        else this.current.items.push(m);
        this.current.lastUpdated = new Date().toISOString();

        const p = this.mongo.add(m).catch(error => logger.warn('MongoHybridStore: failed to add', { error }));
        this.pendingWrites.push(p);
        void p.finally(() => {
            this.pendingWrites = this.pendingWrites.filter(x => x !== p);
        });
    }

    add(m: Music): void | Promise<void> {
        this.addSync(m);
    }

    removeSync(id: string) {
        this.current.items = (this.current.items || []).filter(x => x.id !== id);
        this.current.lastUpdated = new Date().toISOString();

        const p = this.mongo.remove(id).catch(error => logger.warn('MongoHybridStore: failed to remove', { error }));
        this.pendingWrites.push(p);
        void p.finally(() => {
            this.pendingWrites = this.pendingWrites.filter(x => x !== p);
        });
    }

    remove(id: string): void | Promise<void> {
        this.removeSync(id);
    }

    clearSync() {
        this.current = { items: [], lastUpdated: new Date().toISOString() };

        const p = this.mongo.clear().catch(error => logger.warn('MongoHybridStore: failed to clear', { error }));
        this.pendingWrites.push(p);
        void p.finally(() => {
            this.pendingWrites = this.pendingWrites.filter(x => x !== p);
        });
    }

    clear(): void {
        this.clearSync();
    }

    async flush(): Promise<void> {
        try {
            await Promise.all(this.pendingWrites);
        } catch (error) {
            logger.warn('MongoHybridStore: flush encountered errors', { error });
        }
    }

    closeSync(): void {
        void this.flush()
            .then(() => this.mongo.close())
            .catch(error => {
                logger.warn('MongoHybridStore: closeSync failed', { error });
            });
    }
}

export default MongoHybridStore;
