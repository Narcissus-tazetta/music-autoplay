import { safeLog } from "@/server/logger";
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

  function getSocketRecord(s: Socket): Record<string, unknown> {
    return s as unknown as Record<string, unknown>;
  }
  const sockRec = getSocketRecord(socket);

  let meta = sockRec[metaKey] as Set<string> | undefined;
  if (meta && meta.has(eventName)) return false;
  if (!meta) {
    meta = new Set<string>();
    sockRec[metaKey] = meta;
  }

  const rawRec = sockRec;
  const rawOnCandidate = rawRec.on ?? rawRec.on;
  const rawOn =
    typeof rawOnCandidate === "function"
      ? (rawOnCandidate as (...a: unknown[]) => void)
      : undefined;
  const onFn = rawOn ? rawOn.bind(socket) : undefined;

  const isThenable = (v: unknown): v is Promise<unknown> => {
    return (
      typeof v === "object" &&
      v !== null &&
      typeof (v as Record<string, unknown>).then === "function"
    );
  };

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

export class TimerManager {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  start(
    key: string,
    ms: number,
    cb: () => void,
  ): ReturnType<typeof setTimeout> {
    this.clear(key);
    const id = setTimeout(() => {
      this.timers.delete(key);
      try {
        cb();
      } catch (e: unknown) {
        safeLog("warn", "timer callback threw", { key, error: e } as Record<
          string,
          unknown
        >);
      }
    }, ms);
    this.timers.set(key, id);
    return id;
  }

  clear(key: string) {
    const id = this.timers.get(key);
    if (id !== undefined) {
      clearTimeout(id);
      this.timers.delete(key);
    }
  }

  clearAll() {
    for (const id of this.timers.values()) clearTimeout(id);
    this.timers.clear();
  }
}
