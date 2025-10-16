import { withErrorHandler } from "@/shared/utils/errorUtils";
import type { Socket } from "socket.io";
import type { AppLogger } from "../../logger";
import { sanitizeArgs, snapshotHeaders } from "../utils";

export function setupSocketLogging(
  socket: Socket,
  log: AppLogger,
  transport: string,
) {
  withErrorHandler(() => {
    socket.onAny((event: string, ...args: unknown[]) => {
      withErrorHandler(() => {
        const safeArgs = sanitizeArgs(args);
        const headers = snapshotHeaders(socket);
        const origin = headers?.origin ?? headers?.referer;
        log.info("socket event received", {
          event,
          args: safeArgs,
          socketId: socket.id,
          origin,
          transport,
        });
      }, "socket event logging")();
    });
  }, "socket onAny setup")();
}
