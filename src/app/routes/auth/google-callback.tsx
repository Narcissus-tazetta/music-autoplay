import logger from '@/server/logger';
import { err as makeErr } from '@/shared/utils/errors/result-handlers';
import { respondWithResult } from '@/shared/utils/httpResponse';
import { type LoaderFunctionArgs, redirect } from 'react-router';
import { authenticator } from '../../auth/auth.server';
import { loginSession } from '../../sessions.server';

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
        logger.error('認証エラー', { error });

        if (error instanceof Response) return error;

        const message = error instanceof Error
            ? error.message
            : (typeof error === 'string'
                ? error
                : 'authentication error');
        return respondWithResult(makeErr({ code: 'unauthorized', message }));
    }
};

export default function GoogleCallback() {
    return; // これは loader のみのルートです
}
