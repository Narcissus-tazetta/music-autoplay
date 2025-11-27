import type { Music, RemoteStatus } from "@/shared/stores/musicStore";
import type { Socket } from "socket.io";
import type { Server as IOServer } from "socket.io";
import type { Store } from "../../persistence";
import type { RateLimiter } from "../../services/rateLimiter";
import type { YouTubeService } from "../../services/youtubeService";
import type { EmitOptions } from "../../utils/safeEmit";
import ServiceResolver from "../../utils/serviceResolver";
import type { SocketManager } from "../managers/manager";
import { createAdminAuthHandlers } from "./adminHandlers";
import { registerBatchHandlers } from "./eventHandler";
import { createMusicHandlers } from "./musicHandlers";
import {
  createGetAllMusicsHandler,
  createGetRemoteStatusHandler,
} from "./standardHandlers";

export type HandlerDeps = {
  musicDB: Map<string, Music>;
  io: IOServer;
  emit?: (ev: string, payload: unknown, opts?: EmitOptions) => boolean;
  youtubeService?: YouTubeService;
  manager?: SocketManager;
  fileStore?: Store;
  isAdmin: (h?: string) => boolean;
  adminHash?: string;
  rateLimiter?: RateLimiter;
  rateLimitConfig?: {
    maxAttempts: number;
    windowMs: number;
  };
};

export function registerSocketHandlers(
  socket: Socket,
  ctx: { socketId: string; connectionId: string; requestId?: string },
  deps: HandlerDeps,
) {
  const resolver = ServiceResolver.getInstance();

  const getAllMusicsHandler = createGetAllMusicsHandler(deps.musicDB);

  let getRemoteStatusHandler;
  if (deps.manager) {
    getRemoteStatusHandler = createGetRemoteStatusHandler(
      deps.manager.getCurrent(),
    );
  } else {
    const maybeRemote = (deps as unknown as Record<string, unknown>)[
      "remoteStatus"
    ];
    if (maybeRemote && typeof maybeRemote === "object") {
      getRemoteStatusHandler = createGetRemoteStatusHandler(
        maybeRemote as unknown as RemoteStatus,
      );
    }
  }

  const youtubeService =
    deps.youtubeService ?? resolver.resolve<YouTubeService>("youtubeService");
  const fileStore = deps.fileStore ?? resolver.resolve<Store>("fileStore");

  if (!youtubeService || !fileStore)
    throw new Error("youtubeService and fileStore are required");

  const musicHandlers = createMusicHandlers({
    musicDB: deps.musicDB,
    io: deps.io,
    youtubeService,
    fileStore,
    isAdmin: deps.isAdmin,
    rateLimiter: deps.rateLimiter,
  });

  const handlers = [
    { event: "getAllMusics", handler: getAllMusicsHandler },
    ...(getRemoteStatusHandler
      ? [{ event: "getRemoteStatus", handler: getRemoteStatusHandler }]
      : []),
  ];

  registerBatchHandlers(socket, { handlers }, ctx);

  if (deps.adminHash && deps.rateLimiter && deps.rateLimitConfig) {
    const adminHandlers = createAdminAuthHandlers(
      deps.adminHash,
      deps.rateLimiter,
      deps.rateLimitConfig.maxAttempts,
      deps.rateLimitConfig.windowMs,
    );
    registerBatchHandlers(
      socket,
      {
        handlers: [
          { event: "adminAuth", handler: adminHandlers.adminAuth },
          {
            event: "adminAuthByQuery",
            handler: adminHandlers.adminAuthByQuery,
          },
        ],
      },
      ctx,
    );
  }

  musicHandlers.register(socket, ctx);
}
