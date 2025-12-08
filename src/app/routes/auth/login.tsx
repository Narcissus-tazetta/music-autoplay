import logger from '@/server/logger';
import { err as makeErr } from '@/shared/utils/errors/result-handlers';
import { respondWithResult } from '@/shared/utils/httpResponse';
import type { ActionFunctionArgs } from 'react-router';
import { authenticator } from '../../auth/auth.server';

export const action = async ({ request }: ActionFunctionArgs) => {
    try {
        return await authenticator.authenticate('google-oidc', request);
    } catch (error: unknown) {
        // エラー情報を詳細にログ出力
        if (error instanceof Response) {
            logger.warn('Login redirected', {
                status: error.status,
                statusText: error.statusText,
            });
            return error;
        }

        const errorDetails = error instanceof Error
            ? {
                message: error.message,
                name: error.name,
                stack: error.stack,
            }
            : (typeof error === 'string'
                ? { message: error }
                : { raw: String(error) });

        logger.error('Login action error', errorDetails);

        const message = error instanceof Error
            ? error.message
            : (typeof error === 'string'
                ? error
                : 'login failed');
        return respondWithResult(makeErr({ code: 'unauthorized', message }));
    }
};

// クライアント側のコンポーネント（オプション、フォーム送信用）
export default function Login() {
    return;
}
