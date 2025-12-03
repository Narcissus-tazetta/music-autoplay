import type { RemoteStatus } from '@/shared/stores/musicStore';
import { container } from '../../di/container';
import logger from '../../logger';
import { RemoteStatusManager } from '../../services/remoteStatusManager';
import type { WindowCloseManager } from '../../services/windowCloseManager';
import type { TimerManager } from '../../utils/timerManager';
import { isRemoteStatusEqual, shouldDebounce } from './remoteStatus';

export type EmitFn = (ev: string, payload: unknown) => boolean | undefined;

export interface ManagerConfig {
    debounceMs: number;
    graceMs: number;
    inactivityMs: number;
}

export class SocketManager {
    private remoteStatus: RemoteStatus = { type: 'closed' };
    private remoteStatusUpdatedAt = 0;
    private remoteStatusManager?: RemoteStatusManager;
    getCurrent(): RemoteStatus {
        return this.remoteStatus;
    }
    constructor(
        private emit: EmitFn,
        private timerManager: TimerManager,
        private windowCloseManager: InstanceType<typeof WindowCloseManager>,
        private config: ManagerConfig,
    ) {}

    initWithDI() {
        try {
            if (container.has('remoteStatusManager')) {
                this.remoteStatusManager = container.get(
                    'remoteStatusManager',
                ) as RemoteStatusManager;
            } else {
                this.remoteStatusManager = new RemoteStatusManager(
                    (ev, payload) => this.emit(ev, payload),
                    this.timerManager,
                );
            }
            const cur = this.remoteStatusManager.getCurrent();
            this.remoteStatus = cur;
            this.remoteStatusUpdatedAt = this.remoteStatusManager.getUpdatedAt();
        } catch (error) {
            logger.debug('SocketManager.initWithDI failed', { error: error });
        }
    }

    shutdown() {
        try {
            this.timerManager.clear('pendingClose');
            this.timerManager.clear('inactivity');
            try {
                if (
                    typeof (this.timerManager as { clearAll?: unknown }).clearAll
                        === 'function'
                ) {
                    this.timerManager.clearAll();
                }
            } catch (error) {
                logger.warn('SocketManager failed to clearAll timers', {
                    error: error,
                });
            }
        } catch (error) {
            logger.warn('SocketManager shutdown error', { error: error });
        }
    }

    update(status: RemoteStatus, source?: string) {
        try {
            const now = Date.now();
            if (status.type === 'closed') {
                if (this.remoteStatus.type === 'closed') return;
                this.timerManager.clear('pendingClose');
                this.timerManager.start('pendingClose', this.config.graceMs, () => {
                    try {
                        if (this.remoteStatusManager) {
                            this.remoteStatusManager.update(status, source ?? 'grace_close');
                            this.remoteStatus = this.remoteStatusManager.getCurrent();
                            this.remoteStatusUpdatedAt = this.remoteStatusManager.getUpdatedAt();
                        } else {
                            this.remoteStatus = status;
                            this.remoteStatusUpdatedAt = Date.now();
                            this.emit('remoteStatusUpdated', this.remoteStatus);
                        }
                        logger.info('remoteStatus updated (grace close)', {
                            source,
                            status: this.remoteStatus,
                        });
                    } catch (error) {
                        logger.warn('failed to apply grace close', { error: error });
                    }
                });
                this.timerManager.clear('inactivity');
                logger.info('scheduled remoteStatus close (grace)', {
                    graceMs: this.config.graceMs,
                    source,
                });
                return;
            }

            this.timerManager.clear('graceClose');
            try {
                this.scheduleInactivityTimer(source);
            } catch (error) {
                logger.warn('failed to schedule inactivity timer', { error: error });
            }

            if (isRemoteStatusEqual(this.remoteStatus, status)) return;

            if (this.remoteStatusManager) {
                this.remoteStatusManager.update(status, source ?? 'unknown');
                this.remoteStatus = this.remoteStatusManager.getCurrent();
                this.remoteStatusUpdatedAt = this.remoteStatusManager.getUpdatedAt();

                const statusString = this.remoteStatus.type === 'playing'
                    ? `${this.remoteStatus.musicId || this.remoteStatus.videoId}`
                    : this.remoteStatus.type;
                const stateChange = this.remoteStatus.type !== status.type;

                if (stateChange) {
                    logger.info('remoteStatus updated', {
                        source,
                    });
                    logger.info(`${statusString} state=${this.remoteStatus.type}`);
                }
            } else {
                const stateChange = this.remoteStatus.type !== status.type;

                if (
                    shouldDebounce(
                        this.remoteStatusUpdatedAt,
                        now,
                        this.config.debounceMs,
                    )
                ) {
                    this.remoteStatus = status;
                    this.remoteStatusUpdatedAt = now;
                    this.emit('remoteStatusUpdated', this.remoteStatus);
                    if (stateChange) {
                        const statusString = this.remoteStatus.type === 'playing'
                            ? `${this.remoteStatus.musicId || this.remoteStatus.videoId}`
                            : this.remoteStatus.type;
                        logger.info('remoteStatus updated', { source });
                        logger.info(`${statusString} state=${this.remoteStatus.type}`);
                    }
                    return;
                }

                this.remoteStatus = status;
                this.remoteStatusUpdatedAt = now;
                this.emit('remoteStatusUpdated', this.remoteStatus);
                if (stateChange) {
                    const statusString = this.remoteStatus.type === 'playing'
                        ? `${this.remoteStatus.musicId || this.remoteStatus.videoId}`
                        : this.remoteStatus.type;
                    logger.info('remoteStatus updated', { source });
                    logger.info(`${statusString} state=${this.remoteStatus.type}`);
                }
            }
        } catch (error) {
            logger.warn('SocketManager update failed', { error: error });
        }
    }

    private scheduleInactivityTimer(source?: string) {
        this.timerManager.clear('inactivity');
        if (!this.config.inactivityMs || this.config.inactivityMs <= 0) return;
        this.timerManager.start('inactivity', this.config.inactivityMs, () => {
            try {
                const closedStatus: RemoteStatus = { type: 'closed' };
                if (this.remoteStatusManager) {
                    this.remoteStatusManager.update(closedStatus, source ?? 'inactivity');
                    this.remoteStatus = this.remoteStatusManager.getCurrent();
                    this.remoteStatusUpdatedAt = this.remoteStatusManager.getUpdatedAt();
                } else {
                    this.remoteStatus = closedStatus;
                    this.remoteStatusUpdatedAt = Date.now();
                    this.emit('remoteStatusUpdated', this.remoteStatus);
                }
                logger.info('remoteStatus updated (inactivity)', {
                    source,
                    status: this.remoteStatus,
                });
            } catch (error) {
                logger.warn('failed to apply inactivity close', { error: error });
            }
        });
    }
}
