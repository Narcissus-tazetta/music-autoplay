import logger from '@/server/logger';
import type { Music } from '@/shared/types/music';
import { MongoConnection, type MongoConnectionOptions } from './mongoConnection';
import { buildUpsert, docToEntity } from './mongoDoc';
import { PendingWriteQueue } from './pendingWrites';
import type { PersistFile, Store } from './types';

export type MongoStoreOptions = MongoConnectionOptions;

type MusicDoc = Music & {
    _id: string;
    createdAt?: Date;
    updatedAt?: Date;
    /** Queue position; docs written before positional inserts existed fall back to createdAt order. */
    order?: number;
};

export class MongoStore extends MongoConnection<MusicDoc> {
    protected readonly label = 'MongoStore';

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

        // Legacy docs have no `order`; their createdAt rank doubles as the position so
        // they interleave stably with docs written after reordering was introduced.
        return docs
            .map((d, createdAtRank) => ({
                doc: d,
                position: typeof d.order === 'number' ? d.order : createdAtRank,
            }))
            .toSorted((a, b) => a.position - b.position)
            // `order` is internal bookkeeping; createdAt/updatedAt are deliberately kept,
            // since callers have always received them on the music rows.
            .map(({ doc }) => docToEntity<Music>(doc, ['order']));
    }

    async add(m: Music, order?: number): Promise<void> {
        const col = await this.getCollection();
        await col.updateOne(
            { _id: m.id },
            buildUpsert(m, order != undefined ? { order } : {}),
            { upsert: true },
        );
    }

    /** Persists the queue order by stamping each doc with its index. */
    async reorderAll(musics: Music[]): Promise<void> {
        if (musics.length === 0) return;
        const col = await this.getCollection();
        await col.bulkWrite(
            musics.map((m, index) => ({
                updateOne: {
                    filter: { _id: m.id },
                    update: { $set: { order: index, updatedAt: new Date() } },
                },
            })),
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
}

export class MongoHybridStore implements Store {
    private current: PersistFile = {
        items: [],
        lastUpdated: new Date().toISOString(),
    };

    private mongo: MongoStore;
    private readonly pending = new PendingWriteQueue('MongoHybridStore');

    constructor(mongo: MongoStore, initial: Music[] = []) {
        this.mongo = mongo;
        this.current.items = initial;
    }

    load(): Music[] {
        this.current.items = this.current.items || [];
        return this.current.items;
    }

    addSync(m: Music, atIndex?: number) {
        this.current.items = this.current.items || [];
        const idx = this.current.items.findIndex(x => x.id === m.id);
        if (idx !== -1) {
            this.current.items[idx] = m;
            this.current.lastUpdated = new Date().toISOString();
            this.pending.track(
                this.mongo.add(m, idx).catch(error => logger.warn('MongoHybridStore: failed to add', { error })),
            );
            return;
        }
        if (atIndex != undefined) {
            const items = this.current.items;
            const clamped = Math.max(0, Math.min(atIndex, items.length));
            items.splice(clamped, 0, m);
            this.current.lastUpdated = new Date().toISOString();
            // A mid-queue insert shifts every following position, so restamp the whole order.
            this.pending.track(
                this.mongo.add(m)
                    .then(() => this.mongo.reorderAll(items))
                    .catch(error => logger.warn('MongoHybridStore: failed to add at index', { error })),
            );
            return;
        }
        this.current.items.push(m);
        this.current.lastUpdated = new Date().toISOString();
        this.pending.track(
            this.mongo.add(m, this.current.items.length - 1)
                .catch(error => logger.warn('MongoHybridStore: failed to add', { error })),
        );
    }

    add(m: Music, atIndex?: number): void | Promise<void> {
        this.addSync(m, atIndex);
    }

    reorderSync(musics: Music[]) {
        this.current.items = [...musics];
        this.current.lastUpdated = new Date().toISOString();
        this.pending.track(
            this.mongo.reorderAll(this.current.items)
                .catch(error => logger.warn('MongoHybridStore: failed to reorder', { error })),
        );
    }

    reorder(musics: Music[]): void | Promise<void> {
        this.reorderSync(musics);
    }

    removeSync(id: string) {
        this.current.items = (this.current.items || []).filter(x => x.id !== id);
        this.current.lastUpdated = new Date().toISOString();

        this.pending.track(
            this.mongo.remove(id).catch(error => logger.warn('MongoHybridStore: failed to remove', { error })),
        );
    }

    remove(id: string): void | Promise<void> {
        this.removeSync(id);
    }

    clearSync() {
        this.current = { items: [], lastUpdated: new Date().toISOString() };

        this.pending.track(
            this.mongo.clear().catch(error => logger.warn('MongoHybridStore: failed to clear', { error })),
        );
    }

    clear(): void {
        this.clearSync();
    }

    async flush(): Promise<void> {
        await this.pending.settle();
    }

    closeSync(): void {
        void this.flush()
            .then(() => this.mongo.close())
            .catch(error => {
                logger.warn('MongoHybridStore: closeSync failed', { error });
            });
    }
}
