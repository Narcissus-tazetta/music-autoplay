import type { HandlerError } from './core';
import { toHandlerError } from './core';
import { getErrorLogger } from './wrappers';

export interface Ok<T> {
    ok: true;
    value: T;
}
export interface Err<E> {
    ok: false;
    error: E;
}
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ error, ok: false });

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
            context ? `safeExecute failed: ${context}` : 'safeExecute caught error',
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
                : 'safeExecuteAsync caught error',
            {
                error: handlerError,
            },
        );

        return err(handlerError);
    }
}

export function mapResult<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => U,
): Result<U, E> {
    if (result.ok) return ok(fn(result.value));
    return result;
}

export function chainResult<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => Result<U, E>,
): Result<U, E> {
    if (result.ok) return fn(result.value);
    return result;
}

export function combineResults<T, E>(results: Result<T, E>[]): Result<T[], E> {
    const values: T[] = [];

    for (const result of results) {
        if (!result.ok) return result;
        values.push(result.value);
    }

    return ok(values);
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
