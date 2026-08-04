import { SERVER_ENV } from '@/server/env.server';
import { getSessionRoles, loginSession, type SessionRole } from '@/server/sessions.server';
import express, { type Request, Router } from 'express';
import logger from '../logger.server';
import { createAdminAuthenticator } from '../middleware/adminAuth';
import { createAdminRateLimiter } from '../middleware/adminRateLimiter';
import { logAuthFailure, logRateLimit, logSuspiciousRequest } from '../utils/securityLogger';

const MAX_CREDENTIAL_LENGTH = 256;

const adminAuthenticator = createAdminAuthenticator(SERVER_ENV.ADMIN_USER, SERVER_ENV.ADMIN_PASSWORD);
const adminRateLimiter = createAdminRateLimiter(3, 60 * 1000);

// The pathfinder role is opt-in: without credentials configured, its login is simply disabled.
const pathfinderAuthenticator = SERVER_ENV.PATHFINDER_USER && SERVER_ENV.PATHFINDER_PASSWORD
    ? createAdminAuthenticator(SERVER_ENV.PATHFINDER_USER, SERVER_ENV.PATHFINDER_PASSWORD)
    : undefined;

function rateLimitKeyFor(req: Request): string {
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    return typeof clientIp === 'string' ? clientIp : clientIp[0] || 'unknown';
}

export const adminRouter: Router = Router();

adminRouter.post('/login', express.json(), async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const { password, username } = body;
    const rateLimitKey = rateLimitKeyFor(req);

    if (adminRateLimiter.isLocked(rateLimitKey)) {
        logRateLimit(req, '/api/admin/login', 3);
        res.status(429).json({
            error: 'リクエストが多すぎます。しばらく後に再試行してください。',
            isAdmin: false,
            retryAfter: adminRateLimiter.getRetryAfterSeconds(rateLimitKey),
        });
        return;
    }

    if (typeof username !== 'string' || typeof password !== 'string') {
        adminRateLimiter.recordFailure(rateLimitKey);
        res.status(400).json({ isAdmin: false });
        return;
    }

    if (username.length > MAX_CREDENTIAL_LENGTH || password.length > MAX_CREDENTIAL_LENGTH) {
        adminRateLimiter.recordFailure(rateLimitKey);
        logSuspiciousRequest(req, 'oversized admin credentials', {
            passwordLength: password.length,
            usernameLength: username.length,
        });
        res.status(400).json({ error: 'ユーザー名またはパスワードが長すぎます', isAdmin: false });
        return;
    }

    const origin = req.headers.origin || req.headers.referer;
    const allowedOrigin = new URL(SERVER_ENV.CLIENT_URL).origin;

    if (!origin) {
        adminRateLimiter.recordFailure(rateLimitKey);
        logSuspiciousRequest(req, 'admin login without an Origin header');
        res.status(403).json({ error: 'オリジンヘッダーが見つかりません', isAdmin: false });
        return;
    }

    const requestOrigin = origin.startsWith('http') ? new URL(origin).origin : origin;
    if (requestOrigin !== allowedOrigin) {
        adminRateLimiter.recordFailure(rateLimitKey);
        logSuspiciousRequest(req, 'cross-origin admin login attempt', {
            expected: allowedOrigin,
            origin: requestOrigin,
        });
        res.status(403).json({ error: 'クロスオリジンリクエストは許可されていません', isAdmin: false });
        return;
    }

    const isAdminValid = adminAuthenticator.authenticate(username, password);
    const isPathfinderValid = pathfinderAuthenticator?.authenticate(username, password) ?? false;

    if (!isAdminValid && !isPathfinderValid) {
        adminRateLimiter.recordFailure(rateLimitKey);
        logAuthFailure(req, 'invalid admin credentials', username);
        res.status(401).json({ isAdmin: false });
        return;
    }

    adminRateLimiter.recordSuccess(rateLimitKey);

    const session = await loginSession.getSession(req.headers.cookie ?? '');
    const roleSet = new Set(getSessionRoles(session));
    if (isAdminValid) {
        roleSet.add('admin');
        session.set('admin', true);
    }
    if (isPathfinderValid) roleSet.add('pathfinder');
    const roles = [...roleSet];
    session.set('roles', roles);

    res.setHeader('Set-Cookie', await loginSession.commitSession(session));
    logger.info('Admin login successful', { roles, username });
    res.json({ isAdmin: roles.includes('admin'), roles });
});

adminRouter.post('/logout', express.json(), async (req, res) => {
    const session = await loginSession.getSession(req.headers.cookie ?? '');
    const body = req.body as Record<string, unknown>;
    const requestedRole: SessionRole | undefined = body.role === 'admin' || body.role === 'pathfinder'
        ? body.role
        : undefined;

    // A specific role logs out only that role, keeping the others signed in;
    // omitting it clears every role (used when the session itself is discarded).
    const remaining = requestedRole ? getSessionRoles(session).filter(r => r !== requestedRole) : [];
    session.unset('admin');
    session.unset('roles');
    if (remaining.length > 0) {
        session.set('roles', remaining);
        if (remaining.includes('admin')) session.set('admin', true);
    }

    const setCookieHeader = await loginSession.commitSession(session);
    res.setHeader('Set-Cookie', setCookieHeader);

    const roles = getSessionRoles(await loginSession.getSession(setCookieHeader));
    logger.info('Admin logout successful', { remainingRoles: roles, role: requestedRole ?? 'all' });
    res.json({ isAdmin: roles.includes('admin'), roles });
});

adminRouter.get('/status', async (req, res) => {
    const session = await loginSession.getSession(req.headers.cookie ?? '');
    // getSessionRoles back-fills 'admin' for sessions created before roles existed,
    // so pre-deploy admin logins see their role features without re-authenticating.
    const roles = getSessionRoles(session);
    res.json({ isAdmin: roles.includes('admin'), roles });
});
