import { SERVER_ENV } from '@/server/env.server';
import logger, { installProcessHandlers, replaceConsoleWithLogger } from '@/server/logger';
import { type ServerContext, serverContext } from '@/shared/types/server';
import { createRequestHandler } from '@react-router/express';
import express from 'express';
import { RouterContextProvider } from 'react-router';
import { bootstrap } from './bootstrap';
import { isProduction, isTest } from './config';
import configureApp, { type ConfigureAppResult } from './configureApp';
import { errorHandler } from './middleware/errorHandler';
import { adminRouter } from './routes/admin';
import { createDiagnosticsRouter } from './routes/diagnostics';
import { requestLogsRouter } from './routes/requestLogs';

const app: express.Application = express();
const port = SERVER_ENV.PORT;

if (!isTest) {
    replaceConsoleWithLogger();
    // Without this, an unhandled rejection kills the process with nothing in the winston logs.
    installProcessHandlers();
}
const { appShutdownHandlers, socketServer, youtubeService } = await bootstrap();

const server = app.listen(port, () => {
    const envName = SERVER_ENV.NODE_ENV;
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

const viteDevServer = isProduction
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

    const shutdownTimeout = SERVER_ENV.SHUTDOWN_TIMEOUT_MS;
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
app.use('/api', createDiagnosticsRouter({ socketServer, youtubeService }));
app.use('/api/admin', adminRouter);
app.use('/api/admin/request-logs', requestLogsRouter);

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

// Express 5 forwards async handler rejections here; it must be registered last.
app.use(errorHandler);

logger.info('All middleware and routes registered successfully', {
    environment: SERVER_ENV.NODE_ENV,
    port,
    timestamp: new Date().toISOString(),
});
