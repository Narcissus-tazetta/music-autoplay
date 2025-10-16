import { extractYoutubeId } from "@/shared/libs/youtube";
import { YouTubeMetaSchema } from "@/shared/schemas/music";
import type { HandlerError } from "@/shared/utils/errors";
import { toHandlerError } from "@/shared/utils/errors";
import type { Result } from "@/shared/utils/result";
import { err, ok } from "@/shared/utils/result";
import type { z } from "zod";
import logger from "../../logger";
import type { YouTubeService } from "../../services/youtubeService";
import { normalizeYoutubeMeta } from "../../utils/normalizeYoutubeMeta";

export type VideoMeta = z.infer<typeof YouTubeMetaSchema>;

export class YouTubeResolver {
  constructor(private youtubeService: YouTubeService) {}

  async resolve(urlOrId: string): Promise<Result<VideoMeta, HandlerError>> {
    const id = extractYoutubeId(urlOrId);

    if (!id) {
      return err({
        message: "URLからIDを取得できませんでした",
        code: "INVALID_URL",
      });
    }

    try {
      const res = await this.youtubeService.getVideoDetails(id);

      if (!res.ok) {
        const errorMessage = this.extractErrorMessage(res.error);
        return err({
          message: errorMessage,
          code: "YOUTUBE_API_ERROR",
          meta: { originalError: res.error },
        });
      }

      const normalized = normalizeYoutubeMeta(id, res.value);

      if (!normalized) {
        return err({
          message: "動画メタデータの取得に失敗しました",
          code: "NORMALIZE_FAILED",
        });
      }

      const parsed = YouTubeMetaSchema.safeParse(normalized);

      if (!parsed.success) {
        return err({
          message: "動画メタデータの検証に失敗しました",
          code: "VALIDATION_FAILED",
          meta: { errors: parsed.error.errors },
        });
      }

      return ok(parsed.data);
    } catch (error: unknown) {
      logger.warn("YouTubeResolver.resolve failed", {
        error,
        id: urlOrId,
      });

      return err(toHandlerError(error));
    }
  }

  private extractErrorMessage(error: unknown): string {
    if (typeof error === "string") return error;

    if (error && typeof error === "object") {
      const errObj = error as Record<string, unknown>;
      if (typeof errObj.message === "string") return errObj.message;
    }

    return "動画が見つかりませんでした";
  }

  validateMetadata(meta: VideoMeta): Result<void, HandlerError> {
    if (meta.isAgeRestricted) {
      return err({
        message: "年齢制限付き動画は登録できません",
        code: "AGE_RESTRICTED",
      });
    }

    return ok(undefined);
  }
}
