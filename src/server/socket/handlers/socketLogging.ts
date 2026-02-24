import { withErrorHandler } from '@/shared/utils/errors';
import type { Socket } from 'socket.io';
import { SERVER_ENV } from '~/env.server';
import type { AppLogger } from '../../logger';
import { sanitizeArgs, snapshotHeaders } from '../utils';

export function setupSocketLogging(
    socket: Socket,
    log: AppLogger,
    transport: string,
) {
    const enabled = SERVER_ENV.SOCKET_EVENT_LOG_ENABLED
        ?? (SERVER_ENV.NODE_ENV !== 'production');
    if (!enabled) return;

    const sampleRateRaw = SERVER_ENV.SOCKET_EVENT_LOG_SAMPLE_RATE;
    const sampleRate = typeof sampleRateRaw === 'number' ? sampleRateRaw : 1;

    withErrorHandler(() => {
        socket.onAny((event: string, ...args: unknown[]) => {
            withErrorHandler(() => {
                if (event === 'progress_update' || event === 'video_progress') return;
                if (sampleRate < 1 && Math.random() > sampleRate) return;
                const safeArgs = sanitizeArgs(args);
                const headers = snapshotHeaders(socket);
                const origin = headers?.origin ?? headers?.referer;
                log.info('socket event received', {
                    args: safeArgs,
                    event,
                    origin,
                    socketId: socket.id,
                    transport,
                });
            }, 'socket event logging')();
        });
    }, 'socket onAny setup')();
}
