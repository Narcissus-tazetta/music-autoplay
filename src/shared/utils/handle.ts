import logger from "@/server/logger";
import type { Result } from "./result";
import { err, ok } from "./result";

export type HandlerError = {
  message: string;
  code?: string;
  meta?: unknown;
};

export function toHandlerError(e: unknown): HandlerError {
  if (e instanceof Error)
    return { message: e.message, meta: { stack: e.stack } };
  if (typeof e === "string") return { message: e };
  return { message: "unknown error", meta: e };
}

export function safeExecute<T>(fn: () => T): Result<T, HandlerError> {
  try {
    const v = fn();
    return ok(v);
  } catch (e: unknown) {
    const he = toHandlerError(e);
    logger.warn("safeExecute caught", { error: he });
    return err(he);
  }
}

export async function safeExecuteAsync<T>(
  fn: () => Promise<T>,
): Promise<Result<T, HandlerError>> {
  try {
    const v = await fn();
    return ok(v);
  } catch (e: unknown) {
    const he = toHandlerError(e);
    logger.warn("safeExecuteAsync caught", { error: he });
    return err(he);
  }
}

export function resultToThrow<T>(r: Result<T, HandlerError>): T {
  if (r.ok) return r.value;
  const e = r.error;
  const errObj = new Error(e.message);
  const errWithMeta = errObj as Error & { meta?: unknown };
  errWithMeta.meta = e.meta;
  throw errWithMeta;
}

export default {};
