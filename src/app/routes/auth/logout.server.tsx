import { type ActionFunctionArgs, redirect } from 'react-router';
import { loginSession } from '~/sessions.server';

export const action = async ({ request }: ActionFunctionArgs) => {
    const session = await loginSession.getSession(request.headers.get('Cookie'));

    return redirect('/', {
        headers: {
            'Set-Cookie': await loginSession.destroySession(session),
        },
    });
};
