import util from "node:util";
import type { ReplyOptions } from "../socket/types";

export interface ErrorInfo {
  message: string;
  stack?: string;
  code?: string;
}

export function extractErrorInfo(error: unknown): ErrorInfo {
  if (error instanceof Error) {
    let code: string | undefined = undefined;
    try {
      const errRec = error as unknown as Record<string, unknown>;
      if (typeof errRec.code === "string") code = errRec.code;
    } catch {
      code = undefined;
    }
    return {
      message: error.message,
      stack: error.stack,
      code,
    };
  }

  if (typeof error === "string") return { message: error };

  if (error && typeof error === "object") {
    const obj = error as Record<string, unknown>;
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
    };
  }

  return {
    message:
      typeof error === "string" ? error : util.inspect(error, { depth: 2 }),
  };
}

export function createErrorReply(message: string, code?: string): ReplyOptions {
  return {
    formErrors: [message],
    ...(code && { code }),
  };
}

export function createValidationErrorReply(
  fieldErrors: Record<string, string[]>,
): ReplyOptions {
  const all: string[] = [];
  for (const v of Object.values(fieldErrors))
    if (Array.isArray(v)) all.push(...v);
  return { fieldErrors, ...(all.length ? { formErrors: all } : {}) };
}

export function createServerErrorReply(error: unknown): ReplyOptions {
  void extractErrorInfo(error);
  return createErrorReply("内部サーバーエラーが発生しました", "INTERNAL_ERROR");
}

export function isAuthorizationError(error: unknown): boolean {
  const errorInfo = extractErrorInfo(error);
  const msg = errorInfo.message || "";
  return (
    errorInfo.code === "UNAUTHORIZED" ||
    msg.includes("権限") ||
    msg.includes("authorization") ||
    msg.includes("permission")
  );
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
      return "";
    }
  }
}
