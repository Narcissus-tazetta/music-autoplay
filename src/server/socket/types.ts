import type { Socket } from "socket.io";

export type ReplyOptions = { formErrors?: string[] } | Record<string, unknown>;

export type EngineLike = { on?: unknown; httpServer?: unknown } & Record<
  string,
  unknown
>;

export type RequestLike = {
  url?: string;
  headers?: Record<string, unknown>;
  method?: string;
};

export type HeaderSnapshot = Record<string, string | undefined> | undefined;

export type SocketLike = Omit<Socket, "request"> & {
  request?: RequestLike;
};
