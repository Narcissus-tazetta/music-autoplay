/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-floating-promises */
import express from "express";
import { Server } from "http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Graceful shutdown のテスト
describe("Graceful Shutdown", () => {
  type MockServer = {
    close: (cb?: (err?: Error) => void) => void;
    address: () => { port: number };
    on: (...args: unknown[]) => void;
  };

  type MockSocketServer = {
    close: () => Promise<void>;
    init: () => Promise<void>;
  };

  type MockFileStore = {
    flush: () => Promise<void>;
    closeSync: () => void;
  };

  let mockServer: MockServer;
  let mockSocketServer: MockSocketServer;
  let mockFileStore: MockFileStore;
  let originalProcessExit: typeof process.exit;

  beforeEach(() => {
    // Mock HTTP server
    mockServer = {
      close: vi.fn((callback?: (err?: Error) => void) => {
        if (callback) {
          setTimeout(() => {
            callback();
          }, 10);
        }
      }) as unknown as (cb?: (err?: Error) => void) => void,
      address: () => ({ port: 3000 }),
      on: () => {},
    };

    // Mock SocketServerInstance
    mockSocketServer = {
      close: vi
        .fn()
        .mockResolvedValue(undefined) as unknown as () => Promise<void>,
      init: vi
        .fn()
        .mockResolvedValue(undefined) as unknown as () => Promise<void>,
    };

    // Mock FileStore
    mockFileStore = {
      flush: vi
        .fn()
        .mockResolvedValue(undefined) as unknown as () => Promise<void>,
      closeSync: vi.fn() as unknown as () => void,
    };

    // Mock process.exit to prevent actual exit during tests
    originalProcessExit = process.exit;
    const fakeExit = vi.fn(
      (code?: number) => {},
    ) as unknown as typeof process.exit;
    process.exit = fakeExit;
  });

  afterEach(() => {
    process.exit = originalProcessExit;
    vi.clearAllTimers();
  });

  // Simplified graceful shutdown function for testing
  const createGracefulShutdown = (
    server: MockServer,
    socketServer: MockSocketServer,
    fileStore: MockFileStore,
    shutdownTimeout = 5000,
  ) => {
    return async () => {
      const forceExit = () => {
        console.error("graceful shutdown timeout, forcing exit");
        process.exit(1);
      };

      const timer = setTimeout(() => {
        forceExit();
      }, shutdownTimeout);

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
