import { createCookie, createCookieSessionStorage } from 'react-router';
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
            ? { domain: 'music-auto-play.onrender.com', secure: true }
            : {}),
    },
});
export const themeSessionResolver = createThemeSessionResolver(sessionStorage);

export interface UserSessionData {
    id: string;
    name: string;
    email: string;
}
export type SessionRole = 'admin' | 'pathfinder';

export const loginSession = createCookieSessionStorage<{
    user?: UserSessionData;
    admin?: boolean;
    roles?: SessionRole[];
}>({
    cookie: {
        name: '__session',
        httpOnly: true,
        maxAge: 100 * 365 * 24 * 60 * 60,
        path: '/',
        sameSite: 'lax',
        secrets: [SERVER_ENV.SESSION_SECRET],
        secure: isProduction,
        ...(isProduction ? { domain: 'music-auto-play.onrender.com' } : {}),
    },
});

export type LoginSession = Awaited<ReturnType<typeof loginSession.getSession>>;

/** Roles stored in the session, back-filling `admin` for sessions created before `roles` existed. */
export function getSessionRoles(session: LoginSession): SessionRole[] {
    const roles = new Set<SessionRole>(session.get('roles') ?? []);
    if (session.get('admin') === true) roles.add('admin');
    return [...roles];
}

export function isAdminSession(session: LoginSession): boolean {
    return getSessionRoles(session).includes('admin');
}

/** Pathfinder features (insert position, reorder, request logs) are granted to both admin and pathfinder roles. */
export function hasPathfinderAccess(session: LoginSession): boolean {
    const roles = getSessionRoles(session);
    return roles.includes('admin') || roles.includes('pathfinder');
}

export const anonymousIdCookie = createCookie('_anonId', {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
    secrets: [SERVER_ENV.SESSION_SECRET],
    secure: isProduction,
    ...(isProduction ? { domain: 'music-auto-play.onrender.com' } : {}),
});

export const requesterDisplayNameCookie = createCookie('_requesterName', {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
    secrets: [SERVER_ENV.SESSION_SECRET],
    secure: isProduction,
    ...(isProduction ? { domain: 'music-auto-play.onrender.com' } : {}),
});
