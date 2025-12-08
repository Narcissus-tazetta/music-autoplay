import { getMessage } from '@/shared/constants/messages';
import type { Music } from '@/shared/stores/musicStore';
import type { HandlerError } from '@/shared/utils/errors';
import type { Result } from '@/shared/utils/errors/result-handlers';
import { err, ok } from '@/shared/utils/errors/result-handlers';
import logger from '../logger';
import type { AuthChecker } from './auth/authChecker';
import type { MusicEventEmitter } from './emitter/musicEventEmitter';
import type { MusicRepository } from './repository/musicRepository';
import type { YouTubeResolver } from './resolver/youtubeResolver';

export interface AddMusicRequest {
    url: string;
    requesterHash?: string;
    requesterName?: string;
}

export interface RemoveMusicRequest {
    url: string;
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
        const { url, requesterHash, requesterName } = request;

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

        const addResult = this.repository.add(music);
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

        const urlListEmitResult = this.emitter.emitUrlList(
            this.repository.buildCompatList(),
        );
        if (!urlListEmitResult.ok) {
            logger.warn('failed to emit url_list event', {
                error: urlListEmitResult.error,
            });
        }

        this.emitter.logMusicAddedMetric(music);

        const persistResult = await this.repository.persistAdd(music);
        if (!persistResult.ok) {
            logger.warn('failed to persist music', {
                error: persistResult.error,
                musicId: music.id,
            });
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
