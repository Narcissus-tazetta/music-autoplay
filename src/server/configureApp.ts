import { SERVER_ENV } from '@/server/env.server';
import logger from '@/server/logger.server';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { ServerBuild } from 'react-router';
import { getAllowedActionOrigins } from './actionOrigins';
import { isProduction } from './config';
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
    // Without this, `req.ip` behind a platform proxy is the proxy's own address, so every
    // caller shares one rate-limit bucket and a handful of failed admin logins lock out
    // everybody.
    app.set('trust proxy', SERVER_ENV.TRUSTED_PROXY_HOPS);

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
            res.setHeader('X-Request-Id', rid);
            if (isProduction) res.locals.cspNonce = randomBytes(16).toString('base64');
            next();
        },
    );

    // The nonce is a production-only mechanism. Vite's dev transforms inject inline scripts of
    // their own, and a policy may not carry both: a nonce-source makes browsers ignore
    // `'unsafe-inline'` entirely. Dev therefore emits no nonce at all, which also keeps React
    // from hydration-diffing a `nonce` attribute the browser blanks out of the DOM.
    const inlineScriptPolicy = isProduction
        ? [(_req: unknown, res: unknown) => `'nonce-${(res as express.Response).locals.cspNonce as string}'`]
        : ["'unsafe-inline'"];

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
                        ...inlineScriptPolicy,
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

    app.get('/api/musics', (_req, res) => {
        const start = Date.now();
        const musics = [...(getIo()?.musicDB.values() ?? [])];
        metricsManager.updateApiMusics(Date.now() - start);
        res.json({ musics, ok: true });
    });
    {
        const morganFormat = SERVER_ENV.MORGAN_FORMAT;
        const skipSocketIo = SERVER_ENV.MORGAN_LOG_SOCKETIO !== true;
        app.use(
            morgan(morganFormat, {
                skip: (req: express.Request) => {
                    if (!skipSocketIo) return false;
                    const reqPath = req.path || req.url || '';
                    return reqPath.startsWith('/socket.io') || reqPath.startsWith(SERVER_ENV.SOCKET_PATH);
                },
                stream: {
                    write: (msg: string) => {
                        logger.info(msg.trim());
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
