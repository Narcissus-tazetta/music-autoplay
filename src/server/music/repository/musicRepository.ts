import type { Music } from '@/shared/types/music';
import type { HandlerError } from '@/shared/utils/errors';
import { toHandlerError } from '@/shared/utils/errors';
import type { Result } from '@/shared/utils/errors/result-handlers';
import { err, ok } from '@/shared/utils/errors/result-handlers';
import { watchUrl } from '@/shared/utils/youtube';
import type { Store } from '../../persistence';
import { persistAdd, persistRemove } from '../../persistence/storeHelpers';

/**
 * Ordered view over the in-memory music map.
 *
 * The mutating methods below operate on a Map and cannot throw, so they return plain values;
 * they used to be wrapped in try/catch returning `Result<void, HandlerError>`, which every
 * caller then had to unwrap. Only the persist* methods, which touch the store, keep a Result.
 */
export class MusicRepository {
    constructor(
        private musicDB: Map<string, Music>,
        private fileStore: Store,
    ) {}

    has(id: string): boolean {
        return this.musicDB.has(id);
    }

    get(id: string): Music | undefined {
        return this.musicDB.get(id);
    }

    getPosition(id: string): number {
        let idx = 0;
        for (const key of this.musicDB.keys()) {
            if (key === id) return idx;
            idx++;
        }
        return -1;
    }

    // Ordering is encoded in the Map's insertion order, so positional changes rebuild it.
    private setEntryOrder(entries: Array<[string, Music]>): void {
        this.musicDB.clear();
        for (const [key, value] of entries) this.musicDB.set(key, value);
    }

    add(music: Music, atIndex?: number): void {
        if (atIndex == undefined) {
            this.musicDB.set(music.id, music);
            return;
        }
        const entries = [...this.musicDB.entries()];
        const clamped = Math.max(0, Math.min(atIndex, entries.length));
        entries.splice(clamped, 0, [music.id, music]);
        this.setEntryOrder(entries);
    }

    /**
     * Moves `id` directly after `afterId` (INSERT_AT_FRONT moves it to the front).
     * An anchor that already left the queue falls back to the front, matching
     * the insertAfterId fallback in MusicService.addMusic.
     */
    reorder(id: string, afterId: string): void {
        const music = this.musicDB.get(id);
        if (!music || afterId === id) return;
        const entries = [...this.musicDB.entries()].filter(([key]) => key !== id);
        const anchorIndex = entries.findIndex(([key]) => key === afterId);
        entries.splice(anchorIndex + 1, 0, [id, music]);
        this.setEntryOrder(entries);
    }

    remove(id: string): void {
        this.musicDB.delete(id);
    }

    list(): Music[] {
        return [...this.musicDB.values()];
    }

    buildCompatList(): (Music & { url: string })[] {
        return this.list().map(m => Object.assign({}, m, { url: watchUrl(m.id) }));
    }

    async persistAdd(music: Music, atIndex?: number): Promise<Result<void, HandlerError>> {
        try {
            await persistAdd(this.fileStore, music, atIndex);
            return ok(undefined);
        } catch (error: unknown) {
            return err(toHandlerError(error));
        }
    }

    persistRemove(id: string): Result<void, HandlerError> {
        try {
            void persistRemove(this.fileStore, id);
            return ok(undefined);
        } catch (error: unknown) {
            return err(toHandlerError(error));
        }
    }

    persistReorder(): Result<void, HandlerError> {
        try {
            if (!this.fileStore.reorder)
                return err(toHandlerError(new Error('current store does not support persisting reorder')));
            void this.fileStore.reorder(this.list());
            return ok(undefined);
        } catch (error: unknown) {
            return err(toHandlerError(error));
        }
    }
}
