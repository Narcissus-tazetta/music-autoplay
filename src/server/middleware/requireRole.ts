import {
    hasPathfinderAccess as sessionHasPathfinderAccess,
    isAdminSession as sessionIsAdmin,
    loginSession,
} from '@/server/sessions.server';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Session-role guards. Each protected route used to re-open the session and check the role
 * inline; expressing it as middleware keeps the handlers to their actual work.
 */
function guard(check: (session: Awaited<ReturnType<typeof loginSession.getSession>>) => boolean): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
        const session = await loginSession.getSession(req.headers.cookie ?? '');
        if (!check(session)) {
            res.status(401).json({ error: 'unauthorized', ok: false });
            return;
        }
        next();
    };
}

export const requireAdmin = guard(sessionIsAdmin);
export const requirePathfinder = guard(sessionHasPathfinderAccess);
