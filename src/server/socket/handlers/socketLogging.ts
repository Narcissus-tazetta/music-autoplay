import { withErrorHandler } from '@/shared/utils/errors';
import type { Socket } from 'socket.io';
import type { AppLogger } from '../../logger';
import { sanitizeArgs, snapshotHeaders } from '../utils';

export function setupSocketLogging(
    socket: Socket,
    log: AppLogger,
    transport: string,
) {
    withErrorHandler(() => {
        socket.onAny((event: string, ...args: unknown[]) => {
            withErrorHandler(() => {
                if (event === 'progress_update' || event === 'video_progress') return;
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
