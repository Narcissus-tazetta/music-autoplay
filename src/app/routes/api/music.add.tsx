import logger from '@/server/logger';
import { getClientIP } from '@/server/utils/getClientIP';
import { getMessage } from '@/shared/constants/messages';
import { AddMusicSchema } from '@/shared/schemas/music';
import type { ServerContext } from '@/shared/types/server';
import { safeExecuteAsync } from '@/shared/utils/errors';
import { parseWithZod } from '@conform-to/zod';
import { createHash, hash } from 'node:crypto';
import type { ActionFunctionArgs } from 'react-router';
import { loginSession } from '../../sessions.server';

function getRateLimitKey(request: Request, cookie: string | null): string {
    if (cookie) {
        const sessionMatch = cookie.match(/__session=([^;]+)/);
        if (sessionMatch)
            return `session:${createHash('sha256').update(sessionMatch[1]).digest('hex').substring(0, 16)}`;
        const themeMatch = cookie.match(/theme=([^;]+)/);
        if (themeMatch) return `theme:${createHash('sha256').update(themeMatch[1]).digest('hex').substring(0, 16)}`;
    }

    const userAgent = request.headers.get('user-agent');
    const accept = request.headers.get('accept');
    const acceptLang = request.headers.get('accept-language');
    const clientIP = getClientIP(request);

    const fingerprint = `${clientIP}:${userAgent}:${accept}:${acceptLang}`;
    return `fp:${createHash('sha256').update(fingerprint).digest('hex').substring(0, 16)}`;
}

export const action = async ({
    request,
    context,
}: ActionFunctionArgs<ServerContext>) => {
    const cookie = request.headers.get('Cookie');
    const session = await loginSession.getSession(cookie);
    const rateLimitKey = getRateLimitKey(request, cookie);
    const rateLimiter = context.httpRateLimiter;

    if (!rateLimiter.check(rateLimitKey)) {
        const oldestAttempt = rateLimiter.getOldestAttempt(rateLimitKey);
        const retryAfter = typeof oldestAttempt === 'number'
            ? Math.ceil((oldestAttempt + 60_000 - Date.now()) / 1000)
            : 60;
        logger.warn('Rate limit exceeded', {
            endpoint: '/api/music/add',
            rateLimitKey,
        });
        return Response.json(
            { error: 'レート制限を超えました。しばらくしてから再試行してください。' },
            { headers: { 'Retry-After': retryAfter.toString() }, status: 429 },
        );
    }

    const submission = parseWithZod(await request.formData(), {
        schema: AddMusicSchema,
    });

    if (submission.status !== 'success') return Response.json(submission.reply(), { status: 400 });

    const user = session.get('user');
    const requesterHash = user ? hash('sha256', user.id) : undefined;
    const requesterName = user?.name ?? (user ? 'unknown' : 'guest');

    const result = await safeExecuteAsync(() =>
        context.io.addMusic(submission.value.url, requesterHash, requesterName)
    );

    if (result.ok) {
        const replyOptions = result.value as { formErrors?: string[] };
        if (replyOptions.formErrors && replyOptions.formErrors.length > 0) {
            logger.info('addMusic validation error', {
                formErrors: replyOptions.formErrors,
            });
            return Response.json(
                submission.reply({ fieldErrors: { url: replyOptions.formErrors } }),
                { status: 400 },
            );
        }
        rateLimiter.consume(rateLimitKey);
        return Response.json(submission.reply({ resetForm: true }), {
            status: 200,
        });
    }

    logger.error('楽曲追加エラー', { error: result.error });
    return Response.json(
        submission.reply({
            fieldErrors: { url: [getMessage('ERROR_ADD_FAILED')] },
        }),
        { status: 500 },
    );
};

export default function MusicAdd() {
    return;
}
