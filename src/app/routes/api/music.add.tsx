import logger from '@/server/logger';
import { getMessage } from '@/shared/constants/messages';
import { AddMusicSchema } from '@/shared/schemas/music';
import { serverContext } from '@/shared/types/server';
import { safeExecuteAsync } from '@/shared/utils/errors';
import { parseWithZod } from '@conform-to/zod/v4';
import type { ActionFunctionArgs } from 'react-router';
import { getRateLimitKey, resolveRequesterIdentity } from '../../requesterIdentity.server';

export const action = async ({
    request,
    context,
}: ActionFunctionArgs) => {
    const { httpRateLimiter, io } = context.get(serverContext);
    const cookie = request.headers.get('Cookie');
    const rateLimitKey = await getRateLimitKey(request, cookie);
    const rateLimiter = httpRateLimiter;

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

    const { requesterHash, requesterName } = await resolveRequesterIdentity(cookie);

    const result = await safeExecuteAsync(() => io.addMusic(submission.value.url, requesterHash, requesterName));

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
