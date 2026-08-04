import { SERVER_ENV } from '@/app/env.server';
import logger from '@/server/logger';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { ServerBuild } from 'react-router';
import { isProduction } from './config';
import { getAllowedActionOrigins } from './reactRouter/actionOrigins';
import { metricsManager } from './services/metricsManager';
import type { SocketServerInstance } from './socket/socketServer';

export interface ConfigureAppResult {
    buildValue: ServerBuild | (() => Promise<ServerBuild>);
}

function withAllowedActionOrigins(build: ServerBuild, allowedActionOrigins: string[]): ServerBuild {
    return {
        ...build,
        allowedActionOrigins,
    };
}

function createBuildValue(
    buildValue: ServerBuild | (() => Promise<ServerBuild>),
    allowedActionOrigins: string[],
): ServerBuild | (() => Promise<ServerBuild>) {
    if (typeof buildValue === 'function')
        return async () => withAllowedActionOrigins(await buildValue(), allowedActionOrigins);
    return withAllowedActionOrigins(buildValue, allowedActionOrigins);
}

export async function configureApp(
    app: express.Application,
    getIo: () => SocketServerInstance | null,
    viteDevServer: {
        middlewares?: unknown;
        ssrLoadModule?: (s: string) => Promise<unknown>;
    } | null,
): Promise<ConfigureAppResult> {
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    baseUri: ["'self'"],
                    connectSrc: ["'self'", 'ws:', 'wss:'],
                    defaultSrc: ["'self'"],
                    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
                    frameSrc: ['https://www.youtube.com'],
                    imgSrc: [
                        "'self'",
                        'data:',
                        'https://i.ytimg.com',
                        'https://i1.ytimg.com',
                        'https://i2.ytimg.com',
                        'https://i3.ytimg.com',
                        'https://i4.ytimg.com',
                    ],
                    objectSrc: ["'none'"],
                    scriptSrc: [
                        "'self'",
                        "'unsafe-inline'",
                        'https://www.youtube.com',
                        'https://s.ytimg.com',
                    ],
                    styleSrc: [
                        "'self'",
                        "'unsafe-inline'",
                        'https://fonts.googleapis.com',
                    ],
                },
            },
            crossOriginEmbedderPolicy: false,
            hsts: {
                includeSubDomains: true,
                maxAge: 31_536_000,
                preload: true,
            },
        }),
    );
    const enableHttpCompression = SERVER_ENV.ENABLE_HTTP_COMPRESSION
        ?? (SERVER_ENV.NODE_ENV !== 'production');
    if (enableHttpCompression) app.use(compression());
    app.disable('x-powered-by');

    app.use(
        (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction,
        ) => {
            const rid = typeof req.headers['x-request-id'] === 'string'
                ? req.headers['x-request-id']
                : randomUUID();
            req.requestId = rid;
            try {
                res.setHeader('X-Request-Id', rid);
            } catch (error) {
                logger.debug('bootstrap: failed to set X-Request-Id header', {
                    error: error,
                });
            }
            next();
        },
    );

    if (viteDevServer) {
        app.use(
            (
                req: express.Request,
                res: express.Response,
                next: express.NextFunction,
            ) => {
                try {
                    const nodeEnv = SERVER_ENV.NODE_ENV;
                    if (nodeEnv === 'production') {
                        next();
                        return;
                    }
                    const url = req.url;
                    const prefix = '/node_modules/.vite/deps/';
                    if (!url.startsWith(prefix)) {
                        next();
                        return;
                    }
                    const parts = url.slice(prefix.length).split('?');
                    const requested = parts[0];
                    const fsPath = path.join(
                        process.cwd(),
                        'node_modules',
                        '.vite',
                        'deps',
                        requested,
                    );
                    if (fs.existsSync(fsPath)) {
                        next();
                        return;
                    }
                    const depsDir = path.join(
                        process.cwd(),
                        'node_modules',
                        '.vite',
                        'deps',
                    );
                    if (!fs.existsSync(depsDir)) {
                        next();
                        return;
                    }
                    const files = fs.readdirSync(depsDir);
                    const base = requested.replace(/(\.[^.]*$)/, '');
                    const match = files.find((f: string) => f.startsWith(base));
                    if (match) {
                        const query = parts[1] ? `?${parts[1]}` : '';
                        req.url = prefix + match + query;
                    }
                } catch (error) {
                    logger.debug('vite deps rewrite middleware error', { error: error });
                }
                next();
            },
        );
        app.use(
            (viteDevServer as { middlewares: express.RequestHandler }).middlewares,
        );
    } else {
        // Vite emits content-hashed filenames under /assets, so a new build produces new URLs.
        // `immutable` with maxAge 0 contradicted itself and made browsers revalidate every asset
        // on every navigation.
        app.use(
            '/assets',
            express.static('build/client/assets', {
                immutable: true,
                maxAge: '1y',
            }),
        );
    }

    app.use(
        express.static('build/client', {
            maxAge: '0',
            setHeaders: (res, filePath) => {
                if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
            },
        }),
    );

    try {
        const socketPath = SERVER_ENV.SOCKET_PATH;
        if (!isProduction) {
            const prefixes = [
                ...new Set(
                    [socketPath, '/socket.io', '/api/socket.io'].filter(Boolean),
                ),
            ];
            for (const p of prefixes) {
                app.use(
                    p,
                    (
                        req: express.Request,
                        res: express.Response,
                        next: express.NextFunction,
                    ) => {
                        try {
                            const incomingOrigin = typeof req.headers.origin === 'string'
                                ? req.headers.origin
                                : 'null';
                            res.setHeader('Access-Control-Allow-Origin', incomingOrigin);
                            res.setHeader('Access-Control-Allow-Credentials', 'true');
                            res.setHeader('Vary', 'Origin');
                            try {
                                logger.info('bootstrap: socketPath middleware request', {
                                    method: req.method,
                                    mountedPath: p,
                                    origin: req.headers.origin ?? undefined,
                                    referer: req.headers.referer ?? undefined,
                                    ts: new Date().toISOString(),
                                    ua: req.headers['user-agent'] ?? undefined,
                                    url: req.url,
                                });
                            } catch (error) {
                                logger.debug(
                                    'bootstrap: failed to log socketPath middleware request',
                                    {
                                        error: error,
                                    },
                                );
                            }
                        } catch (error) {
                            logger.debug('bootstrap: failed to set dev socket CORS headers', {
                                error: error,
                            });
                        }
                        next();
                    },
                );
            }
        }
    } catch (error) {
        logger.debug(
            'bootstrap: error while registering dev socket CORS middleware',
            { error: error },
        );
    }

    app.get('/diagnostics/socket', (req, res) => {
        try {
            const origin = req.headers.origin;
            const socketPath = SERVER_ENV.SOCKET_PATH;
            const allowExtensionOrigins = SERVER_ENV.ALLOW_EXTENSION_ORIGINS === true;
            res.json({
                allowExtensionOrigins,
                debug: {
                    'SERVER_ENV.SOCKET_PATH': SERVER_ENV.SOCKET_PATH,
                    'computed socketPath': socketPath,
                    'process.env.SOCKET_PATH': SERVER_ENV.SOCKET_PATH,
                },
                note: 'Use this endpoint from extension or browser to check request origin and server config',
                ok: true,
                origin: origin ?? undefined,
                socketPath,
            });
        } catch (error) {
            const safe = typeof error === 'string'
                ? error
                : (error instanceof Error
                    ? error.message
                    : JSON.stringify(error));
            res.status(500).json({ error: safe, ok: false });
        }
    });
    app.get('/api/musics', (_req, res) => {
        const start = Date.now();
        try {
            const musics = [...(getIo()?.musicDB.values() ?? [])];
            metricsManager.updateApiMusics(Date.now() - start);
            res.json({ musics, ok: true });
        } catch (error) {
            metricsManager.updateApiMusics(Date.now() - start, true);
            logger.error('/api/musics failed', { error });
            res.status(500).json({ error: 'internal error', ok: false });
        }
    });
    {
        const morganFormat = SERVER_ENV.MORGAN_FORMAT;
        const skipSocketIo = SERVER_ENV.MORGAN_LOG_SOCKETIO !== true;
        app.use(
            morgan(morganFormat, {
                skip: (req: express.Request) => {
                    if (!skipSocketIo) return false;
                    try {
                        const reqPath = req.path ? req.path : req.url || '';
                        const socketPrefix = SERVER_ENV.SOCKET_PATH;
                        return (
                            reqPath.startsWith('/socket.io') || reqPath.startsWith(socketPrefix)
                        );
                    } catch (error) {
                        logger.debug('morgan: error while deciding skip', { error: error });
                        return false;
                    }
                },
                stream: {
                    write: (msg: string) => {
                        try {
                            logger.info(msg.trim());
                        } catch {
                            logger.info(msg.trim());
                        }
                    },
                },
            }),
        );
    }

    let buildValue: ServerBuild | (() => Promise<ServerBuild>);
    try {
        if (
            viteDevServer
            && typeof (viteDevServer as { ssrLoadModule?: unknown }).ssrLoadModule
                === 'function'
        ) {
            const loader = (
                viteDevServer as { ssrLoadModule: (s: string) => Promise<unknown> }
            ).ssrLoadModule;
            buildValue = () => loader('virtual:react-router/server-build') as Promise<ServerBuild>;
            logger.debug('Configured Vite SSR loader');
        } else {
            const builtPath = path.join(process.cwd(), 'build', 'server', 'index.js');
            const built = (await import(/* @vite-ignore */ builtPath)) as ServerBuild;
            buildValue = built;
            logger.debug('Loaded production build');
        }
    } catch (error: unknown) {
        const errorDetail = error instanceof Error
            ? { message: error.message, stack: error.stack }
            : { error };
        logger.error('Failed to configure build value', errorDetail);
        throw new Error('Build configuration failed', { cause: error });
    }
    const allowedActionOrigins = getAllowedActionOrigins({
        clientUrl: SERVER_ENV.CLIENT_URL,
        corsOrigins: SERVER_ENV.CORS_ORIGINS,
        nodeEnv: SERVER_ENV.NODE_ENV,
        port: SERVER_ENV.PORT,
    });
    buildValue = createBuildValue(buildValue, allowedActionOrigins);
    logger.info('React Router action origins configured', {
        allowedActionOrigins,
        environment: SERVER_ENV.NODE_ENV,
    });
    logger.info('App middleware configuration completed successfully');
    return { buildValue };
}

export default configureApp;
