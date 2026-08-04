import { SERVER_ENV } from '@/server/env.server';
import logger from '@/server/logger';
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { isProduction } from '../../config';
import { buildCorsConfig, isOriginAllowed, makeOriginChecker } from './cors';
import { attachUpgradeRewrite, registerEngineAugmentations } from './engine';

export interface CreatedIo {
    io: Server | null;
    socketPath: string;
}

export const createSocketIo = (server: HttpServer): CreatedIo => {
    const socketPath = SERVER_ENV.SOCKET_PATH || '/api/socket.io';
    const candidatePrefixes = [
        ...new Set([socketPath, '/socket.io', '/api/socket.io'].filter(Boolean)),
    ];
    try {
        attachUpgradeRewrite(server, socketPath, candidatePrefixes);
    } catch (error) {
        logger.warn('attachUpgradeRewrite failed', { error: error });
    }

    const corsConfig = buildCorsConfig();
    const socketHttpCompression = SERVER_ENV.SOCKET_HTTP_COMPRESSION ?? !isProduction;
    const socketPerMessageDeflate = SERVER_ENV.SOCKET_PERMESSAGE_DEFLATE ?? !isProduction;
    const socketWebsocketOnly = SERVER_ENV.SOCKET_WEBSOCKET_ONLY ?? false;
    const transports: ('polling' | 'websocket')[] = socketWebsocketOnly
        ? ['websocket']
        : ['polling', 'websocket'];

    try {
        const io = new Server(server, {
            allowEIO3: true,
            allowRequest: (req, callback) => {
                const origin = req.headers.origin;
                // A request with no Origin header is not a browser cross-origin request
                // (server-to-server, native clients); the CORS checker treats it the same way.
                callback(undefined, !origin || isOriginAllowed(origin, corsConfig));
            },
            cors: corsConfig.allowAllOrigins
                ? { credentials: true, origin: true }
                : { credentials: true, origin: makeOriginChecker(corsConfig) },
            httpCompression: socketHttpCompression,
            path: socketPath,
            perMessageDeflate: socketPerMessageDeflate,
            pingInterval: 25_000,
            pingTimeout: 60_000,
            serveClient: false,
            transports,
            upgradeTimeout: 30_000,
        });

        try {
            const ioWithEngine = io as { engine?: unknown };
            const engine = ioWithEngine.engine;
            try {
                if (engine) registerEngineAugmentations(engine, socketPath);
            } catch (error) {
                logger.debug('failed to register engine augmentations', {
                    error: error,
                });
            }
        } catch (error) {
            logger.debug('failed to register engine augmentations (outer)', {
                error: error,
            });
        }

        return { io, socketPath };
    } catch (error) {
        logger.error('socket.io initialization failed', { error: error });
        return { io: null, socketPath };
    }
};
