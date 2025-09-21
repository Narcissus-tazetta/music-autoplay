import type { Socket } from "socket.io";
import registerGetAllMusics from "../handlers/getAllMusics";
import registerGetRemoteStatus from "../handlers/getRemoteStatus";
import createMusicHandlers from "../handlers/music";
import type { Music } from "~/stores/musicStore";
import type { Store } from "../musicPersistence";
import type { Server as IOServer } from "socket.io";
import type { YouTubeService } from "../youtubeService";
import type SocketManager from "./manager";

export type HandlerDeps = {
    musicDB: Map<string, Music>;
    io: IOServer;
    youtubeService: unknown;
    manager?: SocketManager;
    fileStore: Store;
    isAdmin: (h?: string) => boolean;
};

export function registerSocketHandlers(
    socket: Socket,
    ctx: { socketId: string; connectionId: string; requestId?: string },
    deps: HandlerDeps
) {
    registerGetAllMusics(socket, deps.musicDB);
    if (deps.manager) {
        registerGetRemoteStatus(socket, deps.manager.getCurrent());
    } else {
        // @ts-expect-error: backward compatibility fallback
        registerGetRemoteStatus(socket, (deps as unknown as { remoteStatus: unknown }).remoteStatus);
    }
    const musicHandlers = createMusicHandlers({
        musicDB: deps.musicDB,
        io: deps.io,
        youtubeService: deps.youtubeService as YouTubeService,
        fileStore: deps.fileStore,
        isAdmin: deps.isAdmin,
    });
    musicHandlers.register(socket, {
        socketId: ctx.socketId,
        requestId: ctx.requestId,
    });
}

export default {};
