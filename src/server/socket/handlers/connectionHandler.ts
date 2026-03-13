import type { Music } from '@/shared/stores/musicStore';
import { withErrorHandler } from '@/shared/utils/errors';
import { randomUUID } from 'node:crypto';
import type { Socket } from 'socket.io';
import type { Server as IOServer } from 'socket.io';
import logger, { logMetric, withContext } from '../../logger';
import type { MusicService } from '../../music/musicService';
import type { Store } from '../../persistence';
import type { RateLimiter } from '../../services/rateLimiter';
import type { WindowCloseManager } from '../../services/windowCloseManager';
import type { YouTubeService } from '../../services/youtubeService';
import type { EmitOptions } from '../../utils/safeEmit';
import { createSocketEmitter } from '../../utils/safeEmit';
import type { TimerManager } from '../../utils/timerManager';
import type { SocketManager } from '../managers/manager';
import { snapshotHeaders } from '../utils';
import { extractSocketOn, extractTransportName } from '../utils/socketHelpers';
import { setupExtensionEventHandlers } from './extensionEventHandlers';
import { registerSocketHandlers } from './handlers';
import { emitInitialData } from './initEmitter';
import { setupSocketLogging } from './socketLogging';

export interface ConnectionDeps {
    getIo: () => IOServer;
    getMusicService: () => MusicService;
    getManager: () => SocketManager | undefined;
    createManager: () => SocketManager;
    musicDB: Map<string, Music>;
    youtubeService: YouTubeService;
    fileStore: Store;
    adminHash: string;
    rateLimiter?: RateLimiter;
    rateLimitConfig?: {
        maxAttempts: number;
        windowMs: number;
    };
    timerManager: TimerManager;
    windowCloseManager: InstanceType<typeof WindowCloseManager>;
}

export type ConnectionHandlerFactory = (
    deps: ConnectionDeps,
) => (socket: Socket) => void;

type SourceKind = 'extension' | 'browser' | 'unknown';

const classifyClientSource = (origin: string | undefined): SourceKind => {
    if (typeof origin !== 'string' || origin.length === 0) return 'unknown';
    if (origin.startsWith('chrome-extension://')) return 'extension';
    return 'browser';
};

const getSocketListenerSummary = (socket: Socket): {
    eventCount: number;
    events: string[];
    totalListeners: number;
} => {
    try {
        const names = socket.eventNames().map(name => String(name));
        const totalListeners = names.reduce((sum, name) => {
            try {
                return sum + socket.listenerCount(name);
            } catch {
                return sum;
            }
        }, 0);
        return {
            eventCount: names.length,
            events: names.slice(0, 25),
            totalListeners,
        };
    } catch {
        return {
            eventCount: -1,
            events: [],
            totalListeners: -1,
        };
    }
};

const getSocketFleetSnapshot = (io: IOServer): {
    browserSockets: number;
    extensionSockets: number;
    openSockets: number;
    pollingSockets: number;
    unknownSourceSockets: number;
    websocketSockets: number;
} => {
    const socketMap = io?.sockets?.sockets;
    if (!socketMap) {
        return {
            browserSockets: 0,
            extensionSockets: 0,
            openSockets: 0,
            pollingSockets: 0,
            unknownSourceSockets: 0,
            websocketSockets: 0,
        };
    }

    let extensionSockets = 0;
    let browserSockets = 0;
    let unknownSourceSockets = 0;
    let websocketSockets = 0;
    let pollingSockets = 0;

    for (const activeSocket of socketMap.values()) {
        const activeOrigin = typeof activeSocket.handshake?.headers?.origin === 'string'
            ? activeSocket.handshake.headers.origin
            : undefined;
        const source = classifyClientSource(activeOrigin);
        if (source === 'extension') extensionSockets++;
        else if (source === 'browser') browserSockets++;
        else unknownSourceSockets++;

        const activeTransport = activeSocket.conn?.transport?.name;
        if (activeTransport === 'websocket') websocketSockets++;
        else if (activeTransport === 'polling') pollingSockets++;
    }

    return {
        browserSockets,
        extensionSockets,
        openSockets: socketMap.size,
        pollingSockets,
        unknownSourceSockets,
        websocketSockets,
    };
};

export function makeConnectionHandler(
    deps: ConnectionDeps,
): (socket: Socket) => void {
    return (socket: Socket): void => {
        const connectionId = randomUUID();
        let requestId: string | undefined;
        try {
            const hdrs = snapshotHeaders(socket);
            const maybeId = hdrs?.['x-request-id'];
            if (typeof maybeId === 'string') requestId = maybeId;
        } catch (error) {
            logger.debug('failed to extract request id from handshake headers', {
                error: error,
                socketId: socket.id,
            });
            requestId = undefined;
        }

        const log = withContext({ connectionId, requestId, socketId: socket.id });
        const manager = deps.getManager() ?? deps.createManager();

        const headersSnapshot = snapshotHeaders(socket);
        const origin = typeof headersSnapshot?.origin === 'string'
            ? headersSnapshot.origin
            : undefined;
        const sourceKind = classifyClientSource(origin);
        const isExtension = sourceKind === 'extension';

        const transport = extractTransportName(socket);
        const clientSource = sourceKind === 'unknown' ? 'browser' : sourceKind;
        const connectedAtMs = Date.now();

        log.info('socket connection established', {
            clientSource,
            connectionId,
            headers: snapshotHeaders(socket),
            origin,
            socketId: socket.id,
            timestamp: new Date().toISOString(),
            transport,
        });

        try {
            const socketFleet = getSocketFleetSnapshot(deps.getIo());
            const listenerSummary = getSocketListenerSummary(socket);
            log.info('socket lifecycle connected', {
                clientSource,
                connectionId,
                listenerEventCount: listenerSummary.eventCount,
                listenerEvents: listenerSummary.events,
                listenerTotalCount: listenerSummary.totalListeners,
                socketId: socket.id,
                socketFleet,
                transport,
            });
        } catch (error) {
            log.debug('socket lifecycle connected snapshot failed', {
                error: error,
                socketId: socket.id,
            });
        }

        withErrorHandler(() => {
            logMetric(
                'socketConnection',
                { clientSource, isExtension, transport },
                { origin, socketId: socket.id },
            );
        }, 'socketConnection metric')();

        const handlerEmitter = createSocketEmitter(deps.getIo, {
            source: 'connectionHandler',
        });
        try {
            registerSocketHandlers(
                socket,
                { connectionId, requestId, socketId: socket.id },
                {
                    adminHash: deps.adminHash,
                    emit: (ev: string, payload: unknown, opts?: EmitOptions) => handlerEmitter.emit(ev, payload, opts),
                    fileStore: deps.fileStore,
                    io: deps.getIo(),
                    isAdmin: (h?: string) => {
                        try {
                            return !!(h && h === deps.adminHash);
                        } catch (error) {
                            log.warn('isAdmin check failed', { error: error });
                            return false;
                        }
                    },
                    manager,
                    musicDB: deps.musicDB,
                    rateLimitConfig: deps.rateLimitConfig,
                    rateLimiter: deps.rateLimiter,
                    youtubeService: deps.youtubeService,
                },
            );
        } catch (error) {
            log.error('registerSocketHandlers failed', {
                error: error,
                socketId: socket.id,
            });
            throw error;
        }

        if (isExtension) {
            const maybeSocketOn = extractSocketOn(socket);

            if (typeof maybeSocketOn === 'function') {
                try {
                    maybeSocketOn('upgrade', () => {
                        log.info('extension connection upgraded to websocket', {
                            socketId: socket.id,
                            timestamp: new Date().toISOString(),
                        });
                    });
                } catch (error) {
                    log.debug('failed to register upgrade handler', {
                        error: error,
                        socketId: socket.id,
                    });
                }

                try {
                    maybeSocketOn('upgradeError', (error: unknown) => {
                        log.warn(
                            'extension websocket upgrade failed, continuing with polling',
                            {
                                error,
                                socketId: socket.id,
                                timestamp: new Date().toISOString(),
                            },
                        );
                    });
                } catch (error) {
                    log.debug('failed to register upgradeError handler', {
                        error: error,
                        socketId: socket.id,
                    });
                }
            }
        }

        setupSocketLogging(socket, log, transport);
        emitInitialData(socket, log, deps.getMusicService);

        log.info('socket connected', {
            clientSource,
            connectionId,
            requestId,
            socketId: socket.id,
            timestamp: new Date().toISOString(),
            transport,
        });

        if (isExtension) {
            const musicService = deps.getMusicService();
            setupExtensionEventHandlers(
                socket,
                log,
                connectionId,
                deps.musicDB,
                manager,
                musicService.repository,
                musicService.emitter,
                deps.youtubeService,
            );
        }

        socket.once('disconnect', reason => {
            try {
                const socketFleet = getSocketFleetSnapshot(deps.getIo());
                const listenerSummary = getSocketListenerSummary(socket);
                const lifetimeMs = Date.now() - connectedAtMs;

                log.info('socket lifecycle disconnected', {
                    clientSource,
                    connectionId,
                    lifetimeMs,
                    listenerEventCount: listenerSummary.eventCount,
                    listenerEvents: listenerSummary.events,
                    listenerTotalCount: listenerSummary.totalListeners,
                    reason,
                    socketId: socket.id,
                    socketFleet,
                    transport,
                });

                if (isExtension && lifetimeMs <= 45_000) {
                    log.warn('extension short-lived socket detected', {
                        connectionId,
                        lifetimeMs,
                        reason,
                        socketId: socket.id,
                        transport,
                    });
                }
            } catch (error) {
                log.debug('socket lifecycle disconnect snapshot failed', {
                    error: error,
                    socketId: socket.id,
                });
            }
        });
    };
}

export default makeConnectionHandler;
