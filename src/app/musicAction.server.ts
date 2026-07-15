import { container } from '@/server/di/container';
import logger from '@/server/logger';
import type { RateLimiter } from '@/server/services/rateLimiter';
import { err as makeErr } from '@/shared/utils/errors/result-handlers';
import { respondWithResult } from '@/shared/utils/httpResponse';
import { createHash } from 'node:crypto';
import { SERVER_ENV } from '~/env.server';
import { resolveRequesterIdentity } from '~/requesterIdentity.server';
import type { LoginSession } from '~/sessions.server';

const RATE_LIMIT_WINDOW_MS = 60_000;

/** Returns the 429 response when the caller is over budget, or null when the request may proceed. */
export function rateLimitExceededResponse(
    rateLimiter: RateLimiter,
    rateLimitKey: string,
    endpoint: string,
): Response | null {
    if (rateLimiter.check(rateLimitKey)) return null;
    const oldestAttempt = rateLimiter.getOldestAttempt(rateLimitKey);
    const retryAfter = typeof oldestAttempt === 'number'
        ? Math.ceil((oldestAttempt + RATE_LIMIT_WINDOW_MS - Date.now()) / 1000)
        : 60;
    logger.warn('Rate limit exceeded', { endpoint, rateLimitKey });
    return Response.json(
        { error: 'レート制限を超えました。しばらくしてから再試行してください。' },
        { headers: { 'Retry-After': retryAfter.toString() }, status: 429 },
    );
}

export type ActingRequesterHash =
    | { ok: true; requesterHash: string }
    | { ok: false; response: Response };

/**
 * Resolves the requesterHash used for ownership checks in music mutations: admins act
 * as sha256(ADMIN_SECRET) (the hash AuthChecker treats as all-powerful), everyone else
 * as their own identity hash.
 */
export async function resolveActingRequesterHash(
    cookieHeader: string | null,
    isAdmin: boolean,
    unauthorizedMessage: string,
    session?: LoginSession,
): Promise<ActingRequesterHash> {
    if (isAdmin) {
        const cfg = container.getOptional('configService') as
            | { getString?(key: string): string }
            | undefined;
        let adminSecret: string | undefined;
        try {
            adminSecret = cfg?.getString?.('ADMIN_SECRET') ?? SERVER_ENV.ADMIN_SECRET;
        } catch {
            adminSecret = SERVER_ENV.ADMIN_SECRET;
        }
        if (!adminSecret) {
            logger.warn('Admin music action requested but ADMIN_SECRET is not configured');
            return { ok: false, response: respondWithResult(makeErr({ message: 'unauthorized' })) };
        }
        return { ok: true, requesterHash: createHash('sha256').update(adminSecret).digest('hex') };
    }

    const identity = await resolveRequesterIdentity(cookieHeader, session);
    if (!identity.requesterHash) {
        return {
            ok: false,
            response: respondWithResult(makeErr({ code: 'unauthorized', message: unauthorizedMessage })),
        };
    }
    return { ok: true, requesterHash: identity.requesterHash };
}

export function extractHandlerErrorMessage(errVal: unknown): string {
    if (typeof errVal === 'string') return errVal;
    if (errVal && typeof errVal === 'object' && 'message' in (errVal as Record<string, unknown>)) {
        const m = (errVal as Record<string, unknown>).message;
        if (typeof m === 'string') return m;
    }
    try {
        return JSON.stringify(errVal);
    } catch {
        return Object.prototype.toString.call(errVal);
    }
}

/** Maps a service ReplyOptions carrying formErrors to a 403 response, or null when it succeeded. */
export function replyOptionsErrorResponse(value: unknown): Response | null {
    if (typeof value !== 'object' || value == undefined) return null;
    const fe = (value as Record<string, unknown>).formErrors;
    if (!Array.isArray(fe) || fe.length === 0) return null;
    return Response.json(
        { error: (fe as string[]).join(' '), success: false },
        { status: 403 },
    );
}
