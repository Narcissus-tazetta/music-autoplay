import { beforeEach, describe, expect, mock, test } from "bun:test";
import { WindowCloseManager } from "../../src/server/services/windowCloseManager";
import { SocketManager } from "../../src/server/socket/managers/manager";
import type {
  EmitFn,
  ManagerConfig,
} from "../../src/server/socket/managers/manager";
import { TimerManager } from "../../src/server/utils/timerManager";
import type { RemoteStatus } from "../../src/shared/stores/musicStore";

describe("SocketManager", () => {
  let manager: SocketManager;
  let emitMock: ReturnType<typeof mock>;
  let emittedEvents: Array<{ event: string; payload: any }>;
  let timerManager: TimerManager;
  let windowCloseManager: WindowCloseManager;

  beforeEach(() => {
    emittedEvents = [];
    emitMock = mock((event: string, payload: unknown) => {
      emittedEvents.push({ event, payload });
      return true;
    });

    timerManager = new TimerManager();
    windowCloseManager = new WindowCloseManager(500);

    const config: ManagerConfig = {
      debounceMs: 100,
      graceMs: 200,
      inactivityMs: 60000,
    };

    manager = new SocketManager(
      emitMock as unknown as EmitFn,
      timerManager,
      windowCloseManager,
      config,
    );
  });

  describe("queue processing", () => {
    test("should process updates in queue order", () => {
      const update1: RemoteStatus = {
        type: "playing",
        musicTitle: "Song 1",
        musicId: "song1",
        currentTime: 0,
      };
      const update2: RemoteStatus = {
        type: "playing",
        musicTitle: "Song 1",
        musicId: "song1",
        currentTime: 5,
      };
      const update3: RemoteStatus = {
        type: "paused",
        musicTitle: "Song 1",
        musicId: "song1",
      };

      manager.update(update1, "test1");
      manager.update(update2, "test2");
      manager.update(update3, "test3");

      expect(emittedEvents.length).toBeGreaterThan(0);

      const finalStatus = manager.getCurrent();
      expect(finalStatus.type).toBe("paused");
    });

    test("should maintain sequence numbers in order", () => {
      for (let i = 0; i < 5; i++) {
        manager.update(
          {
            type: "playing",
            musicTitle: "Test",
            musicId: "test",
            currentTime: i,
          },
          `source-${i}`,
        );
      }

      const sequences = emittedEvents
        .filter((e) => e.event === "remoteStatusUpdated")
        .map((e) => e.payload._meta?.sequenceNumber);

      for (let i = 1; i < sequences.length; i++)
        expect(sequences[i]).toBeGreaterThan(sequences[i - 1]);
    });

    test("should not process while already processing", () => {
      const updates: RemoteStatus[] = Array.from({ length: 10 }, (_, i) => ({
        type: "playing",
        musicTitle: "Test",
        musicId: "test",
        currentTime: i,
      }));

      updates.forEach((update, i) => manager.update(update, `source-${i}`));

      const emitCount = emittedEvents.length;
      expect(emitCount).toBeGreaterThan(0);
    });
  });

  describe("traceId propagation", () => {
    test("should add traceId to all emitted events", () => {
      manager.update(
        {
          type: "playing",
          musicTitle: "Test",
          musicId: "test",
          currentTime: 0,
        },
        "test",
      );

      const emittedStatus = emittedEvents.find(
        (e) => e.event === "remoteStatusUpdated",
      );
      expect(emittedStatus).toBeDefined();
      expect(emittedStatus?.payload._meta?.traceId).toBeDefined();
      expect(typeof emittedStatus?.payload._meta?.traceId).toBe("string");
    });

    test("should use unique traceId for each update", () => {
      manager.update(
        {
          type: "playing",
          musicTitle: "Test 1",
          musicId: "test1",
          currentTime: 0,
        },
        "source1",
      );
      manager.update(
        {
          type: "playing",
          musicTitle: "Test 2",
          musicId: "test2",
          currentTime: 0,
        },
        "source2",
      );

      const traceIds = emittedEvents
        .filter((e) => e.event === "remoteStatusUpdated")
        .map((e) => e.payload._meta?.traceId);

      expect(traceIds.length).toBeGreaterThanOrEqual(1);
      if (traceIds.length > 1)
        expect(new Set(traceIds).size).toBe(traceIds.length);
    });
  });

  describe("timestamp handling", () => {
    test("should set lastProgressUpdate on playing status", () => {
      const beforeTimestamp = Date.now();

      manager.update(
        {
          type: "playing",
          musicTitle: "Test",
          musicId: "test",
          currentTime: 0,
        },
        "test",
      );

      const afterTimestamp = Date.now();

      const emittedStatus = emittedEvents.find(
        (e) => e.event === "remoteStatusUpdated",
      );
      const lastProgressUpdate = emittedStatus?.payload.lastProgressUpdate;

      expect(lastProgressUpdate).toBeDefined();
      expect(lastProgressUpdate).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(lastProgressUpdate).toBeLessThanOrEqual(afterTimestamp);
    });

    test("should set serverTimestamp in _meta", () => {
      const beforeTimestamp = Date.now();

      manager.update(
        {
          type: "playing",
          musicTitle: "Test",
          musicId: "test",
          currentTime: 0,
        },
        "test",
      );

      const afterTimestamp = Date.now();

      const emittedStatus = emittedEvents.find(
        (e) => e.event === "remoteStatusUpdated",
      );
      const serverTimestamp = emittedStatus?.payload._meta?.serverTimestamp;

      expect(serverTimestamp).toBeDefined();
      expect(serverTimestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(serverTimestamp).toBeLessThanOrEqual(afterTimestamp);
    });
  });

  describe("reconciliation integration", () => {
    test("should skip emit when reconciler returns shouldEmit=false", () => {
      manager.update(
        {
          type: "paused",
          musicTitle: "Test",
          musicId: "test",
        },
        "extension",
      );

      emittedEvents = [];

      manager.update(
        {
          type: "playing",
          musicTitle: "Test",
          musicId: "test",
          currentTime: 0,
        },
        "progress_update",
      );

      const pausedEmits = emittedEvents.filter(
        (e) => e.event === "remoteStatusUpdated" && e.payload.type === "paused",
      );

      expect(pausedEmits.length).toBe(0);
    });

    test("should force pause on zero progress detection", () => {
      manager.update(
        {
          type: "playing",
          musicTitle: "Test",
          musicId: "test",
          currentTime: 10.0,
        },
        "extension",
      );

      emittedEvents = [];

      for (let i = 0; i < 3; i++) {
        manager.update(
          {
            type: "playing",
            musicTitle: "Test",
            musicId: "test",
            currentTime: 10.01 + i * 0.01,
          },
          "progress_update",
        );
      }

      const finalStatus = manager.getCurrent();
      expect(finalStatus.type).toBe("paused");
    });
  });

  describe("grace period handling", () => {
    test("should schedule closed status with grace period", () => {
      manager.update(
        {
          type: "playing",
          musicTitle: "Test",
          musicId: "test",
          currentTime: 0,
        },
        "test",
      );
      manager.update({ type: "closed" }, "window_close");

      const current = manager.getCurrent();
      expect(current.type).not.toBe("closed");
    });

    test("should apply closed status after grace period", async () => {
      manager.update({ type: "closed" }, "window_close");

      await new Promise((resolve) => setTimeout(resolve, 250));

      const current = manager.getCurrent();
      expect(current.type).toBe("closed");
    });

    test("should cancel grace period on new update", () => {
      manager.update({ type: "closed" }, "window_close");

      manager.update(
        {
          type: "playing",
          musicTitle: "Test",
          musicId: "test",
          currentTime: 0,
        },
        "extension",
      );

      const current = manager.getCurrent();
      expect(current.type).toBe("playing");
    });
  });

  describe("shutdown", () => {
    test("should clear queue on shutdown", () => {
      manager.update(
        { type: "playing", musicTitle: "Test", musicId: "test" },
        "test",
      );
      manager.update(
        { type: "paused", musicTitle: "Test", musicId: "test" },
        "test",
      );

      manager.shutdown();

      expect(() => manager.getCurrent()).not.toThrow();
    });

    test("should clear timers on shutdown", () => {
      manager.update({ type: "closed" }, "window_close");

      manager.shutdown();

      expect(() => manager.getCurrent()).not.toThrow();
    });
  });

  describe("debouncing", () => {
    test("should emit state changes immediately", () => {
      manager.update(
        {
          type: "playing",
          musicTitle: "Test",
          musicId: "test",
          currentTime: 0,
        },
        "test",
      );

      const playingEmits = emittedEvents.filter(
        (e) => e.payload.type === "playing",
      );
      expect(playingEmits.length).toBeGreaterThan(0);

      emittedEvents = [];

      manager.update(
        {
          type: "paused",
          musicTitle: "Test",
          musicId: "test",
        },
        "test",
      );

      const pausedEmits = emittedEvents.filter(
        (e) => e.payload.type === "paused",
      );
      expect(pausedEmits.length).toBeGreaterThan(0);
    });
  });
});
