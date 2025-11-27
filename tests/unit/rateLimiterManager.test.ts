import { RateLimiter } from "@/server/services/rateLimiter";
import { RateLimiterManager } from "@/server/services/rateLimiterManager";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

describe("RateLimiterManager", () => {
  let manager: RateLimiterManager;
  let limiter1: RateLimiter;
  let limiter2: RateLimiter;

  beforeEach(() => {
    manager = RateLimiterManager.getInstance();
    limiter1 = new RateLimiter(5, 60000);
    limiter2 = new RateLimiter(10, 60000);
  });

  afterEach(() => {
    manager.stopCleanup();
  });

  describe("singleton", () => {
    test("should return same instance", () => {
      const instance1 = RateLimiterManager.getInstance();
      const instance2 = RateLimiterManager.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe("register", () => {
    test("should register rate limiter with name", () => {
      manager.register("test", limiter1);

      limiter1.tryConsume("key1");
      expect(limiter1.getStats().totalKeys).toBe(1);
    });

    test("should allow multiple rate limiters", () => {
      manager.register("limiter1", limiter1);
      manager.register("limiter2", limiter2);

      limiter1.tryConsume("key1");
      limiter2.tryConsume("key1");

      expect(limiter1.getStats().totalKeys).toBe(1);
      expect(limiter2.getStats().totalKeys).toBe(1);
    });
  });

  describe("reset", () => {
    test("should reset specific key in named limiter", () => {
      manager.register("test", limiter1);

      limiter1.tryConsume("key1");
      limiter1.tryConsume("key1");

      expect(limiter1.getOldestAttempt("key1")).toBeDefined();

      manager.reset("test", "key1");

      expect(limiter1.getOldestAttempt("key1")).toBeUndefined();
    });

    test("should not affect other limiters", () => {
      manager.register("limiter1", limiter1);
      manager.register("limiter2", limiter2);

      limiter1.tryConsume("key1");
      limiter2.tryConsume("key1");

      manager.reset("limiter1", "key1");

      expect(limiter1.getOldestAttempt("key1")).toBeUndefined();
      expect(limiter2.getOldestAttempt("key1")).toBeDefined();
    });

    test("should handle non-existent limiter gracefully", () => {
      expect(() => {
        manager.reset("nonexistent", "key1");
      }).not.toThrow();
    });
  });

  describe("scheduleCleanup", () => {
    test("should schedule cleanup without error", () => {
      expect(() => {
        manager.scheduleCleanup();
      }).not.toThrow();
    });
  });

  describe("stopCleanup", () => {
    test("should stop scheduled cleanup", () => {
      manager.scheduleCleanup();

      expect(() => {
        manager.stopCleanup();
      }).not.toThrow();
    });

    test("should be idempotent", () => {
      manager.scheduleCleanup();
      manager.stopCleanup();

      expect(() => {
        manager.stopCleanup();
      }).not.toThrow();
    });
  });

  describe("cleanup execution", () => {
    test("should clear all registered limiters", () => {
      manager.register("limiter1", limiter1);
      manager.register("limiter2", limiter2);

      limiter1.tryConsume("key1");
      limiter1.tryConsume("key1");
      limiter2.tryConsume("key2");

      expect(limiter1.getStats().totalAttempts).toBe(2);
      expect(limiter2.getStats().totalAttempts).toBe(1);

      const managerAny = manager as unknown as {
        executeCleanup: () => void;
      };
      managerAny.executeCleanup();

      expect(limiter1.getStats().totalAttempts).toBe(0);
      expect(limiter2.getStats().totalAttempts).toBe(0);
    });
  });

  describe("getNextMidnightUTC", () => {
    test("should calculate next UTC midnight correctly", () => {
      const now = Date.UTC(2025, 10, 26, 15, 30, 0, 0); // 2025-11-26 15:30:00 UTC
      const expected = Date.UTC(2025, 10, 27, 0, 0, 0, 0); // 2025-11-27 00:00:00 UTC

      const managerAny = manager as unknown as {
        getNextMidnightUTC: (now: number) => number;
      };
      const result = managerAny.getNextMidnightUTC(now);
      expect(result).toBe(expected);
    });

    test("should handle day boundary correctly", () => {
      const now = Date.UTC(2025, 10, 26, 23, 59, 59, 999);
      const expected = Date.UTC(2025, 10, 27, 0, 0, 0, 0);

      const managerAny = manager as unknown as {
        getNextMidnightUTC: (now: number) => number;
      };
      const result = managerAny.getNextMidnightUTC(now);
      expect(result).toBe(expected);
    });
  });
});
