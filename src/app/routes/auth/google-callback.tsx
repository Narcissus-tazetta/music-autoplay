import { respondWithResult } from '@/server/httpResponse.server';
import logger from '@/server/logger.server';
import { loginSession } from '@/server/sessions.server';
import { err as makeErr } from '@/shared/utils/errors/result-handlers';
import { type LoaderFunctionArgs, redirect } from 'react-router';
import { authenticator } from '../../auth/auth.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
    try {
        const user = await authenticator.authenticate('google-oidc', request);

        const session = await loginSession.getSession(
            request.headers.get('Cookie'),
        );
        session.set('user', user);

        return redirect('/', {
            headers: {
                'Set-Cookie': await loginSession.commitSession(session),
            },
        });
    } catch (error: unknown) {
        // A Response here is the strategy's own redirect, not a failure.
        if (error instanceof Response) return error;

        logger.error('認証エラー', { error });
        // The underlying jose/OAuth message stays in the log; the caller gets a fixed one.
        return respondWithResult(
            makeErr({ code: 'unauthorized', message: 'ログインに失敗しました。もう一度お試しください。' }),
        );
    }
};

export default function GoogleCallback() {
    return; // これは loader のみのルートです
}
