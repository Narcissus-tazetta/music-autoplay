import logger from '@/server/logger';
import { RemoveMusicSchema } from '@/shared/schemas/music';
import { serverContext } from '@/shared/types/server';
import { safeExecuteAsync } from '@/shared/utils/errors';
import { err as makeErr } from '@/shared/utils/errors/result-handlers';
import { respondWithResult } from '@/shared/utils/httpResponse';
import { parseWithZod } from '@conform-to/zod/v4';
import type { ActionFunctionArgs } from 'react-router';
import {
    extractHandlerErrorMessage,
    rateLimitExceededResponse,
    replyOptionsErrorResponse,
    resolveActingRequesterHash,
} from '../../musicAction.server';
import { getRateLimitKey } from '../../requesterIdentity.server';
import { isAdminSession, loginSession } from '../../sessions.server';

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
    const isAdmin = isAdminSession(session);

    const rateLimitKey = await getRateLimitKey(request, cookieHeader);

    if (!isAdmin) {
        const limited = rateLimitExceededResponse(httpRateLimiter, rateLimitKey, '/api/music/remove');
        if (limited) return limited;
    }

    try {
        const acting = await resolveActingRequesterHash(
            cookieHeader,
            isAdmin,
            'ログインしていないため、楽曲を削除できません',
            session,
        );
        if (!acting.ok) return acting.response;
        if (isAdmin) logger.info('Using admin hash for deletion');

        const result = await safeExecuteAsync(() => io.removeMusic(submission.value.url, acting.requesterHash));

        if (!result.ok) {
            logger.error('楽曲削除エラー', { error: result.error });
            return respondWithResult(makeErr({ message: extractHandlerErrorMessage(result.error) }));
        }

        const errorResponse = replyOptionsErrorResponse(result.value);
        if (errorResponse) return errorResponse;

        if (!isAdmin) httpRateLimiter.consume(rateLimitKey);
        return Response.json({ data: result.value, success: true });
    } catch (error: unknown) {
        logger.error('楽曲削除エラー', { error });
        return Response.json(
            { error: '楽曲の削除に失敗しました', success: false },
            { status: 500 },
        );
    }
};
