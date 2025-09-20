/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import SocketManager from "../../src/server/socket/manager";
import type { ManagerConfig } from "../../src/server/socket/manager";
import { TimerManager } from "../../src/server/utils/socketHelpers";

type EmitCall = { ev: string; payload: unknown };

describe("SocketManager timers", () => {
  let timerManager: TimerManager;
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
    emits = [];
    emitSpy = (ev: string, payload: unknown) => emits.push({ ev, payload });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules a grace close when status becomes closed and emits after graceMs", () => {
    const mgr = new SocketManager(emitSpy, timerManager as any, {} as any, cfg);
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
    expect((emits[0].payload as any).type).toBe("closed");
  });

  it("cancels pending grace if a new open status arrives", () => {
    const mgr = new SocketManager(emitSpy, timerManager as any, {} as any, cfg);
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
    const closed = emits.find((e) => (e.payload as any).type === "closed");
    expect(closed).toBeUndefined();
  });

  it("fires inactivity timeout after configured inactivityMs", () => {
    const mgr = new SocketManager(emitSpy, timerManager as any, {} as any, cfg);
    mgr.update({ type: "playing", musicTitle: "t", musicId: "a" });
    emits = [];
    // advance to just before inactivity
    vi.advanceTimersByTime(400);
    expect(
      emits.filter((e) => (e.payload as any).type === "closed").length,
    ).toBe(0);
    vi.advanceTimersByTime(200);
    // after inactivity should emit closed
    const closed = emits.find((e) => (e.payload as any).type === "closed");
    expect(closed).toBeDefined();
  });

  it("debounces rapid updates according to debounceMs", () => {
    const mgr = new SocketManager(emitSpy, timerManager as any, {} as any, cfg);
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
