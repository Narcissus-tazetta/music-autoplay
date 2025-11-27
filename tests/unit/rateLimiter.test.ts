import { RateLimiter } from "@/server/services/rateLimiter";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

describe("RateLimiter", () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter(3, 1000);
  });

  afterEach(() => {
    rateLimiter.clearAll();
  });

  describe("tryConsume", () => {
    test("should allow requests within limit", () => {
      expect(rateLimiter.tryConsume("key1")).toBe(true);
      expect(rateLimiter.tryConsume("key1")).toBe(true);
      expect(rateLimiter.tryConsume("key1")).toBe(true);
    });

    test("should block requests exceeding limit", () => {
      rateLimiter.tryConsume("key1");
      rateLimiter.tryConsume("key1");
      rateLimiter.tryConsume("key1");
      expect(rateLimiter.tryConsume("key1")).toBe(false);
    });

    test("should track different keys independently", () => {
      rateLimiter.tryConsume("key1");
      rateLimiter.tryConsume("key1");
      rateLimiter.tryConsume("key1");

      expect(rateLimiter.tryConsume("key1")).toBe(false);
      expect(rateLimiter.tryConsume("key2")).toBe(true);
    });

    test("should reset after window expires", async () => {
      rateLimiter.tryConsume("key1");
      rateLimiter.tryConsume("key1");
      rateLimiter.tryConsume("key1");

      expect(rateLimiter.tryConsume("key1")).toBe(false);

      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(rateLimiter.tryConsume("key1")).toBe(true);
    });
  });

  describe("getOldestAttempt", () => {
    test("should return undefined for non-existent key", () => {
      expect(rateLimiter.getOldestAttempt("key1")).toBeUndefined();
    });

    test("should return oldest attempt timestamp", () => {
      const before = Date.now();
      rateLimiter.tryConsume("key1");
      const oldest = rateLimiter.getOldestAttempt("key1");

      expect(oldest).toBeDefined();
      expect(oldest).toBeGreaterThanOrEqual(before);
      expect(oldest).toBeLessThanOrEqual(Date.now());
    });

    test("should return correct oldest when multiple attempts", () => {
      rateLimiter.tryConsume("key1");
      const firstAttempt = rateLimiter.getOldestAttempt("key1");

      rateLimiter.tryConsume("key1");
      const secondCall = rateLimiter.getOldestAttempt("key1");

      expect(secondCall).toBe(firstAttempt);
    });
  });

  describe("getStats", () => {
    test("should return zero stats initially", () => {
      const stats = rateLimiter.getStats();
      expect(stats.totalKeys).toBe(0);
      expect(stats.totalAttempts).toBe(0);
    });

    test("should count total keys and attempts", () => {
      rateLimiter.tryConsume("key1");
      rateLimiter.tryConsume("key1");
      rateLimiter.tryConsume("key2");

      const stats = rateLimiter.getStats();
      expect(stats.totalKeys).toBe(2);
      expect(stats.totalAttempts).toBe(3);
    });

    test("should update stats after clear", () => {
      rateLimiter.tryConsume("key1");
      rateLimiter.tryConsume("key2");

      rateLimiter.clear("key1");

      const stats = rateLimiter.getStats();
      expect(stats.totalKeys).toBe(1);
      expect(stats.totalAttempts).toBe(1);
    });
  });

  describe("clear", () => {
    test("should clear specific key", () => {
      rateLimiter.tryConsume("key1");
      rateLimiter.tryConsume("key1");
      rateLimiter.tryConsume("key1");

      expect(rateLimiter.tryConsume("key1")).toBe(false);

      rateLimiter.clear("key1");

      expect(rateLimiter.tryConsume("key1")).toBe(true);
    });

    test("should not affect other keys", () => {
      rateLimiter.tryConsume("key1");
      rateLimiter.tryConsume("key2");

      rateLimiter.clear("key1");

      const stats = rateLimiter.getStats();
      expect(stats.totalKeys).toBe(1);
      expect(rateLimiter.getOldestAttempt("key2")).toBeDefined();
    });
  });

  describe("clearAll", () => {
    test("should clear all keys", () => {
      rateLimiter.tryConsume("key1");
      rateLimiter.tryConsume("key2");
      rateLimiter.tryConsume("key3");

      rateLimiter.clearAll();

      const stats = rateLimiter.getStats();
      expect(stats.totalKeys).toBe(0);
      expect(stats.totalAttempts).toBe(0);
    });
  });

  describe("check and consume", () => {
    test("check should not consume attempts", () => {
      expect(rateLimiter.check("key1")).toBe(true);
      expect(rateLimiter.check("key1")).toBe(true);
      expect(rateLimiter.check("key1")).toBe(true);
      expect(rateLimiter.check("key1")).toBe(true);

      const stats = rateLimiter.getStats();
      expect(stats.totalAttempts).toBe(0);
    });

    test("consume should increment attempts", () => {
      rateLimiter.consume("key1");
      rateLimiter.consume("key1");

      const stats = rateLimiter.getStats();
      expect(stats.totalAttempts).toBe(2);
    });

    test("check after consume should respect limits", () => {
      rateLimiter.consume("key1");
      rateLimiter.consume("key1");
      rateLimiter.consume("key1");

      expect(rateLimiter.check("key1")).toBe(false);
    });

    test("manual check-consume pattern should work like tryConsume", () => {
      expect(rateLimiter.check("key1")).toBe(true);
      rateLimiter.consume("key1");

      expect(rateLimiter.check("key1")).toBe(true);
      rateLimiter.consume("key1");

      expect(rateLimiter.check("key1")).toBe(true);
      rateLimiter.consume("key1");

      expect(rateLimiter.check("key1")).toBe(false);

      const stats = rateLimiter.getStats();
      expect(stats.totalAttempts).toBe(3);
    });

    test("consume without check should still increment", () => {
      rateLimiter.consume("key1");
      rateLimiter.consume("key1");
      rateLimiter.consume("key1");
      rateLimiter.consume("key1");

      expect(rateLimiter.check("key1")).toBe(false);

      const stats = rateLimiter.getStats();
      expect(stats.totalAttempts).toBe(4);
    });
  });
});
