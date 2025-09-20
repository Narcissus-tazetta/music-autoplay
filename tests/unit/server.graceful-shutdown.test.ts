import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Server } from "http";
import express from "express";

// Graceful shutdown のテスト
describe("Graceful Shutdown", () => {
  let mockServer: any;
  let mockSocketServer: any;
  let mockFileStore: any;
  let originalProcessExit: typeof process.exit;

  beforeEach(() => {
    // Mock HTTP server
    mockServer = {
      close: vi.fn((callback) => {
        if (callback) setTimeout(callback, 10);
      }),
      address: vi.fn().mockReturnValue({ port: 3000 }),
      on: vi.fn(),
    };

    // Mock SocketServerInstance
    mockSocketServer = {
      close: vi.fn().mockResolvedValue(undefined),
      init: vi.fn().mockResolvedValue(undefined),
    };

    // Mock FileStore
    mockFileStore = {
      flush: vi.fn().mockResolvedValue(undefined),
      closeSync: vi.fn(),
    };

    // Mock process.exit to prevent actual exit during tests
    originalProcessExit = process.exit;
    process.exit = vi.fn() as any;
  });

  afterEach(() => {
    process.exit = originalProcessExit;
    vi.clearAllTimers();
  });

  // Simplified graceful shutdown function for testing
  const createGracefulShutdown = (
    server: any,
    socketServer: any,
    fileStore: any,
    shutdownTimeout = 5000,
  ) => {
    return async () => {
      const forceExit = () => {
        console.error("graceful shutdown timeout, forcing exit");
        process.exit(1);
      };

      const timer = setTimeout(forceExit, shutdownTimeout);

      try {
        console.log("graceful shutdown initiated");

        // Close HTTP server
        await new Promise<void>((resolve, reject) => {
          server.close((err?: Error) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
        console.log("http server closed");

        // Close socket server
        try {
          await socketServer.close();
          console.log("socket.io closed");
        } catch (e: unknown) {
          console.warn("error while closing socket.io", e);
        }

        // Flush file store
        try {
          await fileStore.flush();
          console.log("filestore flushed");
        } catch (e) {
          console.warn("fileStore.flush failed, attempting sync close", e);
          try {
            fileStore.closeSync();
          } catch (err) {
            console.warn("fileStore.closeSync failed", err);
          }
        }

        clearTimeout(timer);
        console.log("graceful shutdown complete, exiting");
        process.exit(0);
      } catch (e) {
        clearTimeout(timer);
        console.error("graceful shutdown failed", e);
        process.exit(1);
      }
    };
  };

  it("should shutdown gracefully when all components close successfully", async () => {
    vi.useFakeTimers();

    const gracefulShutdown = createGracefulShutdown(
      mockServer,
      mockSocketServer,
      mockFileStore,
      5000,
    );

    const shutdownPromise = gracefulShutdown();

    // Fast-forward past server close delay
    await vi.advanceTimersByTimeAsync(20);

    await shutdownPromise;

    expect(mockServer.close).toHaveBeenCalledTimes(1);
    expect(mockSocketServer.close).toHaveBeenCalledTimes(1);
    expect(mockFileStore.flush).toHaveBeenCalledTimes(1);
    expect(process.exit).toHaveBeenCalledWith(0);

    vi.useRealTimers();
  });

  it("should force exit after timeout", async () => {
    vi.useFakeTimers();

    // Make server close hang
    mockServer.close = vi.fn(() => {
      // Never call callback - simulate hanging
    });

    const gracefulShutdown = createGracefulShutdown(
      mockServer,
      mockSocketServer,
      mockFileStore,
      1000, // Short timeout for test
    );

    gracefulShutdown();

    // Fast-forward past timeout
    await vi.advanceTimersByTimeAsync(1100);

    expect(process.exit).toHaveBeenCalledWith(1);

    vi.useRealTimers();
  });

  it("should handle socket server close errors gracefully", async () => {
    vi.useFakeTimers();

    mockSocketServer.close = vi
      .fn()
      .mockRejectedValue(new Error("Socket close failed"));

    const gracefulShutdown = createGracefulShutdown(
      mockServer,
      mockSocketServer,
      mockFileStore,
      5000,
    );

    const shutdownPromise = gracefulShutdown();

    await vi.advanceTimersByTimeAsync(20);
    await shutdownPromise;

    expect(mockServer.close).toHaveBeenCalledTimes(1);
    expect(mockSocketServer.close).toHaveBeenCalledTimes(1);
    expect(mockFileStore.flush).toHaveBeenCalledTimes(1);
    expect(process.exit).toHaveBeenCalledWith(0); // Should still exit successfully

    vi.useRealTimers();
  });

  it("should use sync close when fileStore flush fails", async () => {
    vi.useFakeTimers();

    mockFileStore.flush = vi.fn().mockRejectedValue(new Error("Flush failed"));

    const gracefulShutdown = createGracefulShutdown(
      mockServer,
      mockSocketServer,
      mockFileStore,
      5000,
    );

    const shutdownPromise = gracefulShutdown();

    await vi.advanceTimersByTimeAsync(20);
    await shutdownPromise;

    expect(mockFileStore.flush).toHaveBeenCalledTimes(1);
    expect(mockFileStore.closeSync).toHaveBeenCalledTimes(1);
    expect(process.exit).toHaveBeenCalledWith(0);

    vi.useRealTimers();
  });
});
