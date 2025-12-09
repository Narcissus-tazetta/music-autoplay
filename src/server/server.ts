import { SERVER_ENV } from '@/app/env.server';
import { loginSession } from '@/app/sessions.server';
import logger, { replaceConsoleWithLogger } from '@/server/logger';
import type { ServerContext } from '@/shared/types/server';
import { createRequestHandler } from '@react-router/express';
import express from 'express';
import { bootstrap } from './bootstrap';
import configureApp, { type ConfigureAppResult } from './configureApp';
import { createAdminAuthenticator } from './middleware/adminAuth';
import { createAdminRateLimiter } from './middleware/adminRateLimiter';
import { getConfig, safeNumber } from './utils/configUtils';

const app = express();
const config = getConfig();

const adminUser = config.getString('ADMIN_USER') || SERVER_ENV.ADMIN_USER || 'admin';
const adminPassword = config.getString('ADMIN_PASSWORD') || SERVER_ENV.ADMIN_PASSWORD || 'password123';
const adminAuthenticator = createAdminAuthenticator(adminUser, adminPassword);
const adminRateLimiter = createAdminRateLimiter(3, 60 * 1000);

const portCandidate = config.getNumber('PORT');
const port = typeof portCandidate === 'number' && !Number.isNaN(portCandidate)
    ? portCandidate
    : safeNumber(SERVER_ENV.PORT, 3000);

if (config.nodeEnv !== 'test') replaceConsoleWithLogger();
const { appShutdownHandlers, socketServer, metricsManager } = await bootstrap();

const server = app.listen(port, () => {
    const envName = config.nodeEnv;
    logger.info(
        `Server[${envName}] running at ${port} | ${new Date().toLocaleString('ja-JP')}`,
    );
});
server.keepAliveTimeout = 5000;
server.headersTimeout = 6000;

server.on('error', err => {
    if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
        logger.error(
            `Port ${port} is already in use. Please choose a different port or stop the existing process.`,
        );
        process.exit(1);
    } else {
        logger.error('HTTP server error during startup', { error: err });
        throw err;
    }
});

await socketServer.init(server);

const viteDevServer = config.nodeEnv === 'production'
    ? null
    : await import('vite').then(vite =>
        vite.createServer({
            optimizeDeps: {
                include: ['socket.io-client', 'framer-motion', 'zustand'],
            },
            server: {
                hmr: false,
                middlewareMode: true,
            },
        })
    );

let isShuttingDown = false;

async function gracefulShutdown() {
    if (isShuttingDown) {
        logger.info('graceful shutdown already in progress, ignoring');
        return;
    }
    isShuttingDown = true;

    const shutdownTimeoutCandidate = config.getNumber('SHUTDOWN_TIMEOUT_MS');
    const shutdownTimeout = typeof shutdownTimeoutCandidate === 'number'
            && !Number.isNaN(shutdownTimeoutCandidate)
        ? shutdownTimeoutCandidate
        : safeNumber(SERVER_ENV.SHUTDOWN_TIMEOUT_MS, 5000);
    const forceExit = () => {
        logger.error('graceful shutdown timeout, forcing exit');
        process.exit(1);
    };

    const timer = setTimeout(forceExit, shutdownTimeout);

    try {
        logger.info('graceful shutdown initiated', { shutdownTimeout });

        try {
            await socketServer.close();
            logger.info('socket.io closed');
        } catch (error) {
            const errorMsg = error && typeof error === 'object' && 'message' in error
                ? String(error.message)
                : String(error);
            if (
                errorMsg.includes('not running')
                || errorMsg.includes('already closed')
            ) {
                logger.info('socket.io already closed during shutdown');
            } else {
                logger.warn('socket.io close failed', {
                    error: error,
                });
            }
        }
        if (viteDevServer) {
            try {
                await viteDevServer.close();
                logger.info('vite dev server closed');
            } catch (error) {
                logger.warn('vite dev server close failed', { error });
            }
        }
        await new Promise<void>((resolve, reject) => {
            if (!server.listening) {
                logger.info('http server already closed');
                resolve();
                return;
            }
            server.closeAllConnections();

            server.close((err?: Error) => {
                if (err) {
                    if (err.message.includes('Server is not running')) {
                        logger.info('http server already closed during shutdown');
                        resolve();
                        return;
                    }
                    reject(err);
                    return;
                }
                resolve();
            });
        });
        logger.info('http server closed');

        for (const h of appShutdownHandlers) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await h();
            } catch (error) {
                logger.warn('shutdown handler failed', { error: error });
            }
        }

        clearTimeout(timer);
        logger.info('graceful shutdown complete, exiting');
        process.exit(0);
    } catch (error) {
        clearTimeout(timer);
        const errorMsg = error && typeof error === 'object' && 'message' in error
            ? String(error.message)
            : String(error);
        if (
            errorMsg.includes('Server is not running')
            || errorMsg.includes('already closed')
        ) {
            logger.info('graceful shutdown complete (server already stopped)');
            process.exit(0);
        } else {
            logger.error('graceful shutdown failed', { error: error });
            process.exit(1);
        }
    }
}

process.on('SIGINT', () => {
    if (!isShuttingDown) {
        logger.info('received SIGINT, initiating graceful shutdown');
        void gracefulShutdown();
    }
});
process.on('SIGTERM', () => {
    if (!isShuttingDown) {
        logger.info('received SIGTERM, initiating graceful shutdown');
        void gracefulShutdown();
    }
});
process.on('SIGUSR2', () => {
    if (!isShuttingDown) {
        logger.info(
            'received SIGUSR2 (nodemon restart), initiating graceful shutdown',
        );
        void gracefulShutdown();
    }
});

let configResult: ConfigureAppResult;
try {
    configResult = await configureApp(app, () => socketServer, viteDevServer);
    logger.info('App configuration completed successfully');
} catch (error: unknown) {
    logger.error('Failed to configure app', { error });
    process.exit(1);
}
app.get('/api/metrics', (req, res) => {
    try {
        const metrics = metricsManager.getMetrics();
        res.json({
            data: {
                apiMusics: metrics.apiMusics,
                rpcGetAllMusics: metrics.rpcGetAllMusics,
            },
            status: 'ok',
        });
    } catch (error: unknown) {
        logger.error('Error in /api/metrics endpoint', { error });
        res.status(500).json({ error: 'Internal server error', ok: false });
    }
});

app.get('/api/socket-info', (req, res) => {
    try {
        const socketPath = config.getString('SOCKET_PATH');

        const corsRaw = config.getString('CORS_ORIGINS');
        const corsOrigins = (corsRaw || '')
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean);

        res.json({
            ok: true,
            socket: {
                corsOrigins,
                serverUrl: `http://localhost:${port}`,
                socketUrl: `http://localhost:${port}${socketPath}`,
                wsUrl: `ws://localhost:${port}${socketPath}`,
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error: unknown) {
        logger.error('Error in /api/socket-info endpoint', { error });
        const safe = typeof error === 'string'
            ? error
            : (error instanceof Error
                ? error.message
                : JSON.stringify(error));
        res.status(500).json({ error: safe, ok: false });
    }
});

app.post('/api/admin/login', express.json(), (req, res) => {
    const handleLogin = async (): Promise<void> => {
        try {
            const body = req.body as Record<string, unknown>;
            const username = body.username;
            const password = body.password;

            // Get client IP for rate limiting (prevents username enumeration)
            const clientIp = req.ip || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
            const rateLimitKey = typeof clientIp === 'string' ? clientIp : clientIp[0] || 'unknown';

            // Check rate limit BEFORE any validation (prevents username enumeration)
            if (adminRateLimiter.isLocked(rateLimitKey)) {
                const retryAfter = adminRateLimiter.getRetryAfterSeconds(rateLimitKey);
                logger.info('Admin login attempt from rate-limited IP', { ip: rateLimitKey });
                res.status(429).json({
                    isAdmin: false,
                    error: 'リクエストが多すぎます。しばらく後に再試行してください。',
                    retryAfter,
                });
                return;
            }

            if (typeof username !== 'string' || typeof password !== 'string') {
                adminRateLimiter.recordFailure(rateLimitKey);
                res.status(400).json({ isAdmin: false });
                return;
            }

            // Enforce maximum length for username and password
            const MAX_CREDENTIAL_LENGTH = 256;
            if (username.length > MAX_CREDENTIAL_LENGTH || password.length > MAX_CREDENTIAL_LENGTH) {
                adminRateLimiter.recordFailure(rateLimitKey);
                res.status(400).json({ isAdmin: false, error: 'Username or password too long' });
                return;
            }

            // CSRF PROTECTION: Check origin/referer to prevent cross-origin requests
            // This endpoint uses cookies for session state, so CSRF protection is essential
            const origin = req.headers.origin || req.headers.referer;
            const clientUrl = config.getString('CLIENT_URL') || SERVER_ENV.CLIENT_URL;
            const allowedOrigin = new URL(clientUrl).origin;

            // Require origin header for CSRF protection
            if (!origin) {
                adminRateLimiter.recordFailure(rateLimitKey);
                logger.warn('CSRF protection: Missing origin header');
                res.status(403).json({
                    isAdmin: false,
                    error: 'Missing origin header',
                });
                return;
            }

            // Strict origin validation (exact match)
            const requestOrigin = origin.startsWith('http') ? new URL(origin).origin : origin;
            if (requestOrigin !== allowedOrigin) {
                adminRateLimiter.recordFailure(rateLimitKey);
                logger.warn('Potential CSRF attack: Cross-origin admin login attempt', {
                    origin: requestOrigin,
                    expected: allowedOrigin,
                });
                res.status(403).json({
                    isAdmin: false,
                    error: 'クロスオリジンリクエストは許可されていません',
                });
                return;
            }

            const isValid = adminAuthenticator.authenticate(username, password);

            if (!isValid) {
                adminRateLimiter.recordFailure(rateLimitKey);
                logger.info('Admin login failed', { username });
                res.status(401).json({ isAdmin: false });
                return;
            }

            adminRateLimiter.recordSuccess(rateLimitKey);

            const cookieHeader = req.headers.cookie ?? '';
            const session = await loginSession.getSession(cookieHeader);
            session.set('admin', true);

            const setCookieHeader = await loginSession.commitSession(session);
            res.setHeader('Set-Cookie', setCookieHeader);

            logger.info('Admin login successful', { username });
            res.json({ isAdmin: true });
        } catch (error: unknown) {
            logger.error('Error in /api/admin/login endpoint', { error });
            res.status(500).json({ isAdmin: false });
        }
    };

    void handleLogin();
});

app.post('/api/admin/logout', express.json(), (req, res) => {
    const handleLogout = async (): Promise<void> => {
        try {
            const cookieHeader = req.headers.cookie ?? '';
            const session = await loginSession.getSession(cookieHeader);
            session.unset('admin');

            const setCookieHeader = await loginSession.commitSession(session);
            res.setHeader('Set-Cookie', setCookieHeader);

            logger.info('Admin logout successful');
            res.json({ isAdmin: false });
        } catch (error: unknown) {
            logger.error('Error in /api/admin/logout endpoint', { error });
            res.status(500).json({ isAdmin: false });
        }
    };

    void handleLogout();
});

app.get('/api/admin/status', (req, res) => {
    const handleStatus = async (): Promise<void> => {
        try {
            const cookieHeader = req.headers.cookie ?? '';
            const session = await loginSession.getSession(cookieHeader);
            const isAdmin = session.get('admin') === true;
            res.json({ isAdmin });
        } catch (error: unknown) {
            logger.error('Error in /api/admin/status endpoint', { error });
            res.status(500).json({ isAdmin: false });
        }
    };

    void handleStatus();
});

app.all(
    '*splat',
    createRequestHandler({
        build: configResult.buildValue,
        getLoadContext: () =>
            ({
                httpRateLimiter: socketServer.getHttpRateLimiter(),
                io: socketServer,
            }) satisfies ServerContext,
    }),
);

logger.info('All middleware and routes registered successfully', {
    environment: config.nodeEnv,
    port,
    timestamp: new Date().toISOString(),
});
