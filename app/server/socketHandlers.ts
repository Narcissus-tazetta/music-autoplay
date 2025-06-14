import type { Server, Socket } from "socket.io";
import type { C2S, S2C } from "~/socket";
import { registerConnectionHandlers } from "./handlers/connectionHandlers";
import { registerMusicHandlers } from "./handlers/musicHandlers";
import { registerYouTubeHandlers } from "./handlers/youtubeHandlers";
import { registerVideoControlHandlers } from "./handlers/videoControlHandlers";

export function registerSocketHandlers(io: Server<C2S, S2C>, socket: Socket<C2S, S2C>, clients: Map<any, any>) {
    // 各ハンドラーを登録
    registerConnectionHandlers(io, socket, clients);
    registerMusicHandlers(io, socket);
    registerYouTubeHandlers(io, socket);
    registerVideoControlHandlers(io, socket);
}
