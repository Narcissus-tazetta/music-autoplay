import { createCookieSessionStorage } from 'react-router';
import { createThemeSessionResolver } from 'remix-themes';
import { SERVER_ENV } from '~/env.server';

const isProduction = process.env.NODE_ENV === 'production';

const sessionStorage = createCookieSessionStorage({
    cookie: {
        name: 'theme',
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secrets: [SERVER_ENV.SESSION_SECRET],
        ...(isProduction
            ? { domain: 'music-autoplay.onrender.com', secure: true }
            : {}),
    },
});
export const themeSessionResolver = createThemeSessionResolver(sessionStorage);

export interface UserSessionData {
    id: string;
    name: string;
    email: string;
}
export const loginSession = createCookieSessionStorage<{
    user?: UserSessionData;
    admin?: boolean;
}>({
    cookie: {
        name: '__session',
        httpOnly: true,
        maxAge: 100 * 365 * 24 * 60 * 60,
        path: '/',
        sameSite: 'lax',
        secrets: [SERVER_ENV.SESSION_SECRET],
        secure: isProduction,
        ...(isProduction ? { domain: 'music-autoplay.onrender.com' } : {}),
    },
});
