import type { RateLimiter } from "@/server/services/rateLimiter";
import type { SocketServerInstance } from "@/server/socket";

export interface ServerContext {
  io: SocketServerInstance;
  httpRateLimiter: RateLimiter;
}
