import logger from '@/server/logger';
import { ReorderMusicSchema } from '@/shared/schemas/music';
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
import { hasPathfinderAccess, isAdminSession, loginSession } from '../../sessions.server';

export const action = async ({
    request,
    context,
}: ActionFunctionArgs) => {
    const { httpRateLimiter, io } = context.get(serverContext);
    const formData = await request.formData();
    const submission = parseWithZod(formData, {
        schema: ReorderMusicSchema,
    });

    if (submission.status !== 'success') return Response.json(submission.reply(), { status: 400 });

    const cookieHeader = request.headers.get('Cookie');
    const session = await loginSession.getSession(cookieHeader);
    const isAdmin = isAdminSession(session);

    if (!hasPathfinderAccess(session)) {
        return respondWithResult(
            makeErr({
                code: 'unauthorized',
                message: '並び替え権限がありません',
            }),
        );
    }

    // Own bucket ("reorder:" prefix): drags must not drain the add/remove budget.
    const rateLimitKey = `reorder:${await getRateLimitKey(request, cookieHeader)}`;

    if (!isAdmin) {
        const limited = rateLimitExceededResponse(httpRateLimiter, rateLimitKey, '/api/music/reorder');
        if (limited) return limited;
    }

    try {
        const acting = await resolveActingRequesterHash(
            cookieHeader,
            isAdmin,
            'ログインしていないため、楽曲を並び替えできません',
            session,
        );
        if (!acting.ok) return acting.response;

        const result = await safeExecuteAsync(() =>
            io.reorderMusic(submission.value.id, submission.value.afterId, acting.requesterHash)
        );

        if (!result.ok) {
            logger.error('楽曲並び替えエラー', { error: result.error });
            return respondWithResult(makeErr({ message: extractHandlerErrorMessage(result.error) }));
        }

        const errorResponse = replyOptionsErrorResponse(result.value);
        if (errorResponse) return errorResponse;

        if (!isAdmin) httpRateLimiter.consume(rateLimitKey);
        return Response.json({ data: result.value, success: true });
    } catch (error: unknown) {
        logger.error('楽曲並び替えエラー', { error });
        return Response.json(
            { error: '楽曲の並び替えに失敗しました', success: false },
            { status: 500 },
        );
    }
};

export default function MusicReorder() {
    return;
}
