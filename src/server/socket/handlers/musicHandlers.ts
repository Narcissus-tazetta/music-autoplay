import { AddMusicSchema, RemoveMusicSchema } from "@/shared/schemas/music";
import type { ReplyOptions } from "@/shared/utils/errors";
import { withErrorHandler } from "@/shared/utils/errors";
import type { Socket } from "socket.io";
import type { Server } from "socket.io";
import type { Music } from "~/stores/musicStore";
import { withContext } from "../../logger";
import type { EmitFn } from "../../music/emitter/musicEventEmitter";
import type { MusicService } from "../../music/musicService";
import { createMusicService } from "../../music/musicServiceFactory";
import type { Store } from "../../persistence";
import type { YouTubeService } from "../../services/youtubeService";
import { createSocketEmitter } from "../../utils/safeEmit";
import {
  createSocketEventHandler,
  type EventContext,
  registerBatchHandlers,
} from "./eventHandler";

type Deps = {
  musicDB: Map<string, Music>;
  io?: Server;
  emit?: (
    ev: string,
    payload: unknown,
    opts?: { context?: unknown },
  ) => boolean;
  youtubeService: YouTubeService;
  fileStore: Store;
  isAdmin?: (requesterHash?: string) => boolean;
};

export function createMusicHandlers(deps: Deps) {
  const { musicDB, youtubeService, fileStore, io } = deps;

  let emitFn: EmitFn;
  if (deps.emit) {
    emitFn = (event: string, payload: unknown, options) => {
      return deps.emit!(event, payload, options);
    };
  } else if (io) {
    const emitter = createSocketEmitter(() => io);
    emitFn = (event: string, payload: unknown, options) => {
      return emitter.emit(event, payload, options);
    };
  } else {
    emitFn = () => false;
  }

  const musicService: MusicService = createMusicService({
    youtubeService,
    musicDB,
    fileStore,
    emitFn,
  });

  const addMusicHandler = createSocketEventHandler({
    event: "addMusic",
    validator: AddMusicSchema,
    handler: async (payload, context): Promise<ReplyOptions> => {
      const { url, requesterHash, requesterName } = payload;
      const l = withContext(context as Record<string, unknown>);

      const result = await musicService.addMusic({
        url,
        requesterHash,
        requesterName,
      });

      if (!result.ok) {
        l.warn("addMusic failed", {
          error: result.error,
          url,
          requesterHash,
        });
        return {
          formErrors: [result.error.message],
        };
      }

      l.info("addMusic succeeded", {
        musicId: result.value.id,
        title: result.value.title,
      });

      return {};
    },
    logPayload: false,
    logResponse: false,
  });

  const removeMusicHandler = createSocketEventHandler({
    event: "removeMusic",
    validator: RemoveMusicSchema,
    handler: async (payload, context): Promise<ReplyOptions> => {
      const { url, requesterHash } = payload;
      const l = withContext(context as Record<string, unknown>);

      const result = await musicService.removeMusic({ url, requesterHash });

      if (!result.ok) {
        l.warn("removeMusic failed", {
          error: result.error,
          url,
          requesterHash,
        });
        return {
          formErrors: [result.error.message],
        };
      }

      l.info("removeMusic succeeded", {
        url,
        requesterHash,
      });

      return {};
    },
    logPayload: false,
    logResponse: false,
  });

  const register = withErrorHandler((socket: Socket, ctx?: EventContext) => {
    registerBatchHandlers(
      socket,
      {
        handlers: [
          { event: "addMusic", handler: addMusicHandler },
          { event: "removeMusic", handler: removeMusicHandler },
        ],
      },
      ctx,
    );
  }, "register handlers");

  return { register };
}
