import { isRecord } from '../typeGuards';

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
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
    silent?: boolean;
    returnOnError?: 'undefined' | 'throw';
}

export type NormalizedWrapOptions = Required<WrapOptions>;

export function isError(v: unknown): v is Error {
    return v instanceof Error;
}

/** Cap so a pathological object cannot turn one log line into megabytes. */
const FORMAT_MAX_LENGTH = 2_000;

/**
 * Browser-safe stand-in for `util.inspect(value, { depth: 2 })`.
 *
 * This module is imported by client code, where Vite replaces `node:util` with an empty
 * object - `util.inspect` was `undefined` there, so the error formatter itself threw a
 * TypeError on any value that reached it. Being the error path, it must never throw.
 *
 * Objects are rendered as JSON with a circular guard rather than util.inspect's
 * `<ref *1> { … [Circular *1] }` notation, so the text differs from the old server output
 * while carrying the same information.
 */
export function formatUnknown(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';

    switch (typeof value) {
        case 'string':
            return value;
        case 'number':
        case 'boolean':
            return String(value);
        case 'bigint':
            return `${value.toString()}n`;
        case 'symbol':
            return value.toString();
        case 'function':
            return `[Function: ${value.name || 'anonymous'}]`;
        default:
            break;
    }

    let out: string;
    try {
        const seen = new WeakSet<object>();
        out = JSON.stringify(value, (_key, val: unknown) => {
            if (typeof val === 'bigint') return `${val.toString()}n`;
            if (typeof val === 'function') return `[Function: ${val.name || 'anonymous'}]`;
            if (val !== null && typeof val === 'object') {
                if (seen.has(val)) return '[Circular]';
                seen.add(val);
            }
            return val;
        }) ?? Object.prototype.toString.call(value);
    } catch {
        // A getter that throws, a Proxy that traps, a toJSON that blows up - fall back to
        // something that cannot fail rather than letting the error path lose the error.
        try {
            out = Object.prototype.toString.call(value);
        } catch {
            return '[unformattable]';
        }
    }

    return out.length > FORMAT_MAX_LENGTH ? `${out.slice(0, FORMAT_MAX_LENGTH)}…` : out;
}

export function extractErrorInfo(error: unknown): ErrorInfo {
    if (isError(error)) {
        let code: string | undefined = undefined;
        try {
            const errRec = error as Error & { code?: string };
            if (typeof errRec.code === 'string') code = errRec.code;
        } catch {
            void 0;
        }

        return {
            code,
            message: error.message || 'unknown error',
            stack: error.stack,
        };
    }

    if (typeof error === 'string') return { message: error };

    if (isRecord(error)) {
        const obj = error;
        let msg: string;

        if (typeof obj.message === 'string') msg = obj.message;
        else {
            try {
                msg = JSON.stringify(obj);
            } catch {
                msg = formatUnknown(obj);
            }
        }

        return {
            code: typeof obj.code === 'string' ? obj.code : undefined,
            message: msg,
            meta: extractErrorMeta(obj),
            stack: typeof obj.stack === 'string' ? obj.stack : undefined,
        };
    }

    return {
        message: formatUnknown(error),
    };
}

function extractErrorMeta(error: unknown): Record<string, unknown> | undefined {
    if (!isRecord(error)) return undefined;

    const meta: Record<string, unknown> = {};
    const skipKeys = new Set(['message', 'stack', 'code', 'name']);

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
        code: info.code,
        message: info.message,
        meta: {
            stack: info.stack,
            ...info.meta,
        },
    };
}

export function safeString(val: unknown): string {
    if (val == undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'symbol') return String(val);
    if (
        typeof val === 'number'
        || typeof val === 'boolean'
        || typeof val === 'bigint'
    ) {
        return String(val);
    }

    try {
        return JSON.stringify(val);
    } catch {
        try {
            return Object.prototype.toString.call(val);
        } catch {
            return '[unserializable]';
        }
    }
}

export function normalizeWrapOptions(
    contextOrOpts?: string | WrapOptions,
): NormalizedWrapOptions {
    if (typeof contextOrOpts === 'string') {
        return {
            context: contextOrOpts,
            logLevel: 'error',
            operation: contextOrOpts,
            returnOnError: 'undefined',
            silent: false,
        };
    }

    const opts: WrapOptions = contextOrOpts || {};
    return {
        context: opts.context || '',
        logLevel: opts.logLevel || 'error',
        operation: opts.operation || opts.context || '',
        returnOnError: opts.returnOnError || 'undefined',
        silent: opts.silent || false,
    };
}
