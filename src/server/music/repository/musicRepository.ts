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

    add(music: Music): Result<void, HandlerError> {
        try {
            this.musicDB.set(music.id, music);
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
        return Array.from(this.musicDB.values());
    }

    buildCompatList(): (Music & { url: string })[] {
        try {
            return this.list().map(m => ({ ...m, url: watchUrl(m.id) }));
        } catch (error: unknown) {
            logger.debug('MusicRepository.buildCompatList failed', { error });
            return [];
        }
    }

    async persistAdd(music: Music): Promise<Result<void, HandlerError>> {
        try {
            await persistAdd(this.fileStore, music);
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
}
