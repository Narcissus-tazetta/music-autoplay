import { getHistoryService, type HistoryService } from '../../history/historyService';
import {
    createEventRegistrar,
    createExtensionContextBase,
    type ExtensionContext,
    type ExtensionHandlerDeps,
} from './extensionHandlerContext';
import { createHistoryRecorder } from './historyRecording';
import { registerPlaybackHandlers } from './playbackHandlers';
import { registerProgressHandlers } from './progressHandlers';
import { registerQueueHandlers } from './queueHandlers';
import { registerVideoStateHandlers } from './videoStateHandlers';

/** historyService はテストからの差し替え用。省略時はプロセス共有のものを使う。 */
export type SetupExtensionEventHandlersDeps =
    & Omit<ExtensionHandlerDeps, 'historyService'>
    & { historyService?: HistoryService };

const countSocketListeners = (ctx: ExtensionContext): number =>
    ctx.socket.eventNames().reduce((sum, name) => {
        try {
            return sum + ctx.socket.listenerCount(String(name));
        } catch {
            return sum;
        }
    }, 0);

const snapshotSessionSizes = (ctx: ExtensionContext) => {
    const { state } = ctx;
    return {
        authoritativeVideoState: state.authoritativeVideoState.size,
        historyCompletionRecordedAtByVideoId: state.historyCompletionRecordedAtByVideoId.size,
        lastAdSnapshotByVideoId: state.lastAdSnapshotByVideoId.size,
        lastProgressSnapshotByVideoId: state.lastProgressSnapshotByVideoId.size,
        pendingNextByTabId: state.pendingNextByTabId.size,
        progressState: state.progressState.size,
        recordableMusicSnapshotByVideoId: state.recordableMusicSnapshotByVideoId.size,
        socketListenerEvents: ctx.socket.eventNames().map(name => String(name)).slice(0, 25),
        socketListenersTotal: countSocketListeners(ctx),
        videoEndDebounce: state.videoEndDebounce.size,
    };
};

const registerDisconnectHandler = (ctx: ExtensionContext): void => {
    const { connectionId, log, manager, socket, state } = ctx;

    socket.on('disconnect', reason => {
        try {
            const current = manager.getCurrent();
            if (current.type === 'closed') return;

            const cleanupBefore = snapshotSessionSizes(ctx);

            manager.update({ type: 'closed' }, 'extension_disconnect');

            state.authoritativeVideoState.clear();
            state.historyCompletionRecordedAtByVideoId.clear();
            state.lastProgressSnapshotByVideoId.clear();
            state.lastAdSnapshotByVideoId.clear();
            state.videoEndDebounce.clear();
            state.pendingNextByTabId.clear();
            state.progressState.clear();
            state.recordableMusicSnapshotByVideoId.clear();
            socket.removeAllListeners();

            const cleanupAfter = snapshotSessionSizes(ctx);

            log.info('extension socket disconnected: scheduled remote closed', {
                cleanupAfter,
                cleanupBefore,
                connectionId,
                reason,
                socketId: socket.id,
            });
        } catch (error) {
            log.warn('extension disconnect handler failed', {
                connectionId,
                error: error,
                socketId: socket.id,
            });
        }
    });
};

const registerSessionHandlers = (ctx: ExtensionContext): void => {
    const { log, manager, socket } = ctx;
    const on = createEventRegistrar(ctx);

    on('extension_heartbeat', data => {
        log.debug('extension heartbeat received', {
            data,
            socketId: socket.id,
            timestamp: new Date().toISOString(),
        });
        try {
            const current = manager.getCurrent();
            manager.update(current, 'extension_heartbeat');
        } catch (error) {
            log.warn('extension_heartbeat: failed to update manager', { error });
        }
    });

    on('extension_connected', data => {
        log.info('extension connected event', {
            extensionData: data,
            socketId: socket.id,
            timestamp: new Date().toISOString(),
        });
    });

    on('tabs_sync', data => {
        log.debug('extension tabs sync', {
            socketId: socket.id,
            tabCount: Array.isArray(data) ? data.length : 0,
            timestamp: new Date().toISOString(),
        });
    });
};

/**
 * Wires every socket event the Chrome extension speaks. The extension is
 * distributed as a signed CRX, so event names, payload shapes and callback
 * arities are a frozen contract — only the internal wiring lives here.
 */
export function setupExtensionEventHandlers(deps: SetupExtensionEventHandlersDeps) {
    const base = createExtensionContextBase({
        ...deps,
        historyService: deps.historyService ?? getHistoryService(),
    });
    const ctx: ExtensionContext = { ...base, history: createHistoryRecorder(base) };

    registerDisconnectHandler(ctx);
    registerSessionHandlers(ctx);
    registerVideoStateHandlers(ctx);
    registerQueueHandlers(ctx);
    registerPlaybackHandlers(ctx);
    registerProgressHandlers(ctx);
}
