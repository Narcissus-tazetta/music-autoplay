import logger from './logger.server';
import { MongoConnection } from './persistence/mongoConnection';
import { PendingWriteQueue } from './persistence/pendingWrites';
import type { SettingsStore, StoredSettings } from './settingsPersistence.server';

type SettingsDoc = StoredSettings & { _id: string };

export class SettingsMongoStore extends MongoConnection<SettingsDoc> {
    protected readonly label = 'SettingsMongoStore';

    async loadAll(): Promise<Map<string, StoredSettings>> {
        const col = await this.getCollection();
        const docs = await col.find({}).toArray();
        return new Map(docs.map(({ _id, lastUpdated, value }) => [_id, { lastUpdated, value }]));
    }

    async upsert(userId: string, entry: StoredSettings): Promise<void> {
        const col = await this.getCollection();
        await col.updateOne({ _id: userId }, { $set: entry }, { upsert: true });
    }
}

export class SettingsMongoHybridStore implements SettingsStore {
    private readonly entries: Map<string, StoredSettings>;
    private readonly mongo: SettingsMongoStore;
    private readonly pending = new PendingWriteQueue('SettingsMongoHybridStore');

    constructor(mongo: SettingsMongoStore, initial: Map<string, StoredSettings>) {
        this.mongo = mongo;
        this.entries = initial;
    }

    load(userId: string): StoredSettings | undefined {
        return this.entries.get(userId);
    }

    save(userId: string, value: Record<string, unknown>): void {
        const entry: StoredSettings = { lastUpdated: new Date().toISOString(), value };
        this.entries.set(userId, entry);
        this.pending.enqueue(() =>
            this.mongo
                .upsert(userId, entry)
                .catch(error => logger.warn('SettingsMongoHybridStore: failed to upsert', { error }))
        );
    }

    async flush(): Promise<void> {
        await this.pending.settle();
    }

    closeSync(): void {
        void this.flush().catch(error => {
            logger.warn('SettingsMongoHybridStore: closeSync failed', { error });
        });
    }
}
