import type { RemoteStatus } from '@/shared/stores/musicStore';
import { randomUUID } from 'node:crypto';
import logger from '../../logger';
import { StateReconciler } from '../../services/stateReconciler';
import type { WindowCloseManager } from '../../services/windowCloseManager';
import type { TimerManager } from '../../utils/timerManager';
import { isRemoteStatusEqual, shouldDebounce } from './remoteStatus';

export type EmitFn = (ev: string, payload: unknown) => boolean | undefined;

export interface ManagerConfig {
    debounceMs: number;
    graceMs: number;
    inactivityMs: number;
    inactivityMsPlaying?: number;
    inactivityMsPaused?: number;
}

interface QueuedUpdate {
    status: RemoteStatus;
    source: string;
    timestamp: number;
    traceId: string;
}

export class SocketManager {
    private remoteStatus: RemoteStatus = { type: 'closed' };
    private remoteStatusUpdatedAt = 0;
    private stateReconciler: StateReconciler;
    private updateQueue: QueuedUpdate[] = [];
    private isProcessing = false;
    private sequenceNumber = 0;
    private lastTraceId: string = '';

    constructor(
        private emit: EmitFn,
        private timerManager: TimerManager,
        private windowCloseManager: WindowCloseManager,
        private config: ManagerConfig,
    ) {
        this.stateReconciler = new StateReconciler();
    }

    getCurrent(): RemoteStatus {
        return this.remoteStatus;
    }

    shutdown() {
        try {
            this.updateQueue = [];
            this.timerManager.clear('pendingClose');
            this.timerManager.clear('inactivity');
            this.stateReconciler.reset();
            try {
                if (
                    typeof (this.timerManager as { clearAll?: unknown }).clearAll
                        === 'function'
                ) {
                    this.timerManager.clearAll();
                }
            } catch (error) {
                logger.warn('SocketManager failed to clearAll timers', { error: error });
            }
        } catch (error) {
            logger.warn('SocketManager shutdown error', { error: error });
        }
    }

    update(status: RemoteStatus, source?: string) {
        const traceId = randomUUID();
        const timestamp = Date.now();
        const updateSource = source ?? 'unknown';

        this.updateQueue.push({
            source: updateSource,
            status,
            timestamp,
            traceId,
        });

        if (!this.isProcessing) this.processQueue();
    }

    private processQueue(): void {
        if (this.isProcessing || this.updateQueue.length === 0) return;

        this.isProcessing = true;

        try {
            while (this.updateQueue.length > 0) {
                const update = this.updateQueue.shift();
                if (!update) break;

                this.processUpdate(update);
            }
        } finally {
            this.isProcessing = false;
        }
    }

    private processUpdate(update: QueuedUpdate): void {
        try {
            const { status, source, traceId } = update;
            const now = Date.now();

            if (status.type === 'closed') {
                if (this.remoteStatus.type === 'closed') return;
                this.timerManager.clear('pendingClose');
                this.timerManager.start('pendingClose', this.config.graceMs, () => {
                    this.applyStatusChange(status, source, traceId, 'grace_close');
                });
                this.timerManager.clear('inactivity');
                logger.info('scheduled remoteStatus close (grace)', {
                    graceMs: this.config.graceMs,
                    source,
                    traceId,
                });
                return;
            }

            this.timerManager.clear('graceClose');
            this.scheduleInactivityTimer(status, source, traceId);

            if (isRemoteStatusEqual(this.remoteStatus, status)) return;

            const reconciliationResult = this.stateReconciler.reconcile(
                this.remoteStatus,
                status,
                source,
            );

            if (!reconciliationResult.shouldEmit) {
                logger.debug('skipping emit due to reconciliation', {
                    reason: reconciliationResult.reason,
                    source,
                    traceId,
                });
                return;
            }

            const finalStatus = reconciliationResult.status;
            const stateChange = this.remoteStatus.type !== finalStatus.type;

            if (
                stateChange
                || !shouldDebounce(this.remoteStatusUpdatedAt, now, this.config.debounceMs)
            ) {
                this.applyStatusChange(finalStatus, source, traceId);
            }
        } catch (error) {
            logger.warn('SocketManager processUpdate failed', { error: error, update });
        }
    }

    private applyStatusChange(
        status: RemoteStatus,
        source: string,
        traceId: string,
        reason?: string,
    ): void {
        this.remoteStatus = status;
        this.remoteStatusUpdatedAt = Date.now();
        this.sequenceNumber++;

        if (status.type === 'playing') status.lastProgressUpdate = this.remoteStatusUpdatedAt;

        this.lastTraceId = traceId;
        const enrichedStatus = {
            ...status,
            _meta: {
                sequenceNumber: this.sequenceNumber,
                serverTimestamp: this.remoteStatusUpdatedAt,
                traceId,
            },
        };

        this.emit('remoteStatusUpdated', enrichedStatus);

        const statusString = status.type === 'playing'
            ? `${status.musicId || status.videoId}`
            : status.type;

        logger.info('remoteStatus updated', {
            reason,
            sequenceNumber: this.sequenceNumber,
            source,
            traceId,
        });
        logger.info(`${statusString} state=${status.type}`);
    }

    getSnapshot(): RemoteStatus & { _meta: { sequenceNumber: number; serverTimestamp: number; traceId: string } } {
        const status = this.remoteStatus;
        const now = Date.now();
        const seq = this.sequenceNumber;
        const traceId = this.lastTraceId || '';
        const eventTimestamp = this.remoteStatusUpdatedAt || now;
        if (status.type === 'playing') {
            const currentTime = typeof status.currentTime === 'number' ? status.currentTime : 0;
            const hadLastProgress = typeof status.lastProgressUpdate === 'number';
            const lastProgress: number = hadLastProgress
                ? (status.lastProgressUpdate as number)
                : eventTimestamp;
            const deltaMs = Math.max(0, now - lastProgress);
            const rate = typeof status.playbackRate === 'number' ? status.playbackRate : 1;
            let predicted = currentTime + (deltaMs / 1000) * rate;
            if (typeof status.duration === 'number' && status.duration > 0)
                predicted = Math.min(predicted, status.duration);
            const snapshot: RemoteStatus = {
                ...status,
                currentTime: predicted,
                lastProgressUpdate: hadLastProgress ? eventTimestamp : now,
            };
            return {
                ...snapshot,
                _meta: {
                    sequenceNumber: seq,
                    serverTimestamp: eventTimestamp,
                    traceId,
                },
            };
        }

        return {
            ...status,
            _meta: {
                sequenceNumber: seq,
                serverTimestamp: eventTimestamp,
                traceId,
            },
        };
    }

    private scheduleInactivityTimer(status: RemoteStatus, source: string, traceId: string): void {
        this.timerManager.clear('inactivity');
        let inactivityMs = this.config.inactivityMs;
        if (status.type === 'playing' && typeof this.config.inactivityMsPlaying === 'number')
            inactivityMs = this.config.inactivityMsPlaying;
        else if (status.type === 'paused' && typeof this.config.inactivityMsPaused === 'number')
            inactivityMs = this.config.inactivityMsPaused;
        if (!inactivityMs || inactivityMs <= 0) return;

        this.timerManager.start('inactivity', inactivityMs, () => {
            try {
                this.applyStatusChange(
                    { type: 'closed' },
                    source,
                    traceId,
                    'inactivity',
                );
            } catch (error) {
                logger.warn('failed to apply inactivity close', { error: error });
            }
        });
    }
}
