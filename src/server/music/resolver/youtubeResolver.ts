import { YouTubeMetaSchema } from '@/shared/schemas/music';
import type { HandlerError } from '@/shared/utils/errors';
import { toHandlerError } from '@/shared/utils/errors';
import type { Result } from '@/shared/utils/errors/result-handlers';
import { err, ok } from '@/shared/utils/errors/result-handlers';
import { extractYoutubeId } from '@/shared/utils/youtube';
import type { z } from 'zod';
import logger from '../../logger';
import type { YouTubeService } from '../../services/youtubeService';
import { normalizeYoutubeMeta } from '../../utils/normalizeYoutubeMeta';

export type VideoMeta = z.infer<typeof YouTubeMetaSchema>;

export class YouTubeResolver {
    constructor(private youtubeService: YouTubeService) {}

    async resolve(urlOrId: string): Promise<Result<VideoMeta, HandlerError>> {
        const id = extractYoutubeId(urlOrId);

        if (!id) {
            return err({
                code: 'INVALID_URL',
                message: 'URLからIDを取得できませんでした',
            });
        }

        try {
            const res = await this.youtubeService.getVideoDetails(id);

            if (!res.ok) {
                const errorMessage = this.extractErrorMessage(res.error);
                return err({
                    code: 'YOUTUBE_API_ERROR',
                    message: errorMessage,
                    meta: { originalError: res.error },
                });
            }

            const normalized = normalizeYoutubeMeta(id, res.value);

            if (!normalized) {
                return err({
                    code: 'NORMALIZE_FAILED',
                    message: '動画メタデータの取得に失敗しました',
                });
            }

            const parsed = YouTubeMetaSchema.safeParse(normalized);

            if (!parsed.success) {
                return err({
                    code: 'VALIDATION_FAILED',
                    message: '動画メタデータの検証に失敗しました',
                    meta: { errors: parsed.error.issues },
                });
            }
            return ok(parsed.data);
        } catch (error: unknown) {
            logger.warn('YouTubeResolver.resolve failed', {
                error,
                id: urlOrId,
            });

            return err(toHandlerError(error));
        }
    }

    private extractErrorMessage(error: unknown): string {
        if (typeof error === 'string') return error;

        if (error && typeof error === 'object') {
            const errObj = error as Record<string, unknown>;
            if (typeof errObj.message === 'string') return errObj.message;
        }

        return '動画が見つかりませんでした';
    }

    validateMetadata(meta: VideoMeta): Result<void, HandlerError> {
        if (meta.isAgeRestricted) {
            return err({
                code: 'AGE_RESTRICTED',
                message: '年齢制限付き動画は登録できません',
            });
        }

        return ok(undefined);
    }
}
