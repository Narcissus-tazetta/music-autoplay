/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */

import { describe, expect, it, vi } from "vitest";
import type SocketManager from "../../src/server/socket/manager";
import SocketRuntime from "../../src/server/socket/runtime";

class FakeTimerManager {
  timers: Record<string, () => void> = {};
  start(name: string, _ms: number, cb: () => void) {
    this.timers[name] = cb;
  }
  clear(name: string) {
    // avoid dynamic delete to satisfy eslint rule in test
    // leave undefined so tests can still check keys
    this.timers[name] = undefined as unknown as () => void;
  }
}

describe("SocketRuntime timers (grace/inactivity)", () => {
  it("schedules grace close and emits remoteStatusUpdated after grace callback", () => {
    const emitSpy = vi.fn();
    const ioGetter = () => ({ emit: emitSpy }) as unknown;
    const musicDB = new Map();
    const youtubeService = {} as any;
    const fileStore = { add: () => {}, remove: () => {} } as any;
    const timerManager = new FakeTimerManager() as unknown as any;
    const windowCloseManager = {} as any;

    const runtime = new SocketRuntime(
      ioGetter as any,
      musicDB,
      youtubeService,
      fileStore,
      timerManager,
      windowCloseManager,
      { debounceMs: 10, graceMs: 100, inactivityMs: 200 },
    );

    const mgr = runtime.createManager() as unknown as SocketManager & {
      getCurrent?: () => unknown;
    };
    // ensure manager is in a non-closed state first so closed triggers grace
    (mgr as any).update({ type: "open" }, "test");
    // now simulate remoteStatus close which should schedule grace
    (mgr as any).update({ type: "closed" }, "test");
    // grace callback should be scheduled under 'pendingClose'
    expect(Object.keys(timerManager.timers)).toContain("pendingClose");
    // fire the scheduled grace callback
    timerManager.timers["pendingClose"]();
    expect(emitSpy).toHaveBeenCalled();
  });

  it("schedules inactivity and emits remoteStatusUpdated when fired", () => {
    const emitSpy = vi.fn();
    const ioGetter = () => ({ emit: emitSpy }) as unknown;
    const musicDB = new Map();
    const youtubeService = {} as any;
    const fileStore = { add: () => {}, remove: () => {} } as any;
    const timerManager = new FakeTimerManager() as unknown as any;
    const windowCloseManager = {} as any;

    const runtime = new SocketRuntime(
      ioGetter as any,
      musicDB,
      youtubeService,
      fileStore,
      timerManager,
      windowCloseManager,
      { debounceMs: 10, graceMs: 100, inactivityMs: 200 },
    );

    const mgr = runtime.createManager() as unknown as SocketManager;
    (mgr as any).update({ type: "open" }, "test");
    // schedule inactivity should create 'inactivity' timer
    expect(Object.keys(timerManager.timers)).toContain("inactivity");
    timerManager.timers["inactivity"]();
    expect(emitSpy).toHaveBeenCalled();
  });
});
