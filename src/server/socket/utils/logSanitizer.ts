import { getStructuredClone, isObject } from '@/shared/utils/typeGuards';
import type { HeaderSnapshot, RequestLike, SocketLike } from '../types';

function deepCloneForLog(v: unknown): unknown {
    try {
        const sc = getStructuredClone();
        if (typeof sc === 'function') return sc(v);
        return JSON.parse(JSON.stringify(v));
    } catch {
        return Object.prototype.toString.call(v);
    }
}

/** The only headers worth logging; the cookie is recorded as present but never in clear. */
function pickLoggableHeaders(headers: Record<string, unknown>): HeaderSnapshot {
    const out: Record<string, string | undefined> = {};
    if (typeof headers.origin === 'string') out.origin = headers.origin;
    if (typeof headers.referer === 'string') out.referer = headers.referer;
    if (typeof headers.cookie === 'string') out.cookie = '[REDACTED]';
    if (typeof headers['user-agent'] === 'string') out['user-agent'] = headers['user-agent'];
    return out;
}

export function snapshotHeaders(socket: SocketLike): HeaderSnapshot {
    if (!isObject(socket)) return undefined;

    const socketObj = socket as { handshake?: unknown; conn?: unknown };

    const handshakeHeaders = isObject(socketObj.handshake)
        ? (socketObj.handshake as { headers?: unknown }).headers
        : undefined;
    if (isObject(handshakeHeaders)) return pickLoggableHeaders(handshakeHeaders);

    const request = isObject(socketObj.conn)
        ? (socketObj.conn as { request?: unknown }).request
        : undefined;
    const requestHeaders = isObject(request) ? (request as RequestLike).headers : undefined;
    if (isObject(requestHeaders)) return pickLoggableHeaders(requestHeaders);

    return undefined;
}

export function sanitizeArgs(args: unknown[]): unknown[] {
    return args.map(a => {
        if (a == undefined) return a;
        if (
            typeof a === 'string'
            || typeof a === 'number'
            || typeof a === 'boolean'
        ) {
            return a;
        }
        if (Array.isArray(a)) {
            return a.map<unknown>((v: unknown) => {
                if (typeof v === 'object' && v !== null) return deepCloneForLog(v);
                return v;
            });
        }
        if (typeof a === 'object') return deepCloneForLog(a);
        return a;
    });
}
