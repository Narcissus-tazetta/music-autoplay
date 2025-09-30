import type { RemoteStatus } from "~/stores/musicStore";
import { container } from "../di/container";
import logger from "../logger";
import RemoteStatusManager from "../services/remoteStatusManager";
import type { TimerManager } from "../utils/socketHelpers";
import type WindowCloseManager from "../utils/windowCloseManager";
import { isRemoteStatusEqual, shouldDebounce } from "./remoteStatus";

export type EmitFn = (ev: string, payload: unknown) => boolean | undefined;

export type ManagerConfig = {
  debounceMs: number;
  graceMs: number;
  inactivityMs: number;
};

export default class SocketManager {
  private remoteStatus: RemoteStatus = { type: "closed" };
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
      if (container.has("remoteStatusManager"))
        this.remoteStatusManager = container.get(
          "remoteStatusManager",
        ) as RemoteStatusManager;
      else {
        this.remoteStatusManager = new RemoteStatusManager(
          (ev, payload) => this.emit(ev, payload),
          this.timerManager,
        );
      }
      const cur = this.remoteStatusManager.getCurrent();
      this.remoteStatus = cur;
      this.remoteStatusUpdatedAt = this.remoteStatusManager.getUpdatedAt();
    } catch (e: unknown) {
      logger.debug("SocketManager.initWithDI failed", { error: e });
    }
  }

  shutdown() {
    try {
      this.timerManager.clear("pendingClose");
      this.timerManager.clear("inactivity");
      try {
        if (
          typeof (this.timerManager as { clearAll?: unknown }).clearAll ===
          "function"
        )
          this.timerManager.clearAll();
      } catch (e: unknown) {
        logger.warn("SocketManager failed to clearAll timers", { error: e });
      }
    } catch (e: unknown) {
      logger.warn("SocketManager shutdown error", { error: e });
    }
  }

  update(status: RemoteStatus, source?: string) {
    try {
      const now = Date.now();
      if (status.type === "closed") {
        if (this.remoteStatus.type === "closed") return;
        this.timerManager.clear("pendingClose");
        this.timerManager.start("pendingClose", this.config.graceMs, () => {
          try {
            this.remoteStatus = status;
            this.remoteStatusUpdatedAt = Date.now();
            this.emit("remoteStatusUpdated", this.remoteStatus);
            logger.info("remoteStatus updated (grace close)", {
              status: this.remoteStatus,
              source,
            });
          } catch (e: unknown) {
            logger.warn("failed to apply grace close", { error: e });
          }
        });
        this.timerManager.clear("inactivity");
        logger.info("scheduled remoteStatus close (grace)", {
          graceMs: this.config.graceMs,
          source,
        });
        return;
      }

      this.timerManager.clear("pendingClose");
      logger.info("cancelled pending remoteStatus close due to new update", {
        source,
      });
      try {
        this.scheduleInactivityTimer(source);
      } catch (e: unknown) {
        logger.warn("failed to schedule inactivity timer", { error: e });
      }

      if (isRemoteStatusEqual(this.remoteStatus, status)) return;

      if (
        shouldDebounce(this.remoteStatusUpdatedAt, now, this.config.debounceMs)
      ) {
        this.remoteStatus = status;
        this.remoteStatusUpdatedAt = now;
        this.emit("remoteStatusUpdated", this.remoteStatus);
        logger.info("remoteStatus updated (debounced)", {
          status: this.remoteStatus,
          source,
        });
        return;
      }

      this.remoteStatus = status;
      this.remoteStatusUpdatedAt = now;
      this.emit("remoteStatusUpdated", this.remoteStatus);
      logger.info("remoteStatus updated", {
        status: this.remoteStatus,
        source,
      });
    } catch (e: unknown) {
      logger.warn("SocketManager update failed", { error: e });
    }
  }

  private scheduleInactivityTimer(source?: string) {
    this.timerManager.clear("inactivity");
    if (!this.config.inactivityMs || this.config.inactivityMs <= 0) return;
    this.timerManager.start("inactivity", this.config.inactivityMs, () => {
      try {
        this.remoteStatus = { type: "closed" };
        this.remoteStatusUpdatedAt = Date.now();
        this.emit("remoteStatusUpdated", this.remoteStatus);
        logger.info("remoteStatus updated (inactivity)", {
          status: this.remoteStatus,
          source,
        });
      } catch (e: unknown) {
        logger.warn("failed to apply inactivity close", { error: e });
      }
    });
    logger.info("scheduled remoteStatus inactivity timeout", {
      inactivityMs: this.config.inactivityMs,
      source,
    });
  }
}
