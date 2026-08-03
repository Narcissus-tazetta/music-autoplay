import { safeString } from '@/shared/utils/errors';
import type { Server as IOServer } from 'socket.io';
import logger, { serializeError } from '../logger';

export interface EmitContext {
    operation?: string;
    identifiers?: Record<string, unknown>;
    source?: string;
}

export interface EmitOptions {
    context?: EmitContext;
    errorPrefix?: string;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
    silent?: boolean;
}

/**
 * Wraps `io.emit` so a throwing emitter degrades to a logged warning instead of
 * unwinding the caller. Socket.IO emits are fire-and-forget for us: no caller can
 * do anything useful with the failure beyond recording it.
 */
export class SocketEmitter {
    constructor(
        private readonly ioGetter: () => IOServer,
        private readonly defaultContext?: EmitContext,
    ) {}

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
                if (!silent) logger[logLevel](`${errorPrefix}: invalid emitter`, { context: mergedContext, event });
                return false;
            }
            io.emit(event, payload);
            return true;
        } catch (error) {
            if (!silent) {
                logger[logLevel](`${errorPrefix} ${event}`, {
                    context: mergedContext,
                    error: serializeError(error),
                    event,
                    payload: safeString(payload),
                    ...mergedContext.identifiers,
                });
            }
            return false;
        }
    }

    /** Adapter for call sites that take a bare `(event, payload)` emit function. */
    asFn(): (event: string, payload: unknown) => undefined {
        return (event, payload) => {
            this.emit(event, payload);
            return undefined;
        };
    }
}

export function createSocketEmitter(
    ioGetter: () => IOServer,
    defaultContext?: EmitContext,
): SocketEmitter {
    return new SocketEmitter(ioGetter, defaultContext);
}
