import { ReorderMusicSchema } from '@/shared/schemas/music';
import { err as makeErr } from '@/shared/utils/errors/result-handlers';
import { respondWithResult } from '@/shared/utils/httpResponse';
import type { ActionFunctionArgs } from 'react-router';
import { runOwnedMusicAction } from '../../musicAction.server';
import { hasPathfinderAccess } from '../../sessions.server';

export const action = (args: ActionFunctionArgs) =>
    runOwnedMusicAction(args, {
        authorize: session =>
            hasPathfinderAccess(session)
                ? null
                : respondWithResult(makeErr({ code: 'unauthorized', message: '並び替え権限がありません' })),
        endpoint: '/api/music/reorder',
        errorLabel: '楽曲並び替えエラー',
        failureMessage: '楽曲の並び替えに失敗しました',
        // Own bucket ("reorder:" prefix): drags must not drain the add/remove budget.
        rateLimitKeyPrefix: 'reorder:',
        run: (value, requesterHash, io) => io.reorderMusic(value.id, value.afterId, requesterHash),
        schema: ReorderMusicSchema,
        unauthorizedMessage: 'ログインしていないため、楽曲を並び替えできません',
    });
