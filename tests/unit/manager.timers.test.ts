import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SocketManager from "../../src/server/socket/manager";
import type { ManagerConfig } from "../../src/server/socket/manager";
import { TimerManager } from "../../src/server/utils/socketHelpers";
import WindowCloseManager from "../../src/server/utils/windowCloseManager";

type EmitCall = { ev: string; payload: unknown };

const getType = (p: unknown): string | undefined => {
  if (
    p &&
    typeof p === "object" &&
    Object.prototype.hasOwnProperty.call(p, "type")
  ) {
    const obj = p as Record<string, unknown>;
    const t = obj["type"];
    return typeof t === "string" ? t : undefined;
  }
  return undefined;
};

describe("SocketManager timers", () => {
  let timerManager: TimerManager;
  let windowCloseMgr: WindowCloseManager;
  let emitSpy: (ev: string, payload: unknown) => void;
  let emits: EmitCall[];
  const cfg: ManagerConfig = {
    debounceMs: 100,
    graceMs: 200,
    inactivityMs: 500,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    timerManager = new TimerManager();
    windowCloseMgr = new WindowCloseManager();
    emits = [];
    emitSpy = (ev: string, payload: unknown) => emits.push({ ev, payload });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules a grace close when status becomes closed and emits after graceMs", () => {
    const mgr = new SocketManager(
      (ev, payload) => {
        emitSpy(ev, payload);
        return undefined;
      },
      timerManager,
      windowCloseMgr,
      cfg,
    );
    mgr.update({ type: "playing", musicTitle: "t", musicId: "a" });
    // clear the initial emitted update so we can assert only on subsequent emissions
    emits = [];
    // now become closed -> should schedule grace
    mgr.update({ type: "closed" });
    // nothing emitted immediately
    expect(emits).toHaveLength(0);
    // advance less than grace
    vi.advanceTimersByTime(100);
    expect(emits).toHaveLength(0);
    // advance to after grace
    vi.advanceTimersByTime(150);
    expect(emits).toHaveLength(1);
    expect(emits[0].ev).toBe("remoteStatusUpdated");
    expect(getType(emits[0].payload)).toBe("closed");
  });

  it("cancels pending grace if a new open status arrives", () => {
    const mgr = new SocketManager(
      (ev, payload) => {
        emitSpy(ev, payload);
        return undefined;
      },
      timerManager,
      windowCloseMgr,
      cfg,
    );
    mgr.update({ type: "playing", musicTitle: "t", musicId: "a" });
    emits = [];
    mgr.update({ type: "closed" });
    // before grace fires, receive open again
    vi.advanceTimersByTime(100);
    mgr.update({ type: "playing", musicTitle: "t2", musicId: "b" });
    // advance beyond grace
    vi.advanceTimersByTime(200);
    // should have emitted only for the open update (debounced/regular)
    const evNames = emits.map((e) => e.ev);
    expect(evNames).toContain("remoteStatusUpdated");
    // ensure closed emission did not happen
    const closed = emits.find((e) => getType(e.payload) === "closed");
    expect(closed).toBeUndefined();
  });

  it("fires inactivity timeout after configured inactivityMs", () => {
    const mgr = new SocketManager(
      (ev, payload) => {
        emitSpy(ev, payload);
        return undefined;
      },
      timerManager,
      windowCloseMgr,
      cfg,
    );
    mgr.update({ type: "playing", musicTitle: "t", musicId: "a" });
    emits = [];
    // advance to just before inactivity
    vi.advanceTimersByTime(400);
    expect(emits.filter((e) => getType(e.payload) === "closed").length).toBe(0);
    vi.advanceTimersByTime(200);
    // after inactivity should emit closed
    const closed = emits.find((e) => getType(e.payload) === "closed");
    expect(closed).toBeDefined();
  });

  it("debounces rapid updates according to debounceMs", () => {
    const mgr = new SocketManager(
      (ev, payload) => {
        emitSpy(ev, payload);
        return undefined;
      },
      timerManager,
      windowCloseMgr,
      cfg,
    );
    // initial playing
    mgr.update({ type: "playing", musicTitle: "t", musicId: "a" });
    emits = [];
    // rapid update within debounce window
    vi.advanceTimersByTime(10);
    mgr.update({ type: "playing", musicTitle: "t2", musicId: "b" });
    // since updated recently, it should go through debounced branch and still emit
    // advance small time
    vi.advanceTimersByTime(10);
    // we expect at least one remoteStatusUpdated emitted
    const updates = emits.filter((e) => e.ev === "remoteStatusUpdated");
    expect(updates.length).toBeGreaterThanOrEqual(1);
  });
});
