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
import { getConfig } from './utils/configUtils';

export interface ConfigureAppResult {
    buildValue: ServerBuild | (() => Promise<ServerBuild>);
}

export async function configureApp(
    app: express.Express,
    getIo: () => { emit: (...args: unknown[]) => void } | null,
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
    app.use(compression());
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
            // @ts-expect-error - we attach a runtime-only property `requestId` for observability;
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
        app.use(
            '/assets',
            express.static('build/client/assets', { immutable: true, maxAge: '1y' }),
        );
    }

    app.use(express.static('build/client', { maxAge: '1h' }));

    const config = getConfig();
    try {
        const rawSocketPath = config.getString('SOCKET_PATH');
        const socketPath = rawSocketPath.length > 0 ? rawSocketPath : SERVER_ENV.SOCKET_PATH;
        if (config.nodeEnv !== 'production') {
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
            const config = getConfig();
            const socketPath = config.getString('SOCKET_PATH');
            const allowExtensionOrigins = config.getString('ALLOW_EXTENSION_ORIGINS') === 'true';
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
    app.get('/api/musics', (req, res) => {
        try {
            const ioObj = getIo();
            if (
                ioObj
                && typeof (ioObj as Record<string, unknown>).musicDB !== 'undefined'
            ) {
                const musicDB = (ioObj as Record<string, unknown>).musicDB;
                if (musicDB && musicDB instanceof Map) {
                    try {
                        const list = [...musicDB.values()];
                        res.json({ musics: list, ok: true });
                        return;
                    } catch (error) {
                        logger.debug('/api/musics: failed to serialize musicDB', {
                            error: error,
                        });
                    }
                }
            }
            res.json({ musics: [], ok: true });
        } catch (error) {
            const safe = typeof error === 'string'
                ? error
                : (error instanceof Error
                    ? error.message
                    : JSON.stringify(error));
            res.status(500).json({ error: safe, ok: false });
        }
    });
    {
        const config = getConfig();
        const morganFormat = config.getString('MORGAN_FORMAT');
        const skipSocketIo = config.getString('MORGAN_LOG_SOCKETIO') !== 'true';
        app.use(
            morgan(morganFormat, {
                skip: (req: express.Request) => {
                    if (!skipSocketIo) return false;
                    try {
                        const path = req.path ? req.path : req.url || '';
                        const socketPrefix = config.getString('SOCKET_PATH');
                        return (
                            path.startsWith('/socket.io') || path.startsWith(socketPrefix)
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
            const built = (await import(builtPath)) as ServerBuild;
            buildValue = built;
            logger.debug('Loaded production build');
        }
    } catch (error: unknown) {
        logger.error('Failed to configure build value', { error });
        throw new Error('Build configuration failed', { cause: error });
    }
    logger.info('App middleware configuration completed successfully');
    return { buildValue };
}

export default configureApp;
