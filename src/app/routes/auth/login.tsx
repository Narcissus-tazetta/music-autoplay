import { respondWithResult } from '@/server/httpResponse.server';
import logger from '@/server/logger.server';
import { err as makeErr } from '@/shared/utils/errors/result-handlers';
import type { ActionFunctionArgs } from 'react-router';
import { authenticator } from '../../auth/auth.server';

export const action = async ({ request }: ActionFunctionArgs) => {
    try {
        return await authenticator.authenticate('google-oidc', request);
    } catch (error: unknown) {
        // The strategy signals its redirect to Google by throwing the Response.
        if (error instanceof Response) {
            logger.warn('Login redirected', { status: error.status, statusText: error.statusText });
            return error;
        }

        logger.error('Login action error', { error });
        return respondWithResult(
            makeErr({ code: 'unauthorized', message: 'ログインを開始できませんでした。' }),
        );
    }
};

// クライアント側のコンポーネント（オプション、フォーム送信用）
export default function Login() {
    return;
}
