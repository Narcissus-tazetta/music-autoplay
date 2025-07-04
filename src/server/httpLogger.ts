import type { NextFunction, Request, Response } from 'express';
import { logger } from './logger';

/**
 * Express用HTTPログミドルウェア
 * リクエスト/レスポンスを自動ログ
 */
export const httpLogger = (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const originalSend = res.send;

    res.send = function(body) {
        const duration = Date.now() - start;
        const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

        const logMessage = `${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`;

        logger.log(logLevel, logMessage, {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            userAgent: req.get('user-agent'),
            ip: req.ip || req.socket.remoteAddress,
            component: 'http',
        });

        return originalSend.call(this, body);
    };

    next();
};

export default httpLogger;
