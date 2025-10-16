import type { Result } from "../result";
import { err, ok } from "../result";
import type { HandlerError } from "./core";
import { toHandlerError } from "./core";
import { getErrorLogger } from "./wrappers";

export function safeExecute<T>(
  fn: () => T,
  context?: string,
): Result<T, HandlerError> {
  try {
    const value = fn();
    return ok(value);
  } catch (error: unknown) {
    const handlerError = toHandlerError(error);
    const logger = getErrorLogger();

    logger.warn(
      context ? `safeExecute failed: ${context}` : "safeExecute caught error",
      {
        error: handlerError,
      },
    );

    return err(handlerError);
  }
}

export async function safeExecuteAsync<T>(
  fn: () => Promise<T>,
  context?: string,
): Promise<Result<T, HandlerError>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (error: unknown) {
    const handlerError = toHandlerError(error);
    const logger = getErrorLogger();

    logger.warn(
      context
        ? `safeExecuteAsync failed: ${context}`
        : "safeExecuteAsync caught error",
      {
        error: handlerError,
      },
    );

    return err(handlerError);
  }
}

export function resultToThrow<T>(result: Result<T, HandlerError>): T {
  if (result.ok) return result.value;

  const handlerError = result.error;
  const error = new Error(handlerError.message);
  const errorWithExtras = error as Error & { code?: string; meta?: unknown };
  if (handlerError.code) errorWithExtras.code = handlerError.code;
  if (handlerError.meta) errorWithExtras.meta = handlerError.meta;

  throw errorWithExtras;
}

export function resultOr<T>(
  result: Result<T, HandlerError>,
  defaultValue: T,
): T {
  return result.ok ? result.value : defaultValue;
}
export function resultOrUndefined<T>(
  result: Result<T, HandlerError>,
): T | undefined {
  return result.ok ? result.value : undefined;
}

export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  if (result.ok) return ok(fn(result.value));
  return result;
}

export function mapError<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F,
): Result<T, F> {
  if (!result.ok) return err(fn(result.error));
  return result;
}

export function chainResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  if (result.ok) return fn(result.value);
  return result;
}

export function combineResults<T, E>(
  results: Array<Result<T, E>>,
): Result<T[], E> {
  const values: T[] = [];

  for (const result of results) {
    if (!result.ok) return result;
    values.push(result.value);
  }

  return ok(values);
}

export function collectOks<T, E>(results: Array<Result<T, E>>): T[] {
  const values: T[] = [];

  for (const result of results) if (result.ok) values.push(result.value);

  return values;
}

export function collectErrors<T, E>(results: Array<Result<T, E>>): E[] {
  const errors: E[] = [];

  for (const result of results) if (!result.ok) errors.push(result.error);

  return errors;
}

export function isOk<T, E>(
  result: Result<T, E>,
): result is { ok: true; value: T } {
  return result.ok;
}

export function isErr<T, E>(
  result: Result<T, E>,
): result is { ok: false; error: E } {
  return !result.ok;
}
