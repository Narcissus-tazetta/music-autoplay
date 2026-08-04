import { RemoveMusicSchema } from '@/shared/schemas/music';
import type { ActionFunctionArgs } from 'react-router';
import { runOwnedMusicAction } from '../../musicAction.server';

export const action = (args: ActionFunctionArgs) =>
    runOwnedMusicAction(args, {
        adminLogMessage: 'Using admin hash for deletion',
        endpoint: '/api/music/remove',
        errorLabel: '楽曲削除エラー',
        failureMessage: '楽曲の削除に失敗しました',
        run: (value, requesterHash, io) => io.removeMusic(value.url, requesterHash),
        schema: RemoveMusicSchema,
        unauthorizedMessage: 'ログインしていないため、楽曲を削除できません',
    });
