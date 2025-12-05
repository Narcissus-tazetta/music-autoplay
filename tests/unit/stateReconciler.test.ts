import { beforeEach, describe, expect, test } from "bun:test";
import { StateReconciler } from "../../src/server/services/stateReconciler";
import type { RemoteStatus } from "../../src/shared/stores/musicStore";

describe("StateReconciler", () => {
  let reconciler: StateReconciler;

  beforeEach(() => {
    reconciler = new StateReconciler({
      pausedGracePeriodMs: 200,
      zeroProgressThreshold: 3,
      zeroProgressDelta: 0.1,
    });
  });

  describe("basic state transitions", () => {
    test("should allow closed -> playing transition", () => {
      const current: RemoteStatus = { type: "closed" };
      const incoming: RemoteStatus = {
        type: "playing",
        musicTitle: "Test Song",
        musicId: "test1",
        currentTime: 0,
        duration: 180,
      };

      const result = reconciler.reconcile(current, incoming, "extension");

      expect(result.shouldEmit).toBe(true);
      expect(result.status.type).toBe("playing");
    });

    test("should allow playing -> paused transition", () => {
      const current: RemoteStatus = {
        type: "playing",
        musicTitle: "Test Song",
        musicId: "test1",
        currentTime: 10,
      };
      const incoming: RemoteStatus = {
        type: "paused",
        musicTitle: "Test Song",
        musicId: "test1",
      };

      const result = reconciler.reconcile(current, incoming, "extension");

      expect(result.shouldEmit).toBe(true);
      expect(result.status.type).toBe("paused");
    });

    test("should allow paused -> closed transition", () => {
      const current: RemoteStatus = {
        type: "paused",
        musicTitle: "Test Song",
        musicId: "test1",
      };
      const incoming: RemoteStatus = { type: "closed" };

      const result = reconciler.reconcile(current, incoming, "window_close");

      expect(result.shouldEmit).toBe(true);
      expect(result.status.type).toBe("closed");
    });
  });

  describe("grace period logic", () => {
    test("should ignore progress_update within grace period after pause", () => {
      const pausedStatus: RemoteStatus = {
        type: "paused",
        musicTitle: "Test Song",
        musicId: "test1",
      };

      reconciler.reconcile(
        { type: "playing", musicTitle: "", currentTime: 10 },
        pausedStatus,
        "extension",
      );

      const progressUpdate: RemoteStatus = {
        type: "playing",
        musicTitle: "Test Song",
        musicId: "test1",
        currentTime: 10.1,
      };

      const result = reconciler.reconcile(
        pausedStatus,
        progressUpdate,
        "progress_update",
      );

      expect(result.shouldEmit).toBe(false);
      expect(result.reason).toBe("grace_period");
    });

    test("should accept progress_update after grace period expires", async () => {
      const pausedStatus: RemoteStatus = {
        type: "paused",
        musicTitle: "Test Song",
        musicId: "test1",
      };

      reconciler.reconcile(
        { type: "playing", musicTitle: "", currentTime: 10 },
        pausedStatus,
        "extension",
      );

      await new Promise((resolve) => setTimeout(resolve, 250));

      const progressUpdate: RemoteStatus = {
        type: "playing",
        musicTitle: "Test Song",
        musicId: "test1",
        currentTime: 10.5,
      };

      const result = reconciler.reconcile(
        pausedStatus,
        progressUpdate,
        "progress_update",
      );

      expect(result.shouldEmit).toBe(true);
      expect(result.status.type).toBe("playing");
    });

    test("should accept non-progress_update sources within grace period", () => {
      const pausedStatus: RemoteStatus = {
        type: "paused",
        musicTitle: "Test Song",
        musicId: "test1",
      };

      reconciler.reconcile(
        { type: "playing", musicTitle: "", currentTime: 10 },
        pausedStatus,
        "extension",
      );

      const extensionUpdate: RemoteStatus = {
        type: "playing",
        musicTitle: "Test Song",
        musicId: "test1",
        currentTime: 10.1,
      };

      const result = reconciler.reconcile(
        pausedStatus,
        extensionUpdate,
        "extension",
      );

      expect(result.shouldEmit).toBe(true);
      expect(result.status.type).toBe("playing");
    });
  });

  describe("zero progress detection", () => {
    test("should detect consecutive zero progress and force pause", () => {
      const baseStatus: RemoteStatus = {
        type: "playing",
        musicTitle: "Test Song",
        musicId: "test1",
        currentTime: 10.0,
      };

      reconciler.reconcile({ type: "closed" }, baseStatus, "extension");

      const updates = [
        { currentTime: 10.01, shouldPause: false },
        { currentTime: 10.02, shouldPause: false },
        { currentTime: 10.03, shouldPause: true },
      ];

      let lastResult;
      for (const update of updates) {
        const incoming: RemoteStatus = {
          type: "playing",
          musicTitle: "Test Song",
          musicId: "test1",
          currentTime: update.currentTime,
        };
        lastResult = reconciler.reconcile(
          baseStatus,
          incoming,
          "progress_update",
        );
      }

      expect(lastResult?.status.type).toBe("paused");
      expect(lastResult?.reason).toBe("zero_progress");
    });

    test("should reset zero progress counter on significant progress", () => {
      const baseStatus: RemoteStatus = {
        type: "playing",
        musicTitle: "Test Song",
        musicId: "test1",
        currentTime: 10.0,
      };

      let current: RemoteStatus = { type: "closed" };
      current = reconciler.reconcile(current, baseStatus, "extension").status;

      for (let i = 0; i < 3; i++) {
        const time =
          current.type === "playing" && typeof current.currentTime === "number"
            ? current.currentTime + 0.001
            : 10.0;
        const next: RemoteStatus =
          current.type === "playing"
            ? { ...current, currentTime: time }
            : current;
        current = reconciler.reconcile(current, next, "progress_update").status;
      }

      const significantProgress: RemoteStatus = {
        ...baseStatus,
        currentTime: 11.0,
      };
      current = reconciler.reconcile(
        current,
        significantProgress,
        "extension",
      ).status;

      for (let i = 0; i < 3; i++) {
        const time =
          current.type === "playing" && typeof current.currentTime === "number"
            ? current.currentTime + 0.001
            : 11.0;
        const next: RemoteStatus =
          current.type === "playing"
            ? { ...current, currentTime: time }
            : current;
        current = reconciler.reconcile(current, next, "progress_update").status;
      }

      expect(current.type).toBe("playing");
    });

    test("should only detect zero progress for progress_update source", () => {
      const baseStatus: RemoteStatus = {
        type: "playing",
        musicTitle: "Test Song",
        musicId: "test1",
        currentTime: 10.0,
      };

      reconciler.reconcile({ type: "closed" }, baseStatus, "extension");

      for (let i = 0; i < 5; i++) {
        const result = reconciler.reconcile(
          baseStatus,
          { ...baseStatus, currentTime: 10.01 },
          "extension",
        );
        expect(result.status.type).toBe("playing");
      }
    });
  });

  describe("state reset", () => {
    test("should reset internal state on closed transition", () => {
      const playingStatus: RemoteStatus = {
        type: "playing",
        musicTitle: "Test Song",
        musicId: "test1",
        currentTime: 10.0,
      };

      reconciler.reconcile({ type: "closed" }, playingStatus, "extension");

      for (let i = 0; i < 3; i++)
        reconciler.reconcile(
          playingStatus,
          { ...playingStatus, currentTime: 10.01 },
          "progress_update",
        );

      const closedStatus: RemoteStatus = { type: "closed" };
      reconciler.reconcile(playingStatus, closedStatus, "window_close");

      const newPlayingStatus: RemoteStatus = {
        type: "playing",
        musicTitle: "New Song",
        musicId: "test2",
        currentTime: 5.0,
      };

      const result = reconciler.reconcile(
        closedStatus,
        newPlayingStatus,
        "extension",
      );

      expect(result.shouldEmit).toBe(true);
      expect(result.status.type).toBe("playing");

      const state = reconciler.getState();
      expect(state.consecutiveZeroProgress).toBe(0);
    });

    test("should reset zero progress counter on pause", () => {
      const playingStatus: RemoteStatus = {
        type: "playing",
        musicTitle: "Test Song",
        musicId: "test1",
        currentTime: 10.0,
      };

      reconciler.reconcile({ type: "closed" }, playingStatus, "extension");

      reconciler.reconcile(
        playingStatus,
        { ...playingStatus, currentTime: 10.01 },
        "progress_update",
      );
      reconciler.reconcile(
        playingStatus,
        { ...playingStatus, currentTime: 10.02 },
        "progress_update",
      );

      const pausedStatus: RemoteStatus = {
        type: "paused",
        musicTitle: "Test Song",
        musicId: "test1",
      };
      reconciler.reconcile(playingStatus, pausedStatus, "extension");

      const state = reconciler.getState();
      expect(state.consecutiveZeroProgress).toBe(0);
    });
  });

  describe("edge cases", () => {
    test("should handle missing currentTime gracefully", () => {
      const current: RemoteStatus = {
        type: "playing",
        musicTitle: "Test Song",
        musicId: "test1",
      };
      const incoming: RemoteStatus = {
        type: "playing",
        musicTitle: "Test Song",
        musicId: "test1",
      };

      const result = reconciler.reconcile(current, incoming, "progress_update");

      expect(result.shouldEmit).toBe(true);
    });

    test("should handle first progress_update correctly", () => {
      const closed: RemoteStatus = { type: "closed" };
      const firstProgress: RemoteStatus = {
        type: "playing",
        musicTitle: "Test Song",
        musicId: "test1",
        currentTime: 0,
      };

      const result = reconciler.reconcile(
        closed,
        firstProgress,
        "progress_update",
      );

      expect(result.shouldEmit).toBe(true);
      expect(result.status.type).toBe("playing");
    });

    test("should handle rapid consecutive reconciliations", () => {
      let current: RemoteStatus = { type: "closed" };

      for (let i = 0; i < 100; i++) {
        const incoming: RemoteStatus = {
          type: "playing",
          musicTitle: "Test Song",
          musicId: "test1",
          currentTime: i * 1.0,
        };
        const result = reconciler.reconcile(current, incoming, "extension");
        current = result.status;
      }

      expect(current.type).toBe("playing");
      if (current.type === "playing")
        expect(current.currentTime).toBeGreaterThan(90.0);
    });
  });
});
