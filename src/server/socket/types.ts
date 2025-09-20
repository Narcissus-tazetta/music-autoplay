export type ReplyOptions = { formErrors?: string[] } | Record<string, unknown>;
export type EngineLike = { on?: unknown; httpServer?: unknown } & Record<
  string,
  unknown
>;
export type RequestLike = Record<string, unknown> & {
  url?: unknown;
  headers?: Record<string, unknown>;
  method?: unknown;
};
export type HeaderSnapshot = Record<string, string | undefined> | undefined;
export type SocketLike =
  | { handshake?: unknown; conn?: unknown }
  | Record<string, unknown>;

export default {};
