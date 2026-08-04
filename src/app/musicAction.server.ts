import { serverContext } from '@/server/context';
import { SERVER_ENV } from '@/server/env.server';
import { respondWithResult } from '@/server/httpResponse.server';
import logger from '@/server/logger.server';
import { getRateLimitKey, resolveRequesterIdentity } from '@/server/requesterIdentity.server';
import type { RateLimiter } from '@/server/services/rateLimiter';
import { isAdminSession, type LoginSession, loginSession } from '@/server/sessions.server';
import type { SocketServerInstance } from '@/server/socket/socketServer';
import { safeExecuteAsync } from '@/shared/utils/errors';
import { err as makeErr } from '@/shared/utils/errors/result-handlers';
import { parseWithZod } from '@conform-to/zod/v4';
import { createHash } from 'node:crypto';
import type { ActionFunctionArgs } from 'react-router';
import type { z } from 'zod';

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

type ActingRequesterHash =
    | { ok: true; requesterHash: string }
    | { ok: false; response: Response };

/**
 * Resolves the requesterHash used for ownership checks in music mutations: admins act
 * as sha256(ADMIN_SECRET) (the hash AuthChecker treats as all-powerful), everyone else
 * as their own identity hash.
 */
async function resolveActingRequesterHash(
    cookieHeader: string | null,
    isAdmin: boolean,
    unauthorizedMessage: string,
    session?: LoginSession,
): Promise<ActingRequesterHash> {
    if (isAdmin) {
        const adminSecret = SERVER_ENV.ADMIN_SECRET;
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

function extractHandlerErrorMessage(errVal: unknown): string {
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
function replyOptionsErrorResponse(value: unknown): Response | null {
    if (typeof value !== 'object' || value == undefined) return null;
    const fe = (value as Record<string, unknown>).formErrors;
    if (!Array.isArray(fe) || fe.length === 0) return null;
    return Response.json(
        { error: (fe as string[]).join(' '), success: false },
        { status: 403 },
    );
}

export interface OwnedMusicActionConfig<TValue> {
    schema: z.ZodType<TValue>;
    /** Endpoint label used in rate-limit logs. */
    endpoint: string;
    /** Prefixes the rate-limit key so an endpoint can hold its own budget. */
    rateLimitKeyPrefix?: string;
    /** Shown when an anonymous caller has no identity hash to act as. */
    unauthorizedMessage: string;
    /** Log label and user-facing message for an unexpected failure. */
    errorLabel: string;
    failureMessage: string;
    /** Extra gate run before rate limiting; return a Response to reject the request. */
    authorize?: (session: LoginSession) => Response | null;
    /** Logged once when an admin performs the action. */
    adminLogMessage?: string;
    run: (value: TValue, requesterHash: string, io: SocketServerInstance) => Promise<unknown>;
}

/**
 * The shared skeleton behind the music mutations that act on someone's own queue entry
 * (remove, reorder): parse → resolve session → authorize → rate limit → run → map result.
 * `music.add` deliberately stays separate: it answers with conform `submission.reply()`
 * payloads rather than the `{ data, success }` envelope these two return.
 */
export async function runOwnedMusicAction<TValue>(
    { context, request }: ActionFunctionArgs,
    config: OwnedMusicActionConfig<TValue>,
): Promise<Response> {
    const { httpRateLimiter, io } = context.get(serverContext);
    const formData = await request.formData();
    const submission = parseWithZod(formData, { schema: config.schema });

    if (submission.status !== 'success') return Response.json(submission.reply(), { status: 400 });

    const cookieHeader = request.headers.get('Cookie');
    const session = await loginSession.getSession(cookieHeader);
    const isAdmin = isAdminSession(session);

    const rejected = config.authorize?.(session);
    if (rejected) return rejected;

    const rateLimitKey = `${config.rateLimitKeyPrefix ?? ''}${await getRateLimitKey(request, cookieHeader)}`;

    if (!isAdmin) {
        const limited = rateLimitExceededResponse(httpRateLimiter, rateLimitKey, config.endpoint);
        if (limited) return limited;
    }

    try {
        const acting = await resolveActingRequesterHash(
            cookieHeader,
            isAdmin,
            config.unauthorizedMessage,
            session,
        );
        if (!acting.ok) return acting.response;
        if (isAdmin && config.adminLogMessage) logger.info(config.adminLogMessage);

        const result = await safeExecuteAsync(() => config.run(submission.value, acting.requesterHash, io));

        if (!result.ok) {
            logger.error(config.errorLabel, { error: result.error });
            return respondWithResult(makeErr({ message: extractHandlerErrorMessage(result.error) }));
        }

        const errorResponse = replyOptionsErrorResponse(result.value);
        if (errorResponse) return errorResponse;

        if (!isAdmin) httpRateLimiter.consume(rateLimitKey);
        return Response.json({ data: result.value, success: true });
    } catch (error: unknown) {
        logger.error(config.errorLabel, { error });
        return Response.json({ error: config.failureMessage, success: false }, { status: 500 });
    }
}
