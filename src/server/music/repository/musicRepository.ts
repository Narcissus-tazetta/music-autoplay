import type { Music } from '@/shared/stores/musicStore';
import type { HandlerError } from '@/shared/utils/errors';
import { toHandlerError } from '@/shared/utils/errors';
import type { Result } from '@/shared/utils/errors/result-handlers';
import { err, ok } from '@/shared/utils/errors/result-handlers';
import { watchUrl } from '@/shared/utils/youtube';
import logger from '../../logger';
import type { Store } from '../../persistence';
import { persistAdd, persistRemove } from '../../persistence/storeHelpers';

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

    add(music: Music, atIndex?: number): Result<void, HandlerError> {
        try {
            if (atIndex == undefined) {
                this.musicDB.set(music.id, music);
                return ok(undefined);
            }
            const entries = [...this.musicDB.entries()];
            const clamped = Math.max(0, Math.min(atIndex, entries.length));
            entries.splice(clamped, 0, [music.id, music]);
            this.setEntryOrder(entries);
            return ok(undefined);
        } catch (error: unknown) {
            return err(toHandlerError(error));
        }
    }

    /**
     * Moves `id` directly after `afterId` (INSERT_AT_FRONT moves it to the front).
     * An anchor that already left the queue falls back to the front, matching
     * the insertAfterId fallback in MusicService.addMusic.
     */
    reorder(id: string, afterId: string): Result<void, HandlerError> {
        try {
            const music = this.musicDB.get(id);
            if (!music) return err(toHandlerError(new Error(`music not found: ${id}`)));
            if (afterId === id) return ok(undefined);
            const entries = [...this.musicDB.entries()].filter(([key]) => key !== id);
            const anchorIndex = entries.findIndex(([key]) => key === afterId);
            entries.splice(anchorIndex + 1, 0, [id, music]);
            this.setEntryOrder(entries);
            return ok(undefined);
        } catch (error: unknown) {
            return err(toHandlerError(error));
        }
    }

    remove(id: string): Result<void, HandlerError> {
        try {
            this.musicDB.delete(id);
            return ok(undefined);
        } catch (error: unknown) {
            return err(toHandlerError(error));
        }
    }

    list(): Music[] {
        return [...this.musicDB.values()];
    }

    buildCompatList(): (Music & { url: string })[] {
        try {
            return this.list().map(m => Object.assign({}, m, { url: watchUrl(m.id) }));
        } catch (error: unknown) {
            logger.debug('MusicRepository.buildCompatList failed', { error });
            return [];
        }
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
