import logger from '@/server/logger';
import type { Music } from '@/shared/types/music';
import { MongoConnection, type MongoConnectionOptions } from './mongoConnection';
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
            .map(({ doc }) => {
                const { _id, order: _order, ...rest } = doc;
                const id = typeof rest.id === 'string' && rest.id.length > 0 ? rest.id : _id;
                return Object.assign(rest as Record<string, unknown>, { id }) as unknown as Music;
            });
    }

    async add(m: Music, order?: number): Promise<void> {
        const col = await this.getCollection();
        await col.updateOne(
            { _id: m.id },
            {
                $set: {
                    ...m,
                    updatedAt: new Date(),
                    ...(order != undefined ? { order } : {}),
                },
                $setOnInsert: {
                    createdAt: new Date(),
                },
            },
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
    private pendingWrites: Promise<unknown>[] = [];

    constructor(mongo: MongoStore, initial: Music[] = []) {
        this.mongo = mongo;
        this.current.items = initial;
    }

    load(): Music[] {
        this.current.items = this.current.items || [];
        return this.current.items;
    }

    private trackWrite(p: Promise<unknown>): void {
        this.pendingWrites.push(p);
        if (this.pendingWrites.length > 100) {
            logger.warn('MongoHybridStore: pendingWrites exceeds threshold', {
                count: this.pendingWrites.length,
            });
        }
        void p.finally(() => {
            this.pendingWrites = this.pendingWrites.filter(x => x !== p);
        });
    }

    addSync(m: Music, atIndex?: number) {
        this.current.items = this.current.items || [];
        const idx = this.current.items.findIndex(x => x.id === m.id);
        if (idx !== -1) {
            this.current.items[idx] = m;
            this.current.lastUpdated = new Date().toISOString();
            this.trackWrite(
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
            this.trackWrite(
                this.mongo.add(m)
                    .then(() => this.mongo.reorderAll(items))
                    .catch(error => logger.warn('MongoHybridStore: failed to add at index', { error })),
            );
            return;
        }
        this.current.items.push(m);
        this.current.lastUpdated = new Date().toISOString();
        this.trackWrite(
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
        this.trackWrite(
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

        this.trackWrite(
            this.mongo.remove(id).catch(error => logger.warn('MongoHybridStore: failed to remove', { error })),
        );
    }

    remove(id: string): void | Promise<void> {
        this.removeSync(id);
    }

    clearSync() {
        this.current = { items: [], lastUpdated: new Date().toISOString() };

        this.trackWrite(
            this.mongo.clear().catch(error => logger.warn('MongoHybridStore: failed to clear', { error })),
        );
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
