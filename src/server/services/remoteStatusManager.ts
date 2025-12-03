import type { RemoteStatus } from '@/shared/stores/musicStore';
import logger from '../logger';
import type { TimerManager } from '../utils/timerManager';

const PAUSED_GRACE_PERIOD_MS = 200;
const ZERO_PROGRESS_THRESHOLD = 3;

export class RemoteStatusManager {
    private remoteStatus: RemoteStatus = { type: 'closed' };
    private updatedAt = 0;
    private lastPausedAt = 0;
    private consecutiveZeroProgress = 0;
    private lastCurrentTime = 0;

    constructor(
        private emit: (ev: string, payload: unknown) => void,
        private timerManager: TimerManager,
    ) {}

    getCurrent(): RemoteStatus {
        return this.remoteStatus;
    }

    set(status: RemoteStatus) {
        this.remoteStatus = status;
        this.updatedAt = Date.now();
        try {
            this.emit('remoteStatusUpdated', this.remoteStatus);
        } catch (error) {
            logger.warn('RemoteStatusManager emit failed', { error: error });
        }
    }

    update(status: RemoteStatus, source: string): void {
        const now = Date.now();

        if (status.type === 'paused') {
            this.lastPausedAt = now;
            this.consecutiveZeroProgress = 0;
            this.set(status);
            return;
        }

        if (status.type === 'playing') {
            const withinGracePeriod = now - this.lastPausedAt < PAUSED_GRACE_PERIOD_MS;
            if (withinGracePeriod && source === 'progress_update') {
                logger.debug(
                    'remoteStatusManager: ignoring progress_update within grace period',
                    {
                        source,
                        timeSincePaused: now - this.lastPausedAt,
                    },
                );
                return;
            }

            const currentTime = status.currentTime ?? 0;
            const deltaPlayback = Math.abs(currentTime - this.lastCurrentTime);

            if (
                source === 'progress_update'
                && this.lastCurrentTime > 0
                && deltaPlayback < 0.1
            ) {
                this.consecutiveZeroProgress++;
                logger.debug('remoteStatusManager: detected zero progress', {
                    consecutiveZeroProgress: this.consecutiveZeroProgress,
                    currentTime,
                    deltaPlayback,
                    lastCurrentTime: this.lastCurrentTime,
                });

                if (this.consecutiveZeroProgress >= ZERO_PROGRESS_THRESHOLD) {
                    const pausedStatus: RemoteStatus = {
                        musicId: status.musicId,
                        musicTitle: status.musicTitle,
                        type: 'paused',
                    };
                    logger.info(
                        'remoteStatusManager: forcing paused due to consecutive zero progress',
                        {
                            consecutiveZeroProgress: this.consecutiveZeroProgress,
                        },
                    );
                    this.lastPausedAt = now;
                    this.consecutiveZeroProgress = 0;
                    this.set(pausedStatus);
                    return;
                }
                this.lastCurrentTime = currentTime;
            } else if (source === 'progress_update' || deltaPlayback >= 0.1) {
                this.consecutiveZeroProgress = 0;
                this.lastCurrentTime = currentTime;
            }
        }

        this.set(status);
    }

    getUpdatedAt(): number {
        return this.updatedAt;
    }
}
