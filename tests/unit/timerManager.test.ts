import SocketManager from "@/server/socket/manager";
import { TimerManager } from "@/server/utils/socketHelpers";
import WindowCloseManager from "@/server/utils/windowCloseManager";
import { describe, expect, it, vi } from "vitest";

describe("TimerManager", () => {
  it("start sets a timer and clear removes it", () => {
    const tm = new TimerManager();
    let called = false;
    tm.start("k1", 10, () => {
      called = true;
    });
    tm.clear("k1");
    // fast-forward: since we cleared, the callback should not be called
    return new Promise((resolve) => setTimeout(resolve, 20)).then(() => {
      expect(called).toBe(false);
    });
  });

  it("clearAll cancels all timers", () => {
    const tm = new TimerManager();
    let called = false;
    tm.start("a", 10, () => {
      called = true;
    });
    tm.start("b", 10, () => {
      called = true;
    });
    tm.clearAll();
    return new Promise((resolve) => setTimeout(resolve, 20)).then(() => {
      expect(called).toBe(false);
    });
  });
});

describe("SocketManager shutdown", () => {
  it("calls clearAll on its timerManager", () => {
    const mockTm: Partial<import("@/server/utils/socketHelpers").TimerManager> =
      {
        clear: vi.fn() as unknown as (k: string) => void,
        clearAll: vi.fn() as unknown as () => void,
      };
    const emit: import("@/server/socket/manager").EmitFn = (
      _ev: string,
      _payload: unknown,
    ) => true;
    const mgr = new SocketManager(
      emit,
      mockTm as unknown as import("@/server/utils/socketHelpers").TimerManager,
      new WindowCloseManager(1),
      {
        debounceMs: 1,
        graceMs: 1,
        inactivityMs: 1,
      },
    );

    mgr.shutdown();
    expect(mockTm.clear).toHaveBeenCalled();
    expect(mockTm.clearAll).toHaveBeenCalled();
  });
});
