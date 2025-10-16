import { watchUrl } from "@/shared/libs/youtube";
import type { HandlerError } from "@/shared/utils/errors";
import { toHandlerError } from "@/shared/utils/errors";
import type { Result } from "@/shared/utils/result";
import { err, ok } from "@/shared/utils/result";
import type { Music } from "~/stores/musicStore";
import logger, { logMetric } from "../../logger";

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
      this.emitFn("musicAdded", music, {
        context: {
          operation: "addMusic",
          identifiers: { musicId: music.id },
        },
      });

      this.emitFn(
        "addMusic",
        { ...music, url: watchUrl(music.id) },
        {
          context: {
            operation: "addMusic-legacy",
            identifiers: { musicId: music.id },
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
      this.emitFn("musicRemoved", musicId, {
        context: {
          operation: "removeMusic",
          identifiers: { musicId },
        },
      });

      this.emitFn("deleteMusic", watchUrl(musicId), {
        context: {
          operation: "removeMusic-legacy",
          identifiers: { musicId },
        },
      });

      return ok(undefined);
    } catch (error: unknown) {
      return err(toHandlerError(error));
    }
  }

  emitUrlList(
    musics: Array<Music & { url: string }>,
  ): Result<void, HandlerError> {
    try {
      this.emitFn("url_list", musics, {
        context: {
          operation: "urlList-update",
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
        "musicAdded",
        { source: "service" },
        { id: music.id, title: music.title },
      );
    } catch (error: unknown) {
      logger.debug("logMetric(musicAdded) failed", {
        error,
        id: music.id,
      });
    }
  }

  logMusicRemovedMetric(musicId: string): void {
    try {
      logMetric("musicRemoved", { source: "service" }, { id: musicId });
    } catch (error: unknown) {
      logger.debug("logMetric(musicRemoved) failed", {
        error,
        id: musicId,
      });
    }
  }
}
