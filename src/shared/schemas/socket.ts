import { z } from "zod";

export const SocketHandshakeSchema = z
  .object({
    headers: z
      .object({
        origin: z.string().optional(),
        referer: z.string().optional(),
        cookie: z.string().optional(),
        "user-agent": z.string().optional(),
      })
      .passthrough(),
    auth: z.record(z.unknown()).optional(),
    query: z.record(z.string()).optional(),
  })
  .passthrough();

export const SocketLikeSchema = z
  .object({
    id: z.string(),
    handshake: SocketHandshakeSchema.optional(),
    connected: z.boolean().optional(),
    on: z.function().optional(),
    emit: z.function().optional(),
    disconnect: z.function().optional(),
  })
  .passthrough();

export const SocketWithReconnectSchema = SocketLikeSchema.extend({
  on: z.function().optional(),
});

export function isSocketLike(
  value: unknown,
): value is z.infer<typeof SocketLikeSchema> {
  return SocketLikeSchema.safeParse(value).success;
}

export function hasSocketHandshake(
  socket: unknown,
): socket is { handshake: z.infer<typeof SocketHandshakeSchema> } {
  if (!isSocketLike(socket)) return false;
  return socket.handshake !== undefined;
}

export type SocketLike = z.infer<typeof SocketLikeSchema>;
export type SocketHandshake = z.infer<typeof SocketHandshakeSchema>;
