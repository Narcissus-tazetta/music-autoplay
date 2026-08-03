import type { NextFunction, Request, Response } from 'express';
import logger from '../logger';

/**
 * Terminal error middleware.
 *
 * Express 5 forwards rejections from async handlers here automatically, which is why the
 * routes no longer wrap every body in `const handleX = async () => {...}; void handleX();`
 * plus its own try/catch and 500 response - that boilerplate was repeated seven times.
 *
 * Verified on express 5.2.1: a handler that rejects reaches this middleware and produces no
 * unhandled rejection. oxlint's `no-async-endpoint-handlers` assumes Express 4 semantics and
 * is therefore switched off in .oxlintrc.json.
 */
export function errorHandler(
    error: unknown,
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    if (res.headersSent) {
        next(error);
        return;
    }

    logger.error('unhandled route error', {
        error,
        method: req.method,
        path: req.path,
        requestId: req.requestId,
    });

    res.status(500).json({ error: 'internal_error', ok: false });
}
