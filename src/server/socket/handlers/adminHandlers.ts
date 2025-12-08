import { createHash } from 'node:crypto';
import type { Socket } from 'socket.io';
import logger from '../../logger';
import type { RateLimiter } from '../../services/rateLimiter';
import { createSocketEventHandler, type EventContext } from './eventHandler';

// IPアドレスが取得できない場合に、socket.idへフォールバックした際の警告を既に出力したソケットを記録するWeakMap
const ipFallbackWarned = new WeakMap<Socket, boolean>();

function createIpBasedKeyGenerator() {
    return (socket: Socket): string => {
        const ip = socket.handshake.address;
        if (!ip) {
            if (!ipFallbackWarned.get(socket)) {
                logger.warn('IP address not available, falling back to socket.id', {
                    socketId: socket.id,
                });
                ipFallbackWarned.set(socket, true);
            }
            return socket.id;
        }
        return ip;
    };
}

export function createAdminAuthHandlers(
    adminHash: string,
    rateLimiter: RateLimiter,
    maxAttempts: number,
    windowMs: number,
) {
    const keyGenerator = createIpBasedKeyGenerator();

    const adminAuthHandler = createSocketEventHandler<
        string,
        { success: boolean; error?: string }
    >({
        event: 'adminAuth',
        handler: (token: string, _context: EventContext) => {
            const hash = createHash('sha256').update(token).digest('hex');
            const success = hash === adminHash;

            return {
                error: success ? undefined : '認証に失敗しました',
                success,
            };
        },
        logPayload: false,
        logResponse: false,
        rateLimiter: {
            keyGenerator,
            maxAttempts,
            windowMs,
        },
    });

    const adminAuthByQueryHandler = createSocketEventHandler<
        string,
        { success: boolean; error?: string }
    >({
        event: 'adminAuthByQuery',
        handler: (token: string, _context: EventContext) => {
            const hash = createHash('sha256').update(token).digest('hex');
            const success = hash === adminHash;

            return {
                error: success ? undefined : '認証に失敗しました',
                success,
            };
        },
        logPayload: false,
        logResponse: false,
        rateLimiter: {
            keyGenerator,
            maxAttempts,
            windowMs,
        },
    });

    return {
        adminAuth: adminAuthHandler,
        adminAuthByQuery: adminAuthByQueryHandler,
    };
}
