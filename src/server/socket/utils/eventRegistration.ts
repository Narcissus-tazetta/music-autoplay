import type { AppLogger } from "../../logger";

type EventHandler = (data: unknown) => void | Promise<void>;

export function registerSocketEventSafely(
  socketOn: ((...args: unknown[]) => void) | undefined,
  eventName: string,
  handler: EventHandler,
  log: AppLogger,
  context: { socketId: string },
): void {
  if (typeof socketOn !== "function") return;

  try {
    socketOn(eventName, (data: unknown) => {
      try {
        const result = handler(data);
        if (result && typeof result.catch === "function") {
          result.catch((err: unknown) => {
            log.warn(`failed to process ${eventName}`, {
              error: err,
              socketId: context.socketId,
            });
          });
        }
      } catch (err: unknown) {
        log.warn(`failed to process ${eventName}`, {
          error: err,
          socketId: context.socketId,
        });
      }
    });
  } catch (err: unknown) {
    log.debug(`failed to register ${eventName}`, {
      error: err,
      socketId: context.socketId,
    });
  }
}
