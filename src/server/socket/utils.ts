import { safeLog } from "@/server/logger";
import { getStructuredClone, isObject } from "@/shared/utils/typeGuards";
import type { HeaderSnapshot, RequestLike, SocketLike } from "./types";

export function deepCloneForLog(v: unknown): unknown {
  try {
    const sc = getStructuredClone();
    if (typeof sc === "function") return sc(v);
    return JSON.parse(JSON.stringify(v));
  } catch {
    return Object.prototype.toString.call(v);
  }
}

export function snapshotHeaders(socket: SocketLike): HeaderSnapshot {
  try {
    if (!isObject(socket)) return undefined;

    const socketObj = socket as { handshake?: unknown; conn?: unknown };
    const hs = socketObj.handshake;

    if (isObject(hs)) {
      const handshake = hs as { headers?: unknown };
      const headers = handshake.headers;
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

    const conn = socketObj.conn;
    if (isObject(conn)) {
      const connObj = conn as { request?: unknown };
      const maybeReq = connObj.request;
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
  } catch (err: unknown) {
    safeLog("debug", "snapshotHeaders failed", { error: err });
    return undefined;
  }
}

export function sanitizeArgs(args: unknown[]): unknown[] {
  return args.map((a) => {
    if (a == null) return a;
    if (
      typeof a === "string" ||
      typeof a === "number" ||
      typeof a === "boolean"
    ) {
      return a;
    }
    if (Array.isArray(a)) {
      return a.map<unknown>((v: unknown) => {
        if (typeof v === "object" && v !== null) return deepCloneForLog(v);
        return v;
      });
    }
    if (typeof a === "object") return deepCloneForLog(a);
    return a;
  });
}
