import type { RemoteStatus } from '@/shared/stores/musicStore';
import logger from '../logger';

export interface ReconcilerConfig {
    pausedGracePeriodMs: number;
    zeroProgressThreshold: number;
    zeroProgressDelta: number;
}

export interface ReconciliationResult {
    status: RemoteStatus;
    shouldEmit: boolean;
    reason?: string;
}

interface ReconcilerState {
    lastPausedAt: number;
    consecutiveZeroProgress: number;
    lastCurrentTime: number;
}

export class StateReconciler {
    private state: ReconcilerState = {
        consecutiveZeroProgress: 0,
        lastCurrentTime: 0,
        lastPausedAt: 0,
    };

    constructor(
        private config: ReconcilerConfig = {
            pausedGracePeriodMs: 200,
            zeroProgressDelta: 0.1,
            zeroProgressThreshold: 3,
        },
    ) {}

    reconcile(
        currentStatus: RemoteStatus,
        incomingStatus: RemoteStatus,
        source: string,
    ): ReconciliationResult {
        const now = Date.now();

        if (incomingStatus.type === 'closed') {
            this.reset();
            return { shouldEmit: true, status: incomingStatus };
        }

        if (incomingStatus.type === 'paused') {
            this.state.lastPausedAt = now;
            this.state.consecutiveZeroProgress = 0;
            if (incomingStatus.currentTime != undefined) this.state.lastCurrentTime = incomingStatus.currentTime;
            return { shouldEmit: true, status: incomingStatus };
        }

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (incomingStatus.type === 'playing') {
            const withinGracePeriod = now - this.state.lastPausedAt < this.config.pausedGracePeriodMs;
            if (withinGracePeriod && source === 'progress_update') {
                logger.debug(
                    'stateReconciler: ignoring progress_update within grace period',
                    {
                        source,
                        timeSincePaused: now - this.state.lastPausedAt,
                    },
                );
                return {
                    reason: 'grace_period',
                    shouldEmit: false,
                    status: currentStatus,
                };
            }

            const currentTime = incomingStatus.currentTime ?? 0;
            const deltaPlayback = Math.abs(currentTime - this.state.lastCurrentTime);

            if (
                source === 'progress_update'
                && this.state.lastCurrentTime > 0
                && deltaPlayback < this.config.zeroProgressDelta
            ) {
                this.state.consecutiveZeroProgress++;
                logger.debug('stateReconciler: detected zero progress', {
                    consecutiveZeroProgress: this.state.consecutiveZeroProgress,
                    currentTime,
                    deltaPlayback,
                    lastCurrentTime: this.state.lastCurrentTime,
                });

                if (
                    this.state.consecutiveZeroProgress
                        >= this.config.zeroProgressThreshold
                ) {
                    const pausedStatus: RemoteStatus = {
                        currentTime: incomingStatus.currentTime,
                        duration: incomingStatus.duration,
                        musicId: incomingStatus.musicId,
                        musicTitle: incomingStatus.musicTitle,
                        type: 'paused',
                    };
                    logger.info(
                        'stateReconciler: forcing paused due to consecutive zero progress',
                        {
                            consecutiveZeroProgress: this.state.consecutiveZeroProgress,
                        },
                    );
                    this.state.lastPausedAt = now;
                    this.state.consecutiveZeroProgress = 0;
                    this.state.lastCurrentTime = currentTime;
                    return {
                        reason: 'zero_progress',
                        shouldEmit: true,
                        status: pausedStatus,
                    };
                }
            } else if (
                source !== 'progress_update'
                || deltaPlayback >= this.config.zeroProgressDelta
            ) {
                this.state.consecutiveZeroProgress = 0;
                this.state.lastCurrentTime = currentTime;
            }
        }

        return { shouldEmit: true, status: incomingStatus };
    }

    reset(): void {
        this.state = {
            consecutiveZeroProgress: 0,
            lastCurrentTime: 0,
            lastPausedAt: 0,
        };
    }

    getState(): Readonly<ReconcilerState> {
        return { ...this.state };
    }
}
