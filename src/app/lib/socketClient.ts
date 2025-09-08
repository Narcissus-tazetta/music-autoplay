import { io, type Socket } from "socket.io-client";
import type { C2S, S2C } from "@/shared/types/socket";

let socket: Socket<S2C, C2S> | null = null;

export function getSocket(): Socket<S2C, C2S> {
  if (!socket) {
    socket = io({ autoConnect: false }) as Socket<S2C, C2S>;
  }
  return socket;
}
