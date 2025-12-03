import { safeString } from '@/shared/utils/errors';
import type { Server as IOServer, Socket } from 'socket.io';
import logger from '../logger';
import type { EventMap, EventName } from '../types/socketEvents';

export interface EmitContext {
    operation?: string;
    identifiers?: Record<string, unknown>;
    source?: string;
}

function serializeError(error: unknown) {
    if (error instanceof Error) {
        return {
            message: error.message,
            name: error.name,
            stack: error.stack,
        };
    }
    if (typeof error === 'string') return { message: error };
    return { type: typeof error, value: String(error) };
}

export interface SafeEmitOptions {
    context?: EmitContext;
    errorPrefix?: string;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
    silent?: boolean;
}

export function safeEmit<K extends EventName>(
    emitter: IOServer | Socket,
    event: K,
    ...args: EventMap[K] extends readonly [infer P, ...infer Rest]
        ? Rest extends readonly [] ? [payload: P, options?: SafeEmitOptions]
        : [payload: P, ...rest: Rest, options?: SafeEmitOptions]
        : [options?: SafeEmitOptions]
): boolean {
    const lastArg = args[args.length - 1];
    const isOptions = lastArg
        && typeof lastArg === 'object'
        && ('context' in lastArg
            || 'errorPrefix' in lastArg
            || 'logLevel' in lastArg
            || 'silent' in lastArg);

    const options: SafeEmitOptions = isOptions
        ? (lastArg as SafeEmitOptions)
        : {};
    const emitArgs = isOptions ? args.slice(0, -1) : args;

    const {
        context = {},
        errorPrefix = 'failed to emit',
        logLevel = 'warn',
        silent = false,
    } = options;

    try {
        if ('emit' in emitter && typeof emitter.emit === 'function') {
            emitter.emit(event, ...emitArgs);
            return true;
        } else {
            if (!silent) {
                logger[logLevel](`${errorPrefix}: invalid emitter`, {
                    context,
                    emitterType: typeof emitter,
                    event,
                });
            }
            return false;
        }
    } catch (error: unknown) {
        if (!silent) {
            logger[logLevel](`${errorPrefix} ${event}`, {
                error: serializeError(error),
                event,
                context,
                payload: emitArgs.length > 0 ? safeString(emitArgs[0]) : undefined,
                ...context.identifiers,
            });
        }
        return false;
    }
}

export function safeEmitSync<K extends EventName>(
    emitter: IOServer | Socket,
    event: K,
    ...args: EventMap[K] extends readonly [infer P, ...infer Rest]
        ? Rest extends readonly [] ? [payload: P, options?: SafeEmitOptions]
        : [payload: P, ...rest: Rest, options?: SafeEmitOptions]
        : [options?: SafeEmitOptions]
): boolean {
    const lastArg = args[args.length - 1];
    const isOptions = lastArg
        && typeof lastArg === 'object'
        && ('context' in lastArg
            || 'errorPrefix' in lastArg
            || 'logLevel' in lastArg
            || 'silent' in lastArg);

    const options: SafeEmitOptions = isOptions
        ? (lastArg as SafeEmitOptions)
        : {};
    const emitArgs = isOptions ? args.slice(0, -1) : args;

    const {
        context = {},
        errorPrefix = 'failed to emit',
        logLevel = 'warn',
        silent = false,
    } = options;

    try {
        if ('emit' in emitter && typeof emitter.emit === 'function') {
            // cast emitter.emit to accept unknown args to avoid unsafe-argument errors
            (emitter.emit as (...a: unknown[]) => void)(
                event,
                ...(emitArgs as unknown as unknown[]),
            );
            return true;
        } else {
            if (!silent) {
                logger[logLevel](`${errorPrefix}: invalid emitter`, {
                    context,
                    emitterType: typeof emitter,
                    event,
                });
            }
            return false;
        }
    } catch (error: unknown) {
        if (!silent) {
            logger[logLevel](`${errorPrefix} ${event}`, {
                error: serializeError(error),
                event,
                context,
                payload: emitArgs.length > 0 ? safeString(emitArgs[0]) : undefined,
                ...context.identifiers,
            });
        }
        return false;
    }
}

export function createSafeEmitter(
    emitter: IOServer | Socket,
    defaultContext: EmitContext,
) {
    return function<K extends EventName>(
        event: K,
        ...args: EventMap[K] extends readonly [infer P, ...infer Rest]
            ? Rest extends readonly [] ? [payload: P, options?: SafeEmitOptions]
            : [payload: P, ...rest: Rest, options?: SafeEmitOptions]
            : [options?: SafeEmitOptions]
    ): boolean {
        const lastArg = args[args.length - 1];
        const isOptions = lastArg
            && typeof lastArg === 'object'
            && ('context' in lastArg
                || 'errorPrefix' in lastArg
                || 'logLevel' in lastArg
                || 'silent' in lastArg);

        const userOptions: SafeEmitOptions = isOptions
            ? (lastArg as SafeEmitOptions)
            : {};
        const emitArgs = isOptions ? args.slice(0, -1) : args;

        const mergedOptions: SafeEmitOptions = {
            ...userOptions,
            context: {
                ...defaultContext,
                ...userOptions.context,
                identifiers: {
                    ...defaultContext.identifiers,
                    ...userOptions.context?.identifiers,
                },
            },
        };

        try {
            if ('emit' in emitter && typeof emitter.emit === 'function') {
                (emitter.emit as (...a: unknown[]) => void)(
                    event,
                    ...(emitArgs as unknown as unknown[]),
                    mergedOptions,
                );
                return true;
            }
            if (!mergedOptions.silent) {
                logger[mergedOptions.logLevel ?? 'warn'](
                    'failed to emit: invalid emitter',
                    {
                        context: mergedOptions.context,
                        emitterType: typeof emitter,
                        event,
                    },
                );
            }
            return false;
        } catch (error: unknown) {
            if (!mergedOptions.silent) {
                logger[mergedOptions.logLevel ?? 'warn'](`failed to emit ${event}`, {
                    error: serializeError(error),
                    event,
                    context: mergedOptions.context,
                    payload: emitArgs.length > 0 ? safeString(emitArgs[0]) : undefined,
                    ...mergedOptions.context?.identifiers,
                });
            }
            return false;
        }
    };
}

export function createSafeEmitterSync(
    emitter: IOServer | Socket,
    defaultContext: EmitContext,
) {
    return function<K extends EventName>(
        event: K,
        ...args: EventMap[K] extends readonly [infer P, ...infer Rest]
            ? Rest extends readonly [] ? [payload: P, options?: SafeEmitOptions]
            : [payload: P, ...rest: Rest, options?: SafeEmitOptions]
            : [options?: SafeEmitOptions]
    ): boolean {
        const lastArg = args[args.length - 1];
        const isOptions = lastArg
            && typeof lastArg === 'object'
            && ('context' in lastArg
                || 'errorPrefix' in lastArg
                || 'logLevel' in lastArg
                || 'silent' in lastArg);

        const userOptions: SafeEmitOptions = isOptions
            ? (lastArg as SafeEmitOptions)
            : {};
        const emitArgs = isOptions ? args.slice(0, -1) : args;

        const mergedOptions: SafeEmitOptions = {
            ...userOptions,
            context: {
                ...defaultContext,
                ...userOptions.context,
                identifiers: {
                    ...defaultContext.identifiers,
                    ...userOptions.context?.identifiers,
                },
            },
        };

        try {
            if ('emit' in emitter && typeof emitter.emit === 'function') {
                (emitter.emit as (...a: unknown[]) => void)(
                    event,
                    ...(emitArgs as unknown as unknown[]),
                    mergedOptions,
                );
                return true;
            }
            if (!mergedOptions.silent) {
                logger[mergedOptions.logLevel ?? 'warn'](
                    'failed to emit: invalid emitter',
                    {
                        context: mergedOptions.context,
                        emitterType: typeof emitter,
                        event,
                    },
                );
            }
            return false;
        } catch (error: unknown) {
            if (!mergedOptions.silent) {
                logger[mergedOptions.logLevel ?? 'warn'](`failed to emit ${event}`, {
                    error: serializeError(error),
                    event,
                    context: mergedOptions.context,
                    payload: emitArgs.length > 0 ? safeString(emitArgs[0]) : undefined,
                    ...mergedOptions.context?.identifiers,
                });
            }
            return false;
        }
    };
}

export function wrapEmitWithSafety(
    emitFn: (event: string, payload: unknown) => void,
    defaultOptions: SafeEmitOptions = {},
): (event: string, payload: unknown, options?: SafeEmitOptions) => boolean {
    return (
        event: string,
        payload: unknown,
        options: SafeEmitOptions = {},
    ): boolean => {
        const mergedOptions: SafeEmitOptions = {
            ...defaultOptions,
            ...options,
            context: {
                ...defaultOptions.context,
                ...options.context,
                identifiers: {
                    ...defaultOptions.context?.identifiers,
                    ...options.context?.identifiers,
                },
            },
        };

        const {
            context = {},
            errorPrefix = 'failed to emit',
            logLevel = 'warn',
            silent = false,
        } = mergedOptions;

        try {
            emitFn(event, payload);
            return true;
        } catch (error: unknown) {
            if (!silent) {
                logger[logLevel](`${errorPrefix} ${event}`, {
                    error: serializeError(error),
                    event,
                    payload: safeString(payload),
                    context,
                    ...context.identifiers,
                });
            }
            return false;
        }
    };
}

export interface EmitOptions {
    context?: {
        source?: string;
        operation?: string;
        identifiers?: Record<string, unknown>;
    };
    errorPrefix?: string;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
    silent?: boolean;
}

export type LegacyEmitFn =
    & ((
        ev: string,
        payload: unknown,
    ) => boolean | undefined)
    & { __isSocketEmitter?: true };

export class SocketEmitter {
    private ioGetter: () => IOServer;
    private defaultContext: EmitOptions['context'] | undefined;

    constructor(
        ioGetter: () => IOServer,
        defaultContext?: EmitOptions['context'],
    ) {
        this.ioGetter = ioGetter;
        this.defaultContext = defaultContext;
    }

    emit(event: string, payload: unknown, opts: EmitOptions = {}): boolean {
        const {
            context = {},
            errorPrefix = 'failed to emit',
            logLevel = 'warn',
            silent = false,
        } = opts;
        const mergedContext = { ...this.defaultContext, ...context };

        try {
            const io = this.ioGetter();
            if (typeof io.emit !== 'function') {
                if (!silent) {
                    logger[logLevel](`${errorPrefix}: invalid emitter`, {
                        context: mergedContext,
                        event,
                    });
                }
                return false;
            }
            io.emit(event, payload);
            return true;
        } catch (error) {
            if (!silent) {
                logger[logLevel](`${errorPrefix} ${event}`, {
                    error: error,
                    event,
                    payload: safeString(payload),
                    context: mergedContext,
                    ...mergedContext.identifiers,
                });
            }
            return false;
        }
    }

    asFn(): LegacyEmitFn {
        const fn = ((ev: string, payload: unknown) => {
            this.emit(ev, payload);
            return undefined;
        }) as LegacyEmitFn;
        fn.__isSocketEmitter = true;
        return fn;
    }
}

export function createSocketEmitter(
    ioGetter: () => IOServer,
    defaultContext?: EmitOptions['context'],
) {
    return new SocketEmitter(ioGetter, defaultContext);
}
