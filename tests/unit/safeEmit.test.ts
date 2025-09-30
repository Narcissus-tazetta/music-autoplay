/**
 * Unit tests for safeEmit utilities
 */

/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */

import type { Server as IOServer } from "socket.io";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSafeEmitter,
  safeEmit,
  safeEmitSync,
  wrapEmitWithSafety,
} from "../../src/server/utils/safeEmit";

// Mock logger
vi.mock("../../src/server/logger", () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("safeEmit utilities", () => {
  let mockEmitter: IOServer;
  let mockEmit: any;

  beforeEach(() => {
    mockEmit = vi.fn();
    mockEmitter = { emit: mockEmit } as unknown as IOServer;
  });
  describe("safeEmit", () => {
    it("should emit successfully and return true", () => {
      const result = safeEmit(mockEmitter, "musicAdded", {
        id: "test",
        title: "Test Song",
      });

      expect(result).toBe(true);
      expect(mockEmit).toHaveBeenCalledWith("musicAdded", {
        id: "test",
        title: "Test Song",
      });
    });

    it("should handle emit errors and return false", () => {
      mockEmit.mockImplementation(() => {
        throw new Error("Emit failed");
      });

      const result = safeEmit(mockEmitter, "musicAdded", {
        id: "test",
        title: "Test Song",
      });

      expect(result).toBe(false);
      expect(mockEmit).toHaveBeenCalled();
    });
    it("should emit with multiple arguments", () => {
      const result = safeEmit(mockEmitter, "initMusics", [
        {
          id: "1",
          title: "Song 1",
          url: "https://youtube.com/1",
          channelName: "Test Channel",
          channelId: "UC123",
          duration: "PT3M30S",
        },
      ]);

      expect(result).toBe(true);
      expect(mockEmit).toHaveBeenCalledWith("initMusics", [
        {
          id: "1",
          title: "Song 1",
          url: "https://youtube.com/1",
          channelName: "Test Channel",
          channelId: "UC123",
          duration: "PT3M30S",
        },
      ]);
    });

    it("should handle emit with context options", () => {
      const result = safeEmit(
        mockEmitter,
        "musicAdded",
        { id: "test", title: "Test Song" },
        {
          context: {
            source: "TestService",
            identifiers: { musicId: "test" },
          },
        },
      );

      expect(result).toBe(true);
      expect(mockEmit).toHaveBeenCalledWith("musicAdded", {
        id: "test",
        title: "Test Song",
      });
    });

    it("should handle invalid emitter", () => {
      const invalidEmitter = {} as IOServer;
      const result = safeEmit(invalidEmitter, "musicAdded", {
        id: "test",
        title: "Test Song",
      });

      expect(result).toBe(false);
    });
  });

  describe("safeEmitSync", () => {
    it("should emit successfully and return true", () => {
      const result = safeEmitSync(mockEmitter, "musicRemoved", "test-id");

      expect(result).toBe(true);
      expect(mockEmit).toHaveBeenCalledWith("musicRemoved", "test-id");
    });

    it("should handle emit errors and return false", () => {
      mockEmit.mockImplementation(() => {
        throw new Error("Emit failed");
      });

      const result = safeEmitSync(mockEmitter, "musicRemoved", "test-id");

      expect(result).toBe(false);
      expect(mockEmit).toHaveBeenCalled();
    });
  });

  describe("createSafeEmitter", () => {
    it("should create emitter with default context", () => {
      const boundEmitter = createSafeEmitter(mockEmitter, {
        source: "TestService",
        operation: "testOperation",
      });

      const result = boundEmitter("musicAdded", {
        id: "test",
        title: "Test Song",
      });

      expect(result).toBe(true);
      expect(mockEmit).toHaveBeenCalledWith("musicAdded", {
        id: "test",
        title: "Test Song",
      });
    });

    it("should merge default context with user context", () => {
      const boundEmitter = createSafeEmitter(mockEmitter, {
        source: "TestService",
        identifiers: { defaultId: "default" },
      });

      const result = boundEmitter(
        "musicAdded",
        { id: "test", title: "Test Song" },
        {
          context: {
            identifiers: { musicId: "test" },
          },
        },
      );

      expect(result).toBe(true);
      expect(mockEmit).toHaveBeenCalledWith("musicAdded", {
        id: "test",
        title: "Test Song",
      });
    });
  });

  describe("wrapEmitWithSafety", () => {
    it("should wrap existing emit function", () => {
      const originalEmit = vi.fn();
      const wrappedEmit = wrapEmitWithSafety(originalEmit);

      const result = wrappedEmit("musicAdded", {
        id: "test",
        title: "Test Song",
      });

      expect(result).toBe(true);
      expect(originalEmit).toHaveBeenCalledWith("musicAdded", {
        id: "test",
        title: "Test Song",
      });
    });

    it("should handle wrapped emit errors", () => {
      const originalEmit = vi.fn(() => {
        throw new Error("Emit failed");
      });
      const wrappedEmit = wrapEmitWithSafety(originalEmit);

      const result = wrappedEmit("musicAdded", {
        id: "test",
        title: "Test Song",
      });

      expect(result).toBe(false);
      expect(originalEmit).toHaveBeenCalled();
    });
  });

  describe("error logging", () => {
    it("should log errors with proper context", async () => {
      const logger = await import("../../src/server/logger");
      vi.clearAllMocks();
      mockEmit.mockImplementation(() => {
        throw new Error("Test error");
      });

      safeEmit(
        mockEmitter,
        "musicAdded",
        { id: "test", title: "Test Song" },
        {
          context: {
            source: "TestService",
            operation: "addMusic",
            identifiers: { musicId: "test" },
          },
        },
      );

      expect(logger.default.warn).toHaveBeenCalledWith(
        "failed to emit musicAdded",
        expect.objectContaining({
          error: expect.any(Error),
          event: "musicAdded",
          musicId: "test",
        }),
      );
    });

    it("should support custom error prefix", async () => {
      const logger = await import("../../src/server/logger");
      vi.clearAllMocks();
      mockEmit.mockImplementation(() => {
        throw new Error("Test error");
      });

      safeEmit(
        mockEmitter,
        "musicAdded",
        { id: "test", title: "Test Song" },
        {
          errorPrefix: "custom prefix",
        },
      );

      expect(logger.default.warn).toHaveBeenCalledWith(
        "custom prefix musicAdded",
        expect.objectContaining({
          error: expect.any(Error),
        }),
      );
    });

    it("should support custom log level", async () => {
      const logger = await import("../../src/server/logger");
      vi.clearAllMocks();
      mockEmit.mockImplementation(() => {
        throw new Error("Test error");
      });

      safeEmit(
        mockEmitter,
        "musicAdded",
        { id: "test", title: "Test Song" },
        {
          logLevel: "error",
        },
      );

      expect(logger.default.error).toHaveBeenCalledWith(
        "failed to emit musicAdded",
        expect.objectContaining({
          error: expect.any(Error),
        }),
      );
    });

    it("should support silent mode", async () => {
      const logger = await import("../../src/server/logger");
      vi.clearAllMocks();
      mockEmit.mockImplementation(() => {
        throw new Error("Test error");
      });

      const result = safeEmit(
        mockEmitter,
        "musicAdded",
        { id: "test", title: "Test Song" },
        {
          silent: true,
        },
      );

      expect(result).toBe(false);
      expect(logger.default.warn).not.toHaveBeenCalled();
      expect(logger.default.error).not.toHaveBeenCalled();
    });
  });
});
