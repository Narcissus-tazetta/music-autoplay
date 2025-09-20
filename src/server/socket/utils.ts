import type { HeaderSnapshot, RequestLike, SocketLike } from "./types";

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function getStructuredClone(): ((x: unknown) => unknown) | undefined {
  const g = globalThis as unknown as Record<string, unknown>;
  if ("structuredClone" in g) {
    const sc = g["structuredClone"];
    if (typeof sc === "function") {
      return sc as (x: unknown) => unknown;
    }
  }
  return undefined;
}

export function deepCloneForLog(v: unknown): unknown {
  try {
    const sc = getStructuredClone();
    if (typeof sc === "function") return sc(v);
    const parsed: unknown = JSON.parse(JSON.stringify(v));
    return parsed;
  } catch {
    return Object.prototype.toString.call(v);
  }
}

export function snapshotHeaders(socket: SocketLike): HeaderSnapshot {
  try {
    if (!isObject(socket)) return undefined;
    const hs = (socket as { handshake?: unknown }).handshake;
    if (isObject(hs)) {
      const headers = (hs as { headers?: unknown }).headers;
      if (isObject(headers)) {
        const h = headers;
        const out: Record<string, string | undefined> = {};
        if (typeof h.origin === "string") out.origin = h.origin;
        if (typeof h.referer === "string") out.referer = h.referer;
        if (typeof h.cookie === "string") out.cookie = "[REDACTED]";
        if (typeof h["user-agent"] === "string")
          out["user-agent"] = h["user-agent"];
        return out;
      }
    }

    const conn = (socket as { conn?: unknown }).conn;
    if (isObject(conn)) {
      const maybeReq = (conn as { request?: unknown }).request;
      if (isObject(maybeReq)) {
        const r = maybeReq as RequestLike;
        if (isObject(r.headers)) {
          const h = r.headers;
          const out: Record<string, string | undefined> = {};
          if (typeof h.origin === "string") out.origin = h.origin;
          if (typeof h.referer === "string") out.referer = h.referer;
          if (typeof h.cookie === "string") out.cookie = "[REDACTED]";
          if (typeof h["user-agent"] === "string")
            out["user-agent"] = h["user-agent"];
          return out;
        }
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function sanitizeArgs(args: unknown[]): unknown[] {
  return args.map<unknown>((a: unknown) => {
    if (a === null || a === undefined) return a;
    if (
      typeof a === "string" ||
      typeof a === "number" ||
      typeof a === "boolean"
    )
      return a;
    if (Array.isArray(a)) {
      return a.map<unknown>((v: unknown) => {
        if (typeof v === "object" && v !== null) return deepCloneForLog(v);
        return v;
      });
    }
    if (isObject(a)) return deepCloneForLog(a);
    return Object.prototype.toString.call(a);
  });
}

export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  constructor(
    private maxAttempts: number,
    private windowMs: number,
  ) {}

  tryConsume(key: string): boolean {
    const now = Date.now();
    const arr = this.attempts.get(key) ?? [];
    const recent = arr.filter((t) => now - t < this.windowMs);
    recent.push(now);
    this.attempts.set(key, recent);
    return recent.length <= this.maxAttempts;
  }

  clear(key: string) {
    this.attempts.delete(key);
  }
}

export function withSafeHandler<T extends (...a: unknown[]) => unknown>(
  name: string,
  fn: T,
) {
  return (...args: Parameters<T>): ReturnType<T> | Promise<ReturnType<T>> => {
    const res = fn(...(args as unknown[]));
    if (res && typeof (res as { then?: unknown }).then === "function") {
      return (res as Promise<ReturnType<T>>).catch((err: unknown) => {
        // logger imported by callers where needed
        throw err;
      });
    }
    return res as ReturnType<T>;
  };
}

export default {};
