import { serverContext } from '@/server/context';
import logger from '@/server/logger.server';
import { getRateLimitKey, resolveRequesterIdentity } from '@/server/requesterIdentity.server';
import { hasPathfinderAccess, loginSession } from '@/server/sessions.server';
import { getMessage } from '@/shared/constants/messages';
import { AddMusicSchema } from '@/shared/schemas/music';
import { safeExecuteAsync } from '@/shared/utils/errors';
import { parseWithZod } from '@conform-to/zod/v4';
import type { ActionFunctionArgs } from 'react-router';
import { rateLimitExceededResponse } from '../../musicAction.server';

export const action = async ({
    request,
    context,
}: ActionFunctionArgs) => {
    const { httpRateLimiter, io } = context.get(serverContext);
    const cookie = request.headers.get('Cookie');
    const rateLimitKey = await getRateLimitKey(request, cookie);
    const rateLimiter = httpRateLimiter;

    // Shared with music.remove / music.reorder: this route inlined its own copy of the
    // same 429 response.
    const limited = rateLimitExceededResponse(rateLimiter, rateLimitKey, '/api/music/add');
    if (limited) return limited;

    const submission = parseWithZod(await request.formData(), {
        schema: AddMusicSchema,
    });

    if (submission.status !== 'success') return Response.json(submission.reply(), { status: 400 });

    const session = await loginSession.getSession(cookie);
    const { requesterHash, requesterName } = await resolveRequesterIdentity(cookie, session);
    const insertAfterId = hasPathfinderAccess(session) ? submission.value.insertAfterId : undefined;

    const result = await safeExecuteAsync(() =>
        io.addMusic(submission.value.url, requesterHash, requesterName, insertAfterId)
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
