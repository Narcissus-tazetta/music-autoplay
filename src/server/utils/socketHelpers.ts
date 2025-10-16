import { safeLog } from "@/server/logger";
import { isThenable } from "@/shared/utils/typeGuards";
import type { Socket } from "socket.io";
import type { EventMap, EventName } from "../types/socketEvents";

export function registerHandler<K extends EventName>(
  socket: Socket,
  eventName: K,
  handler: (...args: EventMap[K]) => unknown,
): boolean;

export function registerHandler(
  socket: Socket,
  eventName: string,
  handler: (...args: unknown[]) => unknown,
): boolean;

export function registerHandler(
  socket: Socket,
  eventName: string,
  handler: (...args: unknown[]) => unknown,
) {
  const metaKey = "__registeredHandlers" as const;
  const sockRec = socket as unknown as Record<string, unknown>;

  let meta = sockRec[metaKey] as Set<string> | undefined;
  if (meta && meta.has(eventName)) return false;
  if (!meta) {
    meta = new Set<string>();
    sockRec[metaKey] = meta;
  }

  const onFn =
    typeof sockRec.on === "function"
      ? (sockRec.on as (...a: unknown[]) => void).bind(socket)
      : undefined;

  if (typeof onFn === "function") {
    onFn.call(socket, eventName, (...args: unknown[]) => {
      try {
        const r = handler(...args);
        if (isThenable(r)) {
          r.catch((err: unknown) => {
            safeLog("warn", "socket handler rejected", {
              eventName,
              error: err,
            } as Record<string, unknown>);
          });
        }
      } catch (err: unknown) {
        safeLog("warn", "socket handler threw", {
          eventName,
          error: err,
        } as Record<string, unknown>);
      }
    });
  } else {
    sockRec[`__on_${eventName}`] = (...args: unknown[]) => {
      try {
        handler(...args);
      } catch (e: unknown) {
        safeLog("warn", "socketHelpers safe call failed", {
          error: e,
        } as Record<string, unknown>);
      }
    };
  }
  meta.add(eventName);
  return true;
}

export function registerTypedHandler<K extends EventName>(
  socket: Socket,
  eventName: K,
  handler: (...args: EventMap[K]) => unknown,
): boolean {
  return registerHandler(
    socket,
    eventName as string,
    handler as (...args: unknown[]) => unknown,
  );
}
