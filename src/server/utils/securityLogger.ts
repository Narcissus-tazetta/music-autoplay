import logger from '@/server/logger';
import type { Request } from 'express';
import type { IncomingMessage } from 'node:http';

function getHeader(
    req: Request | IncomingMessage,
    name: string,
): string | undefined {
    if ('get' in req && typeof req.get === 'function') return req.get(name);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if ('headers' in req && req.headers) {
        const value = req.headers[name.toLowerCase()];
        return Array.isArray(value) ? value[0] : value;
    }
    return undefined;
}

export interface SecurityEvent {
    type:
        | 'auth_failure'
        | 'invalid_url'
        | 'rate_limit'
        | 'cors_violation'
        | 'suspicious_request';
    severity: 'low' | 'medium' | 'high' | 'critical';
    source: string;
    message: string;
    metadata?: Record<string, unknown>;
    requestId?: string;
    userAgent?: string;
    ip?: string;
}

export function logSecurityEvent(
    event: SecurityEvent,
    req?: Request | IncomingMessage,
): void {
    let requestIdFromReq: string | undefined;
    if (req) {
        const maybe = req as unknown as Record<string, unknown>;
        if (typeof maybe.requestId === 'string') requestIdFromReq = maybe.requestId;
    }
    const logData = {
        ...event,
        timestamp: new Date().toISOString(),
        requestId: event.requestId ?? requestIdFromReq,
        userAgent: event.userAgent ?? (req ? getHeader(req, 'User-Agent') : undefined),
        ip: event.ip
            ?? (req && 'ip' in req ? req.ip : undefined)
            ?? (req?.socket ? req.socket.remoteAddress : undefined),
        referer: req ? getHeader(req, 'Referer') : undefined,
        origin: req ? getHeader(req, 'Origin') : undefined,
    };

    switch (event.severity) {
        case 'critical':
        case 'high': {
            logger.error('Security Event', logData);
            break;
        }
        case 'medium': {
            logger.warn('Security Event', logData);
            break;
        }
        case 'low':
        default: {
            logger.info('Security Event', logData);
            break;
        }
    }
}

export function logAuthFailure(
    req: Request | IncomingMessage,
    reason: string,
    userId?: string,
): void {
    logSecurityEvent(
        {
            message: `Authentication failed: ${reason}`,
            metadata: userId ? { userId } : undefined,
            severity: 'high',
            source: 'authentication',
            type: 'auth_failure',
        },
        req,
    );
}

export function logInvalidUrl(
    req: Request | IncomingMessage,
    url: string,
    reason: string,
): void {
    logSecurityEvent(
        {
            message: `Invalid URL rejected: ${reason}`,
            metadata: { reason, url },
            severity: 'medium',
            source: 'url_validation',
            type: 'invalid_url',
        },
        req,
    );
}

export function logRateLimit(
    req: Request | IncomingMessage,
    endpoint: string,
    _limit: number,
): void {
    logSecurityEvent(
        {
            message: `Rate limit exceeded for endpoint: ${endpoint}`,
            metadata: { endpoint },
            severity: 'medium',
            source: 'rate_limiting',
            type: 'rate_limit',
        },
        req,
    );
}

export function logCorsViolation(
    req: Request | IncomingMessage,
    origin: string,
    reason: string,
): void {
    logSecurityEvent(
        {
            message: `CORS violation: ${reason}`,
            metadata: { origin, reason },
            severity: 'high',
            source: 'cors',
            type: 'cors_violation',
        },
        req,
    );
}

export function logSuspiciousRequest(
    req: Request | IncomingMessage,
    reason: string,
    metadata?: Record<string, unknown>,
): void {
    logSecurityEvent(
        {
            message: `Suspicious request detected: ${reason}`,
            metadata,
            severity: 'medium',
            source: 'request_analysis',
            type: 'suspicious_request',
        },
        req,
    );
}
