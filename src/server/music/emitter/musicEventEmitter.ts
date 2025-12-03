import type { Music } from '@/shared/stores/musicStore';
import type { HandlerError } from '@/shared/utils/errors';
import { toHandlerError } from '@/shared/utils/errors';
import type { Result } from '@/shared/utils/errors/result-handlers';
import { err, ok } from '@/shared/utils/errors/result-handlers';
import { watchUrl } from '@/shared/utils/youtube';
import logger, { logMetric } from '../../logger';

export interface EmitOptions {
    context?: {
        operation?: string;
        identifiers?: Record<string, unknown>;
        [key: string]: unknown;
    };
}

export type EmitFn = (
    event: string,
    payload: unknown,
    options?: EmitOptions,
) => boolean;

export class MusicEventEmitter {
    constructor(private emitFn: EmitFn) {}

    emitMusicAdded(music: Music): Result<void, HandlerError> {
        try {
            this.emitFn('musicAdded', music, {
                context: {
                    identifiers: { musicId: music.id },
                    operation: 'addMusic',
                },
            });

            this.emitFn(
                'addMusic',
                { ...music, url: watchUrl(music.id) },
                {
                    context: {
                        identifiers: { musicId: music.id },
                        operation: 'addMusic-legacy',
                    },
                },
            );

            return ok(undefined);
        } catch (error: unknown) {
            return err(toHandlerError(error));
        }
    }

    emitMusicRemoved(musicId: string): Result<void, HandlerError> {
        try {
            this.emitFn('musicRemoved', musicId, {
                context: {
                    identifiers: { musicId },
                    operation: 'removeMusic',
                },
            });

            this.emitFn('deleteMusic', watchUrl(musicId), {
                context: {
                    identifiers: { musicId },
                    operation: 'removeMusic-legacy',
                },
            });

            return ok(undefined);
        } catch (error: unknown) {
            return err(toHandlerError(error));
        }
    }

    emitUrlList(musics: (Music & { url: string })[]): Result<void, HandlerError> {
        try {
            this.emitFn('url_list', musics, {
                context: {
                    operation: 'urlList-update',
                },
            });

            return ok(undefined);
        } catch (error: unknown) {
            return err(toHandlerError(error));
        }
    }

    logMusicAddedMetric(music: Music): void {
        try {
            logMetric(
                'musicAdded',
                { source: 'service' },
                { id: music.id, title: music.title },
            );
        } catch (error: unknown) {
            logger.debug('logMetric(musicAdded) failed', {
                error,
                id: music.id,
            });
        }
    }

    logMusicRemovedMetric(musicId: string): void {
        try {
            logMetric('musicRemoved', { source: 'service' }, { id: musicId });
        } catch (error: unknown) {
            logger.debug('logMetric(musicRemoved) failed', {
                error,
                id: musicId,
            });
        }
    }
}
