import type { HistoryItem } from '@/shared/types/history';
import logger from '../logger.server';
import { MongoConnection, type MongoConnectionOptions } from '../persistence/mongoConnection';
import { buildUpsert, computeExpireAt, docToEntity } from '../persistence/mongoDoc';
import { PendingWriteQueue } from '../persistence/pendingWrites';
import type { HistoryStore } from './historyStore';

const HISTORY_TTL_YEARS = 3;
const HISTORY_TTL_MS = HISTORY_TTL_YEARS * 365 * 24 * 60 * 60 * 1000;

export type HistoryMongoStoreOptions = MongoConnectionOptions;

type HistoryDoc = HistoryItem & {
    _id: string;
    createdAt?: Date;
    expireAt?: Date;
    updatedAt?: Date;
};

export class HistoryMongoStore extends MongoConnection<HistoryDoc> {
    protected readonly label = 'HistoryMongoStore';

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

        // History rows keep their createdAt/expireAt/updatedAt: callers already tolerate them.
        return docs.map(d => docToEntity<HistoryItem>(d));
    }

    async upsert(item: HistoryItem): Promise<void> {
        const col = await this.getCollection();
        await col.updateOne(
            { _id: item.id },
            buildUpsert(item, { expireAt: computeExpireAt(item.lastPlayedAt, HISTORY_TTL_MS) }),
            { upsert: true },
        );
    }

    async remove(id: string): Promise<void> {
        const col = await this.getCollection();
        await col.deleteOne({ _id: id });
    }
}

export class HistoryMongoHybridStore implements HistoryStore {
    private current: HistoryItem[] = [];
    private readonly mongo: HistoryMongoStore;
    private readonly pending = new PendingWriteQueue('HistoryMongoHybridStore');

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

        this.pending.track(
            this.mongo
                .upsert(item)
                .catch(error => logger.warn('HistoryMongoHybridStore: failed to upsert', { error })),
        );
    }

    remove(id: string): void {
        this.current = this.current.filter(v => v.id !== id);
        this.pending.track(
            this.mongo
                .remove(id)
                .catch(error => logger.warn('HistoryMongoHybridStore: failed to remove', { error })),
        );
    }

    async flush(): Promise<void> {
        await this.pending.settle();
    }

    closeSync(): void {
        void this.flush().catch(error => {
            logger.warn('HistoryMongoHybridStore: closeSync failed', { error });
        });
    }
}
