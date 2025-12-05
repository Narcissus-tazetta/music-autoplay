import type { RemoteStatus } from "@/shared/stores/musicStore";
import logger from "../logger";

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
    lastPausedAt: 0,
    consecutiveZeroProgress: 0,
    lastCurrentTime: 0,
  };

  constructor(
    private config: ReconcilerConfig = {
      pausedGracePeriodMs: 200,
      zeroProgressThreshold: 3,
      zeroProgressDelta: 0.1,
    },
  ) {}

  reconcile(
    currentStatus: RemoteStatus,
    incomingStatus: RemoteStatus,
    source: string,
  ): ReconciliationResult {
    const now = Date.now();

    if (incomingStatus.type === "closed") {
      this.reset();
      return { status: incomingStatus, shouldEmit: true };
    }

    if (incomingStatus.type === "paused") {
      this.state.lastPausedAt = now;
      this.state.consecutiveZeroProgress = 0;
      if (incomingStatus.currentTime != null)
        this.state.lastCurrentTime = incomingStatus.currentTime;
      return { status: incomingStatus, shouldEmit: true };
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (incomingStatus.type === "playing") {
      const withinGracePeriod =
        now - this.state.lastPausedAt < this.config.pausedGracePeriodMs;
      if (withinGracePeriod && source === "progress_update") {
        logger.debug(
          "stateReconciler: ignoring progress_update within grace period",
          {
            source,
            timeSincePaused: now - this.state.lastPausedAt,
          },
        );
        return {
          status: currentStatus,
          shouldEmit: false,
          reason: "grace_period",
        };
      }

      const currentTime = incomingStatus.currentTime ?? 0;
      const deltaPlayback = Math.abs(currentTime - this.state.lastCurrentTime);

      if (
        source === "progress_update" &&
        this.state.lastCurrentTime > 0 &&
        deltaPlayback < this.config.zeroProgressDelta
      ) {
        this.state.consecutiveZeroProgress++;
        logger.debug("stateReconciler: detected zero progress", {
          consecutiveZeroProgress: this.state.consecutiveZeroProgress,
          currentTime,
          lastCurrentTime: this.state.lastCurrentTime,
          deltaPlayback,
        });

        if (
          this.state.consecutiveZeroProgress >=
          this.config.zeroProgressThreshold
        ) {
          const pausedStatus: RemoteStatus = {
            type: "paused",
            musicTitle: incomingStatus.musicTitle,
            musicId: incomingStatus.musicId,
            currentTime: incomingStatus.currentTime,
            duration: incomingStatus.duration,
          };
          logger.info(
            "stateReconciler: forcing paused due to consecutive zero progress",
            {
              consecutiveZeroProgress: this.state.consecutiveZeroProgress,
            },
          );
          this.state.lastPausedAt = now;
          this.state.consecutiveZeroProgress = 0;
          this.state.lastCurrentTime = currentTime;
          return {
            status: pausedStatus,
            shouldEmit: true,
            reason: "zero_progress",
          };
        }
      } else if (
        source !== "progress_update" ||
        deltaPlayback >= this.config.zeroProgressDelta
      ) {
        this.state.consecutiveZeroProgress = 0;
        this.state.lastCurrentTime = currentTime;
      }
    }

    return { status: incomingStatus, shouldEmit: true };
  }

  reset(): void {
    this.state = {
      lastPausedAt: 0,
      consecutiveZeroProgress: 0,
      lastCurrentTime: 0,
    };
  }

  getState(): Readonly<ReconcilerState> {
    return { ...this.state };
  }
}
