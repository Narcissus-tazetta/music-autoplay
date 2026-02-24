import logger from '@/server/logger';
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { SERVER_ENV } from '~/env.server';
import { container } from '../../di/container';
import { buildCorsConfig, makeOriginChecker } from './cors';
import { attachUpgradeRewrite, registerEngineAugmentations } from './engine';

export interface CreatedIo {
    io: Server | null;
    socketPath: string;
}

export const createSocketIo = (server: HttpServer): CreatedIo => {
    const cfg = container.getOptional('configService') as
        | {
            getString?(key: string): string;
            getBoolean?(key: string, fallback?: boolean): boolean;
        }
        | undefined;
    const rawSocketPath = cfg?.getString?.('SOCKET_PATH') ?? SERVER_ENV.SOCKET_PATH;
    const socketPath = typeof rawSocketPath === 'string' && rawSocketPath.length > 0
        ? rawSocketPath
        : '/api/socket.io';
    const candidatePrefixes = [
        ...new Set([socketPath, '/socket.io', '/api/socket.io'].filter(Boolean)),
    ];
    try {
        attachUpgradeRewrite(server, socketPath, candidatePrefixes);
    } catch (error) {
        logger.warn('attachUpgradeRewrite failed', { error: error });
    }

    const { origins, allowAllOrigins, allowExtensionOrigins } = buildCorsConfig();
    const socketHttpCompression = cfg?.getBoolean?.('SOCKET_HTTP_COMPRESSION', SERVER_ENV.NODE_ENV !== 'production')
        ?? SERVER_ENV.SOCKET_HTTP_COMPRESSION
        ?? (SERVER_ENV.NODE_ENV !== 'production');
    const socketPerMessageDeflate = cfg?.getBoolean?.('SOCKET_PERMESSAGE_DEFLATE', SERVER_ENV.NODE_ENV !== 'production')
        ?? SERVER_ENV.SOCKET_PERMESSAGE_DEFLATE
        ?? (SERVER_ENV.NODE_ENV !== 'production');
    const socketWebsocketOnly = cfg?.getBoolean?.('SOCKET_WEBSOCKET_ONLY', false)
        ?? SERVER_ENV.SOCKET_WEBSOCKET_ONLY
        ?? false;
    const transports: ('polling' | 'websocket')[] = socketWebsocketOnly
        ? ['websocket']
        : ['polling', 'websocket'];

    try {
        const io = new Server(server, {
            allowEIO3: true,
            allowRequest: (req, callback) => {
                const origin = req.headers.origin;
                if (!origin) {
                    callback(undefined, true);
                    return;
                }

                if (allowAllOrigins) {
                    callback(undefined, true);
                    return;
                }

                const isAllowed = origins.includes(origin)
                    || (allowExtensionOrigins && origin.startsWith('chrome-extension://'));

                callback(undefined, isAllowed);
            },
            cors: allowAllOrigins
                ? { credentials: true, origin: true }
                : {
                    credentials: true,
                    origin: makeOriginChecker({
                        allowAllOrigins,
                        allowExtensionOrigins,
                        origins,
                    }),
                },
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

export default createSocketIo;
