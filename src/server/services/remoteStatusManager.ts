import type { RemoteStatus } from "@/shared/stores/musicStore";
import logger from "../logger";
import type { TimerManager } from "../utils/timerManager";

export class RemoteStatusManager {
  private remoteStatus: RemoteStatus = { type: "closed" };
  private updatedAt = 0;

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
      this.emit("remoteStatusUpdated", this.remoteStatus);
    } catch (e: unknown) {
      logger.warn("RemoteStatusManager emit failed", { error: e });
    }
  }

  getUpdatedAt(): number {
    return this.updatedAt;
  }
}
