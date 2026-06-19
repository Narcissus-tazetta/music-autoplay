import { container } from '@/server/di/container';
import logger from '@/server/logger';
import { RemoveMusicSchema } from '@/shared/schemas/music';
import { serverContext } from '@/shared/types/server';
import { safeExecuteAsync } from '@/shared/utils/errors';
import { err as makeErr } from '@/shared/utils/errors/result-handlers';
import { respondWithResult } from '@/shared/utils/httpResponse';
import { parseWithZod } from '@conform-to/zod/v4';
import { createHash } from 'node:crypto';
import type { ActionFunctionArgs } from 'react-router';
import { SERVER_ENV } from '../../env.server';
import { getRateLimitKey, resolveRequesterIdentity } from '../../requesterIdentity.server';
import { loginSession } from '../../sessions.server';

export const action = async ({
    request,
    context,
}: ActionFunctionArgs) => {
    const { httpRateLimiter, io } = context.get(serverContext);
    const formData = await request.formData();
    const submission = parseWithZod(formData, {
        schema: RemoveMusicSchema,
    });

    if (submission.status !== 'success') return Response.json(submission.reply(), { status: 400 });

    const cookieHeader = request.headers.get('Cookie');
    const session = await loginSession.getSession(cookieHeader);
    const isAdminSession = session.get('admin') === true;

    const rateLimiter = httpRateLimiter;
    const rateLimitKey = await getRateLimitKey(request, cookieHeader);

    if (!isAdminSession) {
        if (!rateLimiter.check(rateLimitKey)) {
            const oldestAttempt = rateLimiter.getOldestAttempt(rateLimitKey);
            const retryAfter = typeof oldestAttempt === 'number'
                ? Math.ceil((oldestAttempt + 60_000 - Date.now()) / 1000)
                : 60;
            logger.warn('Rate limit exceeded', {
                endpoint: '/api/music/remove',
                rateLimitKey,
            });
            return Response.json(
                {
                    error: 'レート制限を超えました。しばらくしてから再試行してください。',
                },
                { headers: { 'Retry-After': retryAfter.toString() }, status: 429 },
            );
        }
    }

    try {
        let requesterHash: string | undefined;

        if (isAdminSession) {
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
                logger.warn(
                    'Admin deletion requested but ADMIN_SECRET is not configured',
                );
                return respondWithResult(makeErr({ message: 'unauthorized' }));
            }
            requesterHash = createHash('sha256').update(adminSecret).digest('hex');
            logger.info('Using admin hash for deletion');
        } else {
            const identity = await resolveRequesterIdentity(cookieHeader);
            if (!identity.requesterHash) {
                return respondWithResult(
                    makeErr({
                        code: 'unauthorized',
                        message: 'ログインしていないため、楽曲を削除できません',
                    }),
                );
            }
            requesterHash = identity.requesterHash;
        }

        const result = await safeExecuteAsync(async () => {
            return await Promise.resolve(
                io.removeMusic(submission.value.url, requesterHash!),
            );
        });

        if (!result.ok) {
            logger.error('楽曲削除エラー', { error: result.error });
            const errVal = result.error;
            let msg = 'Unknown error';
            if (typeof errVal === 'string') msg = errVal;
            else if (
                errVal
                && typeof errVal === 'object'
                && 'message' in (errVal as Record<string, unknown>)
            ) {
                const m = (errVal as Record<string, unknown>).message;
                if (typeof m === 'string') msg = m;
            } else {
                try {
                    msg = JSON.stringify(errVal);
                } catch {
                    msg = Object.prototype.toString.call(errVal);
                }
            }
            return respondWithResult(makeErr({ message: msg }));
        }

        const value = result.value;
        if (typeof value === 'object' && value != undefined) {
            const rec = value as Record<string, unknown>;
            const fe = rec.formErrors;
            if (Array.isArray(fe) && fe.length > 0) {
                return Response.json(
                    { error: (fe as string[]).join(' '), success: false },
                    { status: 403 },
                );
            }
        }

        if (!isAdminSession) rateLimiter.consume(rateLimitKey);
        return Response.json({ data: value, success: true });
    } catch (error: unknown) {
        logger.error('楽曲削除エラー', { error });
        return Response.json(
            { error: '楽曲の削除に失敗しました', success: false },
            { status: 500 },
        );
    }
};

export default function MusicRemove() {
    return;
}
