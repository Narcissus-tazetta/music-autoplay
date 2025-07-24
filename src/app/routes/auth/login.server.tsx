import type { ActionFunctionArgs } from 'react-router';
import { authenticator } from '~/auth/auth.server';

export const action = async ({ request }: ActionFunctionArgs) => {
    try {
        // Remix Auth が内部的に CSRF 保護を提供
        return await authenticator.authenticate('google-oidc', request);
    } catch (error) {
        console.error('Login action error:', error);
        throw error;
    }
};
