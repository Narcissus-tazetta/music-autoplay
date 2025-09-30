import type { Socket } from "socket.io";
import type { Server as IOServer } from "socket.io";
import type { Music } from "~/stores/musicStore";
import registerGetAllMusics from "../handlers/getAllMusics";
import registerGetRemoteStatus from "../handlers/getRemoteStatus";
import createMusicHandlers from "../handlers/music";
import type { Store } from "../persistence";
import ServiceResolver from "../utils/serviceResolver";
import type { EmitOptions } from "../utils/socketEmitter";
import type { YouTubeService } from "../youtubeService";
import type SocketManager from "./manager";

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
  const serviceResolver = ServiceResolver.getInstance();

  registerGetAllMusics(socket, deps.musicDB);
  if (deps.manager) registerGetRemoteStatus(socket, deps.manager.getCurrent());
  else {
    const maybeRemote = (deps as unknown as Record<string, unknown>)[
      "remoteStatus"
    ];
    if (maybeRemote && typeof maybeRemote === "object")
      registerGetRemoteStatus(
        socket,
        maybeRemote as unknown as import("~/stores/musicStore").RemoteStatus,
      );
  }
  const musicHandlers = createMusicHandlers({
    musicDB: deps.musicDB,
    io: deps.io,
    youtubeService:
      deps.youtubeService ??
      serviceResolver.resolve<YouTubeService>("youtubeService"),
    fileStore: deps.fileStore ?? serviceResolver.resolve<Store>("fileStore"),
    isAdmin: deps.isAdmin,
  });
  musicHandlers.register(socket, {
    socketId: ctx.socketId,
    requestId: ctx.requestId,
  });
}

export default {};
