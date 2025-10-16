import util from "node:util";
import { isRecord } from "../typeGuards";

export interface ErrorInfo {
  message: string;
  stack?: string;
  code?: string;
  meta?: Record<string, unknown>;
}
export interface HandlerError extends Record<string, unknown> {
  message: string;
  code?: string;
  meta?: unknown;
}

export interface WrapOptions {
  context?: string;
  operation?: string;
  logLevel?: "debug" | "info" | "warn" | "error";
  silent?: boolean;
  returnOnError?: "undefined" | "throw";
}

export type NormalizedWrapOptions = Required<WrapOptions>;

export function isError(v: unknown): v is Error {
  return v instanceof Error;
}

export function isStackTrace(str: string): boolean {
  return /^\s*at\s+/m.test(str) || /^\s*\w+Error:/m.test(str);
}

export function extractErrorInfo(error: unknown): ErrorInfo {
  if (isError(error)) {
    let code: string | undefined = undefined;
    try {
      const errRec = error as Error & { code?: string };
      if (typeof errRec.code === "string") code = errRec.code;
    } catch {
      void 0;
    }

    return {
      message: error.message || "unknown error",
      stack: error.stack,
      code,
    };
  }

  if (typeof error === "string") return { message: error };

  if (isRecord(error)) {
    const obj = error;
    let msg: string;

    if (typeof obj.message === "string") msg = obj.message;
    else {
      try {
        msg = JSON.stringify(obj);
      } catch {
        msg = util.inspect(obj, { depth: 2 });
      }
    }

    return {
      message: msg,
      stack: typeof obj.stack === "string" ? obj.stack : undefined,
      code: typeof obj.code === "string" ? obj.code : undefined,
      meta: extractErrorMeta(obj),
    };
  }

  return {
    message: util.inspect(error, { depth: 2 }),
  };
}

function extractErrorMeta(error: unknown): Record<string, unknown> | undefined {
  if (!isRecord(error)) return undefined;

  const meta: Record<string, unknown> = {};
  const skipKeys = new Set(["message", "stack", "code", "name"]);

  for (const [key, value] of Object.entries(error)) {
    if (skipKeys.has(key)) continue;
    if (value === undefined) continue;

    try {
      JSON.stringify(value);
      meta[key] = value;
    } catch {
      continue;
    }
  }

  return Object.keys(meta).length > 0 ? meta : undefined;
}
export function toHandlerError(error: unknown): HandlerError {
  const info = extractErrorInfo(error);

  return {
    message: info.message,
    code: info.code,
    meta: {
      stack: info.stack,
      ...info.meta,
    },
  };
}

export function safeString(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "symbol") return String(val);
  if (
    typeof val === "number" ||
    typeof val === "boolean" ||
    typeof val === "bigint"
  )
    return String(val);

  try {
    return JSON.stringify(val);
  } catch {
    try {
      return Object.prototype.toString.call(val);
    } catch {
      return "[unserializable]";
    }
  }
}

export function errorToString(error: unknown): string {
  const info = extractErrorInfo(error);
  return info.message;
}

export function normalizeWrapOptions(
  contextOrOpts?: string | WrapOptions,
): NormalizedWrapOptions {
  if (typeof contextOrOpts === "string") {
    return {
      context: contextOrOpts,
      operation: contextOrOpts,
      logLevel: "error",
      silent: false,
      returnOnError: "undefined",
    };
  }

  const opts: WrapOptions = contextOrOpts || {};
  return {
    context: opts.context || "",
    operation: opts.operation || opts.context || "",
    logLevel: opts.logLevel || "error",
    silent: opts.silent || false,
    returnOnError: opts.returnOnError || "undefined",
  };
}

export function isAuthorizationError(error: unknown): boolean {
  const info = extractErrorInfo(error);
  const msg = info.message.toLowerCase();
  const code = info.code?.toUpperCase();

  return (
    code === "UNAUTHORIZED" ||
    code === "FORBIDDEN" ||
    code === "PERMISSION_DENIED" ||
    msg.includes("権限") ||
    msg.includes("authorization") ||
    msg.includes("permission") ||
    msg.includes("forbidden") ||
    msg.includes("unauthorized")
  );
}

export function isValidationError(error: unknown): boolean {
  const info = extractErrorInfo(error);
  const code = info.code?.toUpperCase();

  return (
    code === "VALIDATION_ERROR" ||
    code === "INVALID_INPUT" ||
    code === "BAD_REQUEST"
  );
}

export function isNotFoundError(error: unknown): boolean {
  const info = extractErrorInfo(error);
  const msg = info.message.toLowerCase();
  const code = info.code?.toUpperCase();

  return (
    code === "NOT_FOUND" ||
    msg.includes("not found") ||
    msg.includes("見つかりません")
  );
}

export function isNetworkError(error: unknown): boolean {
  const info = extractErrorInfo(error);
  const code = info.code?.toUpperCase();
  const msg = info.message.toLowerCase();

  return (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ETIMEDOUT" ||
    code === "NETWORK_ERROR" ||
    msg.includes("network") ||
    msg.includes("connection")
  );
}
