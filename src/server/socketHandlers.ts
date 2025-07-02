import type { Server, Socket } from "socket.io";
import type { C2S, S2C } from "../shared/types/socket";
import { registerConnectionHandlers } from "./api/connectionHandlers";
import { registerMusicHandlers } from "./api/musicHandlers";
import { registerYouTubeHandlers } from "./api/youtubeHandlers";
import { registerVideoControlHandlers } from "./api/videoControlHandlers";
import type { ClientsMap } from "./types";

export function registerSocketHandlers(
  io: Server<C2S, S2C>,
  socket: Socket<C2S, S2C>,
  clients: ClientsMap
) {
  registerConnectionHandlers(io, socket, clients);
  registerMusicHandlers(io, socket);
  registerYouTubeHandlers(io, socket);
  registerVideoControlHandlers(io, socket);
}
