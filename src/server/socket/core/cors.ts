import { SERVER_ENV } from '@/server/env.server';
import { withErrorHandler } from '@/shared/utils/errors';
import type { Request } from 'express';
import { isProduction } from '../../config';
import logger from '../../logger';
import { logCorsViolation } from '../../utils/securityLogger';

export interface CorsConfig {
    origins: string[];
    allowAllOrigins: boolean;
    allowExtensionOrigins: boolean;
}

export const buildCorsConfig = (): CorsConfig => {
    const corsRaw = SERVER_ENV.CORS_ORIGINS || SERVER_ENV.CLIENT_URL;
    const safeCorsRaw = corsRaw || '';
    const origins = (safeCorsRaw || '')
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);

    const isDev = !isProduction;
    const port = SERVER_ENV.PORT;

    if (isDev) {
        const currentOrigin = `http://localhost:${port}`;
        if (!origins.includes(currentOrigin)) origins.push(currentOrigin);
    }
    const allowAllOrigins = isDev && origins.length === 0;

    const allowExtensionOrigins = isProduction ? false : (SERVER_ENV.ALLOW_EXTENSION_ORIGINS ?? false);

    if (
        allowExtensionOrigins
        && !origins.some(o => o === 'chrome-extension://')
    ) {
        origins.push('chrome-extension://');
    }

    if (!isProduction) {
        logger.info('SocketServerInstance CORS config', {
            allowAllOrigins,
            allowExtensionOrigins,
            environment: SERVER_ENV.NODE_ENV,
            origins,
        });
    }

    return { allowAllOrigins, allowExtensionOrigins, origins };
};

/**
 * The single source of truth for "may this origin connect?", shared by socket.io's
 * `allowRequest` gate and the CORS origin callback — they used to decide this separately
 * and had already drifted apart on how extension origins were matched.
 *
 * An entry that is only a scheme (e.g. `chrome-extension://`) acts as a prefix rule
 * covering every origin on that scheme, and applies only when extension origins are
 * enabled. Everything else must match exactly.
 */
export const isOriginAllowed = (origin: string, cfg: CorsConfig): boolean => {
    if (cfg.allowAllOrigins) return true;
    if (cfg.origins.includes(origin)) return true;
    if (!cfg.allowExtensionOrigins) return false;
    return cfg.origins.some(allowed => allowed.endsWith('://') && origin.startsWith(allowed));
};

export const makeOriginChecker = (
    cfg: CorsConfig,
): (
    origin: unknown,
    callback: (err: Error | null, allow?: boolean) => void,
) => void => {
    const originChecker = withErrorHandler(
        (
            origin: unknown,
            callback: (err: Error | null, allow?: boolean) => void,
        ) => {
            if (origin == undefined) {
                logger.info('socket connection: no origin (server/API)', {
                    timestamp: new Date().toISOString(),
                });
                callback(null, true);
                return;
            }

            if (typeof origin !== 'string') {
                logger.warn('socket connection: non-string origin', {
                    origin,
                    timestamp: new Date().toISOString(),
                });
                callback(new Error('Invalid origin type'));
                return;
            }

            if (isOriginAllowed(origin, cfg)) {
                logger.info('socket connection: origin allowed', {
                    origin,
                    timestamp: new Date().toISOString(),
                });
                callback(null, true);
                return;
            }

            logCorsViolation({} as Request, origin, 'not in allowed list');
            logger.warn('CORS origin rejected', {
                allowExtensionOrigins: cfg.allowExtensionOrigins,
                allowedOrigins: cfg.origins,
                origin,
            });
            callback(new Error('CORS origin not allowed'));
        },
        'makeOriginChecker',
    );

    return originChecker;
};
