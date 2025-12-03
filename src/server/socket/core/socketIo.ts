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

export function createSocketIo(server: HttpServer): CreatedIo {
    const cfg = container.getOptional('configService') as
        | { getString?(key: string): string }
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
            path: socketPath,
            pingInterval: 25_000,
            pingTimeout: 60_000,
            serveClient: false,
            transports: ['polling', 'websocket'],
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
        return { io: undefined, socketPath };
    }
}

export default createSocketIo;
