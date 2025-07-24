import { type LoaderFunctionArgs, redirect } from 'react-router';
import { authenticator } from '~/auth/auth.server';
import { loginSession } from '~/sessions.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
    try {
        const user = await authenticator.authenticate('google-oidc', request);

        const session = await loginSession.getSession(request.headers.get('Cookie'));
        session.set('user', user);

        return redirect('/', {
            headers: {
                'Set-Cookie': await loginSession.commitSession(session),
            },
        });
    } catch (error) {
        console.error('認証エラー:', error);

        // エラーの詳細に基づいてリダイレクト
        if (error instanceof Response) {
            // OAuth プロバイダーからのリダイレクト（正常な場合もある）
            return error;
        }

        return new Response('認証に失敗しました。もう一度お試しください。', {
            status: 401,
        });
    }
};
