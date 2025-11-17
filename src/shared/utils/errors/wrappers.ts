import type { ErrorInfo, NormalizedWrapOptions, WrapOptions } from "./core";
import { extractErrorInfo, normalizeWrapOptions } from "./core";
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
export const defaultLogger: Logger = {
  debug: (msg, meta) => {
    console.debug(msg, meta);
  },
  info: (msg, meta) => {
    console.info(msg, meta);
  },
  warn: (msg, meta) => {
    console.warn(msg, meta);
  },
  error: (msg, meta) => {
    console.error(msg, meta);
  },
};

let globalLogger: Logger = defaultLogger;

export function setErrorLogger(logger: Logger): void {
  globalLogger = logger;
}

export function getErrorLogger(): Logger {
  return globalLogger;
}

function logError(
  opts: NormalizedWrapOptions,
  error: unknown,
  additionalContext?: Record<string, unknown>,
): void {
  if (opts.silent) return;

  const logger = globalLogger;
  const logFn = logger[opts.logLevel];
  const message = opts.operation
    ? `Error in ${opts.operation}`
    : "Unhandled error";

  const errorInfo = extractErrorInfo(error);
  const logMeta: Record<string, unknown> = {
    error: sanitizeErrorForLog(errorInfo),
    ...(opts.context && { context: opts.context }),
    ...additionalContext,
  };

  logFn.call(logger, message, logMeta);
}

function sanitizeErrorForLog(errorInfo: ErrorInfo): ErrorInfo {
  const sanitized: ErrorInfo = {
    message: errorInfo.message,
    code: errorInfo.code,
  };
  if (errorInfo.stack && errorInfo.stack.length < 2000)
    sanitized.stack = errorInfo.stack;
  if (errorInfo.meta) {
    try {
      const metaStr = JSON.stringify(errorInfo.meta);
      if (metaStr.length < 1000) sanitized.meta = errorInfo.meta;
    } catch {
      // JSON.stringify failed, skip meta serialization
    }
  }

  return sanitized;
}

export function wrap<T extends unknown[], R>(
  fn: (...args: T) => R,
  contextOrOpts?: string | WrapOptions,
): (...args: T) => R | undefined {
  const opts = normalizeWrapOptions(contextOrOpts);

  return (...args: T): R | undefined => {
    try {
      return fn(...args);
    } catch (error: unknown) {
      logError(opts, error);

      if (opts.returnOnError === "throw") throw error;

      return undefined;
    }
  };
}

export const withErrorHandler = wrap;

export function wrapAsync<T extends unknown[], R>(
  fn: (...args: T) => Promise<R> | R,
  contextOrOpts?: string | WrapOptions,
): (...args: T) => Promise<R | undefined> {
  const opts = normalizeWrapOptions(contextOrOpts);

  return async (...args: T): Promise<R | undefined> => {
    try {
      const result = await Promise.resolve(fn(...args));
      return result;
    } catch (error: unknown) {
      logError(opts, error);

      if (opts.returnOnError === "throw") throw error;

      return undefined;
    }
  };
}

export const withAsyncErrorHandler = wrapAsync;

export function handleAsyncError(
  operation: string,
  context?: Record<string, unknown>,
): (error: unknown) => void {
  return (error: unknown) => {
    const errorInfo = extractErrorInfo(error);
    const logger = globalLogger;

    logger.warn(`${operation} failed`, {
      error: sanitizeErrorForLog(errorInfo),
      ...context,
    });
  };
}

export function trySync<T>(fn: () => T): [T, null] | [null, unknown] {
  try {
    const result = fn();
    return [result, null];
  } catch (error: unknown) {
    return [null, error];
  }
}

export async function tryAsync<T>(
  fn: () => Promise<T>,
): Promise<[T, null] | [null, unknown]> {
  try {
    const result = await fn();
    return [result, null];
  } catch (error: unknown) {
    return [null, error];
  }
}
