import { extractYoutubeId } from "@/shared/libs/youtube";
import { YouTubeMetaSchema } from "@/shared/schemas/music";
import { z } from "zod";
import logger from "../logger";
import { normalizeYoutubeMeta } from "../utils/normalizeYoutubeMeta";
import type { YouTubeService } from "../youtubeService";

export type VideoMeta = z.infer<typeof YouTubeMetaSchema>;
export type VideoMetaResult =
  | { ok: true; value: VideoMeta }
  | { ok: false; error: unknown };

export default class YouTubeResolver {
  constructor(private youtubeService: YouTubeService) {}

  async resolve(urlOrId: string): Promise<VideoMetaResult> {
    const id = extractYoutubeId(urlOrId);
    if (!id) return { ok: false, error: "invalid id" };
    try {
      const res = await this.youtubeService.getVideoDetails(id);
      if (!res.ok) return { ok: false, error: res.error };
      const normalized = normalizeYoutubeMeta(id, res.value);
      if (!normalized) return { ok: false, error: "normalize failed" };
      const parsed = YouTubeMetaSchema.safeParse(normalized);
      if (!parsed.success) return { ok: false, error: parsed.error };
      return { ok: true, value: parsed.data };
    } catch (err: unknown) {
      logger.warn("YouTubeResolver.resolve failed", {
        error: err,
        id: urlOrId,
      });
      return { ok: false, error: err };
    }
  }
}
