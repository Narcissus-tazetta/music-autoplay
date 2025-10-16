import { TimerManager } from "../utils/timerManager";

type Event = {
  origin?: string | undefined;
  socketId?: string | undefined;
  type: string;
  ts?: number;
};

export class WindowCloseManager {
  private timers = new TimerManager();
  private lastEventAt = new Map<string, number>();
  private debounceMs: number;

  constructor(debounceMs: number = 500) {
    this.debounceMs = debounceMs;
  }

  private keyFor(e: Event) {
    return e.origin || e.socketId || "unknown";
  }

  processEvent(e: Event, onScheduleClose: (key: string) => void) {
    const key = this.keyFor(e);
    const now = e.ts ?? Date.now();
    const last = this.lastEventAt.get(key) ?? 0;
    if (now - last < 50) return { processed: false, reason: "rapid_duplicate" };

    this.lastEventAt.set(key, now);
    this.timers.clear(key);
    this.timers.start(key, this.debounceMs, () => {
      onScheduleClose(key);
    });

    return { processed: true };
  }

  clearForOrigin(originOrSocketId: string) {
    this.timers.clear(originOrSocketId);
    this.lastEventAt.delete(originOrSocketId);
  }
}

export default WindowCloseManager;
