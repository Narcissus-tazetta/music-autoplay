import type { HistoryQuery } from '@/shared/types/history';
import type { Music, RemoteStatus } from '@/shared/types/music';
import type { HistoryService } from '../../history/historyService';
import logger from '../../logger';
import { metricsManager } from '../../services/metricsManager';
import { createSocketEventHandler } from './eventHandler';

export function createGetAllMusicsHandler(musicDB: Map<string, Music>) {
    return createSocketEventHandler({
        event: 'getAllMusics',
        handler(_payload: unknown, context: { socketId: string }): Music[] {
            const start = Date.now();
            let hasError = false;

            try {
                const list = [...musicDB.values()];

                metricsManager.updateRpcGetAllMusics(Date.now() - start, hasError);

                return list;
            } catch (error: unknown) {
                hasError = true;

                metricsManager.updateRpcGetAllMusics(Date.now() - start, hasError);

                logger.error('getAllMusics handler error', {
                    error,
                    socketId: context.socketId,
                });

                return [];
            }
        },
        logPayload: false,
        logResponse: false,
    });
}

export function createGetRemoteStatusHandler(getRemoteStatus: () => RemoteStatus) {
    return createSocketEventHandler({
        event: 'getRemoteStatus',
        handler(): RemoteStatus {
            try {
                return getRemoteStatus();
            } catch (error: unknown) {
                logger.warn('getRemoteStatus handler failed', { error });
                return { type: 'closed' };
            }
        },
        logPayload: false,
        logResponse: false,
    });
}

export function createGetHistoryHandler(historyService: HistoryService) {
    return createSocketEventHandler({
        event: 'getHistory',
        handler(payload: HistoryQuery | undefined) {
            return historyService.query(payload);
        },
        logPayload: false,
        logResponse: false,
    });
}
