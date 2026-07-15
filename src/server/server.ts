import { SERVER_ENV } from '@/app/env.server';
import {
    getSessionRoles,
    hasPathfinderAccess as sessionHasPathfinderAccess,
    isAdminSession as sessionIsAdmin,
    loginSession,
    type SessionRole,
} from '@/app/sessions.server';
import logger, { replaceConsoleWithLogger } from '@/server/logger';
import { type ServerContext, serverContext } from '@/shared/types/server';
import { createRequestHandler } from '@react-router/express';
import express from 'express';
import { RouterContextProvider } from 'react-router';
import { bootstrap } from './bootstrap';
import configureApp, { type ConfigureAppResult } from './configureApp';
import { createAdminAuthenticator } from './middleware/adminAuth';
import { createAdminRateLimiter } from './middleware/adminRateLimiter';
import { getRequestLogService } from './requestLog/requestLogService';
import { RateLimiterManager } from './services/rateLimiterManager';
import { getConfig, safeNumber } from './utils/configUtils';

const app: express.Application = express();
const config = getConfig();

const adminUser = config.getString('ADMIN_USER') || SERVER_ENV.ADMIN_USER;
const adminPassword = config.getString('ADMIN_PASSWORD') || SERVER_ENV.ADMIN_PASSWORD;
const adminAuthenticator = createAdminAuthenticator(adminUser, adminPassword);
const adminRateLimiter = createAdminRateLimiter(3, 60 * 1000);

const pathfinderUser = config.getString('PATHFINDER_USER') || SERVER_ENV.PATHFINDER_USER;
const pathfinderPassword = config.getString('PATHFINDER_PASSWORD') || SERVER_ENV.PATHFINDER_PASSWORD;
// The pathfinder role is opt-in: without credentials configured, its login is simply disabled.
const pathfinderAuthenticator = pathfinderUser && pathfinderPassword
    ? createAdminAuthenticator(pathfinderUser, pathfinderPassword)
    : undefined;

const portCandidate = config.getNumber('PORT');
const port = typeof portCandidate === 'number' && !Number.isNaN(portCandidate)
    ? portCandidate
    : safeNumber(SERVER_ENV.PORT, 3000);

if (config.nodeEnv !== 'test') replaceConsoleWithLogger();
const {
    appShutdownHandlers,
    socketServer,
    metricsManager,
    youtubeService,
} = await bootstrap();

const server = app.listen(port, () => {
    const envName = config.nodeEnv;
    logger.info(
        `Server[${envName}] running at ${port} | ${new Date().toLocaleString('ja-JP')}`,
    );
});
server.keepAliveTimeout = 5000;
server.headersTimeout = 6000;

server.on('error', (err: Error) => {
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
            server: {
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
            const clientIp = req.ip || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
            const rateLimitKey = typeof clientIp === 'string' ? clientIp : clientIp[0] || 'unknown';
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

            const MAX_CREDENTIAL_LENGTH = 256;
            if (username.length > MAX_CREDENTIAL_LENGTH || password.length > MAX_CREDENTIAL_LENGTH) {
                adminRateLimiter.recordFailure(rateLimitKey);
                res.status(400).json({ isAdmin: false, error: 'ユーザー名またはパスワードが長すぎます' });
                return;
            }

            const origin = req.headers.origin || req.headers.referer;
            const clientUrl = config.getString('CLIENT_URL') || SERVER_ENV.CLIENT_URL;
            const allowedOrigin = new URL(clientUrl).origin;

            if (!origin) {
                adminRateLimiter.recordFailure(rateLimitKey);
                logger.warn('CSRF protection: Missing origin header');
                res.status(403).json({
                    isAdmin: false,
                    error: 'オリジンヘッダーが見つかりません',
                });
                return;
            }

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

            const isAdminValid = adminAuthenticator.authenticate(username, password);
            const isPathfinderValid = pathfinderAuthenticator?.authenticate(username, password) ?? false;

            if (!isAdminValid && !isPathfinderValid) {
                adminRateLimiter.recordFailure(rateLimitKey);
                logger.info('Admin login failed', { ip: rateLimitKey });
                res.status(401).json({ isAdmin: false });
                return;
            }

            adminRateLimiter.recordSuccess(rateLimitKey);

            const cookieHeader = req.headers.cookie ?? '';
            const session = await loginSession.getSession(cookieHeader);
            const roleSet = new Set(getSessionRoles(session));
            if (isAdminValid) {
                roleSet.add('admin');
                session.set('admin', true);
            }
            if (isPathfinderValid) roleSet.add('pathfinder');
            const roles = [...roleSet];
            session.set('roles', roles);

            const setCookieHeader = await loginSession.commitSession(session);
            res.setHeader('Set-Cookie', setCookieHeader);

            logger.info('Admin login successful', { roles, username });
            res.json({ isAdmin: roles.includes('admin'), roles });
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
            const body = req.body as Record<string, unknown>;
            const requestedRole: SessionRole | undefined = body.role === 'admin' || body.role === 'pathfinder'
                ? body.role
                : undefined;

            // A specific role logs out only that role, keeping the others signed in;
            // omitting it clears every role (used when the session itself is discarded).
            const remaining = requestedRole
                ? getSessionRoles(session).filter(r => r !== requestedRole)
                : [];
            session.unset('admin');
            session.unset('roles');
            if (remaining.length > 0) {
                session.set('roles', remaining);
                if (remaining.includes('admin')) session.set('admin', true);
            }

            const setCookieHeader = await loginSession.commitSession(session);
            res.setHeader('Set-Cookie', setCookieHeader);

            const roles = getSessionRoles(await loginSession.getSession(setCookieHeader));
            logger.info('Admin logout successful', { role: requestedRole ?? 'all', remainingRoles: roles });
            res.json({ isAdmin: roles.includes('admin'), roles });
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
            // getSessionRoles back-fills 'admin' for sessions created before roles existed,
            // so pre-deploy admin logins see their role features without re-authenticating.
            const roles = getSessionRoles(session);
            res.json({ isAdmin: roles.includes('admin'), roles });
        } catch (error: unknown) {
            logger.error('Error in /api/admin/status endpoint', { error });
            res.status(500).json({ isAdmin: false });
        }
    };

    void handleStatus();
});

const toBoolean = (raw: string, fallback: boolean): boolean => {
    const lower = raw.toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes') return true;
    if (lower === 'false' || lower === '0' || lower === 'no') return false;
    return fallback;
};

const isDiagnosticsEnabled = () => toBoolean(config.getString('DIAG_MEM_ENABLED'), true);
const requireAdminSecret = () => {
    return toBoolean(config.getString('DIAG_MEM_REQUIRE_ADMIN_SECRET'), false);
};

async function isAdminSession(req: express.Request): Promise<boolean> {
    const session = await loginSession.getSession(req.headers.cookie ?? '');
    return sessionIsAdmin(session);
}

async function hasPathfinderAccess(req: express.Request): Promise<boolean> {
    const session = await loginSession.getSession(req.headers.cookie ?? '');
    return sessionHasPathfinderAccess(session);
}

const REQUEST_LOG_LIMIT_DEFAULT = 50;
const REQUEST_LOG_LIMIT_MAX = 500;
const REQUESTER_HASH_PATTERN = /^[a-f0-9]{64}$/i;
const REQUESTER_HASH_PREFIX_PATTERN = /^[a-f0-9]{4,64}$/i;

function clampRequestLogLimit(raw: unknown): number {
    const value = typeof raw === 'number'
        ? raw
        : (typeof raw === 'string' ? Number.parseInt(raw, 10) : NaN);
    if (!Number.isFinite(value)) return REQUEST_LOG_LIMIT_DEFAULT;
    return Math.min(Math.max(value, 1), REQUEST_LOG_LIMIT_MAX);
}

function parseRequesterHashFilter(rawHash: unknown, rawPrefix: unknown): {
    hashPrefix?: string;
    requesterHash?: string;
} {
    const hash = typeof rawHash === 'string' ? rawHash.trim() : '';
    if (REQUESTER_HASH_PATTERN.test(hash) || hash === 'external') return { requesterHash: hash };

    const hashPrefix = typeof rawPrefix === 'string' ? rawPrefix.trim() : '';
    if (REQUESTER_HASH_PREFIX_PATTERN.test(hashPrefix)) return { hashPrefix };

    return {};
}

function getRequestLogQueryBody(raw: unknown): {
    hashPrefix?: unknown;
    limit?: unknown;
    requesterHash?: unknown;
} {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const body = raw as Record<string, unknown>;
    return {
        hashPrefix: body.hashPrefix,
        limit: body.limit,
        requesterHash: body.requesterHash,
    };
}

app.get('/api/admin/diag/memory', (req, res) => {
    const handleDiag = async (): Promise<void> => {
        try {
            if (!isDiagnosticsEnabled()) {
                res.status(404).json({ ok: false, error: 'disabled' });
                return;
            }
            const isAdmin = await isAdminSession(req);
            if (!isAdmin) {
                res.status(401).json({ ok: false, error: 'unauthorized' });
                return;
            }

            if (requireAdminSecret()) {
                const headerSecret = req.headers['x-admin-secret'];
                const adminSecret = config.getString('ADMIN_SECRET');
                if (
                    typeof headerSecret !== 'string'
                    || headerSecret.length === 0
                    || headerSecret !== adminSecret
                ) {
                    res.status(403).json({ ok: false, error: 'forbidden' });
                    return;
                }
            }

            const mem = process.memoryUsage();
            const processWithInternals = process as NodeJS.Process & {
                _getActiveHandles?: () => unknown[];
                _getActiveRequests?: () => unknown[];
                getActiveResourcesInfo?: () => string[];
            };
            const activeResources = processWithInternals.getActiveResourcesInfo?.();
            const activeHandleCount = processWithInternals._getActiveHandles?.().length;
            const activeRequestCount = processWithInternals._getActiveRequests?.().length;
            const socketDiagnostics = socketServer.getDiagnostics();
            const youtubeDiagnostics = youtubeService.getDiagnostics();
            const rateLimiterStats = RateLimiterManager.getInstance().getStats();

            res.json({
                ok: true,
                data: {
                    memory: {
                        rss: mem.rss,
                        heapUsed: mem.heapUsed,
                        heapTotal: mem.heapTotal,
                        external: mem.external,
                        arrayBuffers: mem.arrayBuffers,
                    },
                    process: {
                        activeHandleCount,
                        activeRequestCount,
                        activeResourcesCount: activeResources?.length,
                        uptimeSec: Math.round(process.uptime()),
                        pid: process.pid,
                    },
                    socket: socketDiagnostics,
                    youtube: youtubeDiagnostics,
                    rateLimiters: rateLimiterStats,
                    timestamp: new Date().toISOString(),
                },
            });
        } catch (error: unknown) {
            logger.error('Error in /api/admin/diag/memory endpoint', { error });
            res.status(500).json({ ok: false, error: 'internal_error' });
        }
    };

    void handleDiag();
});

app.post('/api/admin/request-logs/query', express.json({ limit: '8kb' }), (req, res) => {
    const handleRequestLogQuery = async (): Promise<void> => {
        try {
            res.setHeader('Cache-Control', 'no-store');
            const canAccess = await hasPathfinderAccess(req);
            if (!canAccess) {
                res.status(401).json({ error: 'unauthorized', ok: false });
                return;
            }

            const body = getRequestLogQueryBody(req.body);
            const filter = parseRequesterHashFilter(body.requesterHash, body.hashPrefix);
            if (!filter.requesterHash && !filter.hashPrefix) {
                res.status(400).json({ ok: false, error: 'invalid_requester_hash' });
                return;
            }

            const entries = await getRequestLogService().query({
                ...filter,
                limit: clampRequestLogLimit(body.limit),
            });

            res.json({ entries, ok: true });
        } catch (error: unknown) {
            logger.error('Error in /api/admin/request-logs/query endpoint', { error });
            res.status(500).json({ ok: false, error: 'internal_error' });
        }
    };

    void handleRequestLogQuery();
});

app.get('/api/admin/request-logs', (req, res) => {
    const handleRequestLogs = async (): Promise<void> => {
        try {
            res.setHeader('Cache-Control', 'no-store');
            const canAccess = await hasPathfinderAccess(req);
            if (!canAccess) {
                res.status(401).json({ error: 'unauthorized', ok: false });
                return;
            }

            const limit = clampRequestLogLimit(req.query.limit);
            const filter = parseRequesterHashFilter(req.query.hash, req.query.hashPrefix);

            const entries = await getRequestLogService().query({
                ...filter,
                limit,
            });

            res.json({ entries, ok: true });
        } catch (error: unknown) {
            logger.error('Error in /api/admin/request-logs endpoint', { error });
            res.status(500).json({ ok: false, error: 'internal_error' });
        }
    };

    void handleRequestLogs();
});

app.get('/api/admin/request-logs/:hashPrefix', (req, res) => {
    const handleUserLogs = async (): Promise<void> => {
        try {
            res.setHeader('Cache-Control', 'no-store');
            const canAccess = await hasPathfinderAccess(req);
            if (!canAccess) {
                res.status(401).json({ error: 'unauthorized', ok: false });
                return;
            }

            const hashPrefix = req.params.hashPrefix;
            const filter = parseRequesterHashFilter(req.query.hash, hashPrefix);
            if (!filter.requesterHash && !filter.hashPrefix) {
                res.status(400).json({ ok: false, error: 'invalid_hash_prefix' });
                return;
            }

            const limit = clampRequestLogLimit(req.query.limit);

            const entries = await getRequestLogService().query({
                ...filter,
                limit,
            });

            res.json({ entries, hashPrefix, ok: true });
        } catch (error: unknown) {
            logger.error('Error in /api/admin/request-logs/:hashPrefix endpoint', { error });
            res.status(500).json({ ok: false, error: 'internal_error' });
        }
    };

    void handleUserLogs();
});

app.all(
    '*splat',
    createRequestHandler({
        build: configResult.buildValue,
        getLoadContext: () => {
            const contextProvider = new RouterContextProvider();
            contextProvider.set(
                serverContext,
                {
                    httpRateLimiter: socketServer.getHttpRateLimiter(),
                    io: socketServer,
                } satisfies ServerContext,
            );
            return contextProvider;
        },
    }),
);

logger.info('All middleware and routes registered successfully', {
    environment: config.nodeEnv,
    port,
    timestamp: new Date().toISOString(),
});
