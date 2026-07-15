import { getMessage } from '@/shared/constants/messages';
import { INSERT_AT_END, INSERT_AT_FRONT } from '@/shared/schemas/music';
import type { Music } from '@/shared/stores/musicStore';
import type { HandlerError } from '@/shared/utils/errors';
import type { Result } from '@/shared/utils/errors/result-handlers';
import { err, ok } from '@/shared/utils/errors/result-handlers';
import { watchUrl } from '@/shared/utils/youtube';
import logger from '../logger';
import { getRequestLogService } from '../requestLog/requestLogService';
import type { AuthChecker } from './auth/authChecker';
import type { MusicEventEmitter } from './emitter/musicEventEmitter';
import type { MusicRepository } from './repository/musicRepository';
import type { YouTubeResolver } from './resolver/youtubeResolver';

export interface AddMusicRequest {
    url: string;
    requesterHash?: string;
    requesterName?: string;
    insertAfterId?: string;
}

export interface RemoveMusicRequest {
    url: string;
    requesterHash?: string;
}

export interface ReorderMusicRequest {
    id: string;
    /** Anchor id to place `id` after; INSERT_AT_FRONT moves it to the front. */
    afterId: string;
    requesterHash?: string;
}

export class MusicService {
    constructor(
        private auth: AuthChecker,
        private resolver: YouTubeResolver,
        public readonly repository: MusicRepository,
        public readonly emitter: MusicEventEmitter,
    ) {}

    async addMusic(
        request: AddMusicRequest,
    ): Promise<Result<Music, HandlerError>> {
        const { url, requesterHash, requesterName, insertAfterId } = request;

        const resolveResult = await this.resolver.resolve(url);
        if (!resolveResult.ok) return err(resolveResult.error);

        const meta = resolveResult.value;

        const validationResult = this.resolver.validateMetadata(meta);
        if (!validationResult.ok) return err(validationResult.error);

        if (this.repository.has(meta.id)) {
            const position = this.repository.getPosition(meta.id);
            return err({
                code: 'ALREADY_EXISTS',
                message: getMessage('ERROR_ALREADY_EXISTS', position + 1),
                meta: { position },
            });
        }

        const music: Music = {
            channelId: meta.channelId,
            channelName: meta.channelTitle,
            duration: meta.duration ?? 'PT0S',
            id: meta.id,
            requestedAt: new Date().toISOString(),
            requesterHash,
            requesterName,
            title: meta.title,
        };

        // If the anchor already left the queue (e.g. it finished playing before this request
        // arrived), fall back to the front rather than the end: the requester picked it to
        // jump the queue, so silently appending to the end would invert their intent.
        const atIndex = insertAfterId === INSERT_AT_FRONT
            ? 0
            : insertAfterId != undefined && insertAfterId !== INSERT_AT_END
            ? Math.max(0, this.repository.getPosition(insertAfterId) + 1)
            : undefined;

        const addResult = this.repository.add(music, atIndex);
        if (!addResult.ok) return err(addResult.error);

        logger.info('music added', {
            id: music.id,
            requesterHash,
            title: music.title,
        });

        const emitResult = this.emitter.emitMusicAdded(music);
        if (!emitResult.ok) {
            logger.warn('failed to emit musicAdded event', {
                error: emitResult.error,
                musicId: music.id,
            });
        }

        // musicAdded only carries the music itself, so clients that append it to the end of
        // their local list would misplace it. Follow up with the authoritative order whenever
        // it wasn't simply appended.
        if (atIndex != undefined) {
            const reorderEmitResult = this.emitter.emitQueueReordered(this.repository.list());
            if (!reorderEmitResult.ok) {
                logger.warn('failed to emit queueReordered event after insert', {
                    error: reorderEmitResult.error,
                    musicId: music.id,
                });
            }
        }

        const urlListEmitResult = this.emitter.emitUrlList(
            this.repository.buildCompatList(),
        );
        if (!urlListEmitResult.ok) {
            logger.warn('failed to emit url_list event', {
                error: urlListEmitResult.error,
            });
        }

        this.emitter.logMusicAddedMetric(music);

        const persistResult = await this.repository.persistAdd(music, atIndex);
        if (!persistResult.ok) {
            logger.warn('failed to persist music', {
                error: persistResult.error,
                musicId: music.id,
            });
        }

        try {
            getRequestLogService().appendFromMusic(music, watchUrl(music.id));
        } catch (error) {
            logger.warn('failed to append request log', { error, musicId: music.id });
        }

        return ok(music);
    }

    async removeMusic(
        request: RemoveMusicRequest,
    ): Promise<Result<void, HandlerError>> {
        const { url, requesterHash } = request;

        const resolveResult = await this.resolver.resolve(url);
        if (!resolveResult.ok) return err(resolveResult.error);

        const id = resolveResult.value.id;

        if (!this.repository.has(id)) {
            return err({
                code: 'NOT_FOUND',
                message: getMessage('ERROR_NOT_FOUND'),
            });
        }

        const existing = this.repository.get(id);
        if (!existing) {
            return err({
                code: 'NOT_FOUND',
                message: getMessage('ERROR_NOT_FOUND'),
            });
        }

        const canRemove = this.auth.canRemoveMusic(
            requesterHash,
            existing.requesterHash,
        );
        if (!canRemove.ok) return err(canRemove.error);

        if (!canRemove.value) {
            return err({
                code: 'FORBIDDEN',
                message: getMessage('ERROR_FORBIDDEN'),
            });
        }

        const removeResult = this.repository.remove(id);
        if (!removeResult.ok) return err(removeResult.error);

        logger.info('music removed', {
            id,
            requesterHash,
        });

        const emitResult = this.emitter.emitMusicRemoved(id);
        if (!emitResult.ok) {
            logger.warn('failed to emit musicRemoved event', {
                error: emitResult.error,
                musicId: id,
            });
        }

        const urlListEmitResult = this.emitter.emitUrlList(
            this.repository.buildCompatList(),
        );
        if (!urlListEmitResult.ok) {
            logger.warn('failed to emit url_list event', {
                error: urlListEmitResult.error,
            });
        }

        this.emitter.logMusicRemovedMetric(id);

        const persistResult = this.repository.persistRemove(id);
        if (!persistResult.ok) {
            logger.warn('failed to persist music removal', {
                error: persistResult.error,
                musicId: id,
            });
        }

        return ok(undefined);
    }

    async reorderMusic(
        request: ReorderMusicRequest,
    ): Promise<Result<Music[], HandlerError>> {
        const { id, afterId, requesterHash } = request;

        const existing = this.repository.get(id);
        if (!existing) {
            return err({
                code: 'NOT_FOUND',
                message: getMessage('ERROR_NOT_FOUND'),
            });
        }

        const canReorder = this.auth.canRemoveMusic(
            requesterHash,
            existing.requesterHash,
        );
        if (!canReorder.ok) return err(canReorder.error);

        if (!canReorder.value) {
            return err({
                code: 'FORBIDDEN',
                message: getMessage('ERROR_REORDER_FORBIDDEN'),
            });
        }

        const reorderResult = this.repository.reorder(id, afterId);
        if (!reorderResult.ok) return err(reorderResult.error);

        logger.info('music reordered', { afterId, id, requesterHash });

        const orderedList = this.repository.list();

        const emitResult = this.emitter.emitQueueReordered(orderedList);
        if (!emitResult.ok) {
            logger.warn('failed to emit queueReordered event', {
                error: emitResult.error,
                musicId: id,
            });
        }

        const urlListEmitResult = this.emitter.emitUrlList(
            this.repository.buildCompatList(),
        );
        if (!urlListEmitResult.ok) {
            logger.warn('failed to emit url_list event', {
                error: urlListEmitResult.error,
            });
        }

        const persistResult = this.repository.persistReorder();
        if (!persistResult.ok) {
            logger.warn('failed to persist music reorder', {
                error: persistResult.error,
                musicId: id,
            });
        }

        return ok(orderedList);
    }

    listMusics(): Music[] {
        return this.repository.list();
    }

    getMusic(id: string): Music | undefined {
        return this.repository.get(id);
    }

    buildCompatList(): (Music & { url: string })[] {
        return this.repository.buildCompatList();
    }
}
