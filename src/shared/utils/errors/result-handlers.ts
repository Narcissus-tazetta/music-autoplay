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
