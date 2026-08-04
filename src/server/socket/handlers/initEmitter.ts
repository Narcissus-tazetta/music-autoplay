import { withErrorHandler } from '@/shared/utils/errors';
import type { Socket } from 'socket.io';
import { isProduction } from '../../config';
import type { AppLogger } from '../../logger.server';
import type { MusicService } from '../../music/musicService';

export function emitInitialData(
    socket: Socket,
    log: AppLogger,
    getMusicService: () => MusicService,
) {
    withErrorHandler(() => {
        const compatList = getMusicService().buildCompatList();
        socket.emit('initMusics', compatList);
        socket.emit('url_list', compatList);
        if (!isProduction) {
            log.debug('emitted init events to socket', {
                count: compatList.length,
                socketId: socket.id,
            });
        }
    }, 'socket init emit')();
}
