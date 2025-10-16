import type { Socket } from "socket.io";
import type { Server as IOServer } from "socket.io";
import type { Music, RemoteStatus } from "~/stores/musicStore";
import type { Store } from "../../persistence";
import type { YouTubeService } from "../../services/youtubeService";
import type { EmitOptions } from "../../utils/safeEmit";
import ServiceResolver from "../../utils/serviceResolver";
import type { SocketManager } from "../managers/manager";
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
};

export function registerSocketHandlers(
  socket: Socket,
  ctx: { socketId: string; connectionId: string; requestId?: string },
  deps: HandlerDeps,
) {
  const resolver = ServiceResolver.getInstance();

  const getAllMusicsHandler = createGetAllMusicsHandler(deps.musicDB);

  let getRemoteStatusHandler;
  if (deps.manager)
    getRemoteStatusHandler = createGetRemoteStatusHandler(
      deps.manager.getCurrent(),
    );
  else {
    const maybeRemote = (deps as unknown as Record<string, unknown>)[
      "remoteStatus"
    ];
    if (maybeRemote && typeof maybeRemote === "object")
      getRemoteStatusHandler = createGetRemoteStatusHandler(
        maybeRemote as unknown as RemoteStatus,
      );
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
  });

  const handlers = [
    { event: "getAllMusics", handler: getAllMusicsHandler },
    ...(getRemoteStatusHandler
      ? [{ event: "getRemoteStatus", handler: getRemoteStatusHandler }]
      : []),
  ];

  registerBatchHandlers(socket, { handlers }, ctx);

  musicHandlers.register(socket, ctx);
}
