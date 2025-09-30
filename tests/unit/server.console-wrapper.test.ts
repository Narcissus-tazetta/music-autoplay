/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Console wrapper のテスト
describe("Console Error/Warn Wrapper", () => {
  let originalConsoleError: typeof console.error;
  let originalConsoleWarn: typeof console.warn;
  let mockLogger: {
    error: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
  };
  let errorSpy: ReturnType<typeof vi.fn>;
  let warnSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Preserve original console methods
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;

    // Mock logger spies

    errorSpy = vi.fn();

    warnSpy = vi.fn();
    mockLogger = {
      error: (...args: unknown[]) => {
        errorSpy(...args);
      },
      warn: (...args: unknown[]) => {
        warnSpy(...args);
      },
    };
  });

  afterEach(() => {
    // Restore original console methods
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  const setupConsoleWrapper = (logger: {
    error: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
  }) => {
    const _origConsoleError = console.error.bind(console);
    const _origConsoleWarn = console.warn.bind(console);

    console.error = (...args: unknown[]) => {
      try {
        logger.error("console.error", { args, stack: new Error().stack });
      } catch (e) {
        try {
          _origConsoleError("failed to log console.error via logger", e);
        } catch (_err) {
          void _err;
        }
      }
      try {
        _origConsoleError(...(args as [unknown, ...unknown[]]));
      } catch (_err) {
        void _err;
      }
    };

    console.warn = (...args: unknown[]) => {
      try {
        logger.warn("console.warn", { args, stack: new Error().stack });
      } catch (e) {
        try {
          _origConsoleWarn("failed to log console.warn via logger", e);
        } catch (_err) {
          void _err;
        }
      }
      try {
        _origConsoleWarn(...(args as [unknown, ...unknown[]]));
      } catch (_err) {
        void _err;
      }
    };
  };

  it("should wrap console.error and log through logger", () => {
    setupConsoleWrapper(mockLogger);

    console.error("test error message", { detail: "error details" });

    expect(errorSpy).toHaveBeenCalledWith(
      "console.error",
      expect.objectContaining({
        args: ["test error message", { detail: "error details" }],
        stack: expect.stringContaining("Error"),
      }),
    );
  });

  it("should wrap console.warn and log through logger", () => {
    setupConsoleWrapper(mockLogger);

    console.warn("test warning message", 123);

    expect(warnSpy).toHaveBeenCalledWith(
      "console.warn",
      expect.objectContaining({
        args: ["test warning message", 123],
        stack: expect.stringContaining("Error"),
      }),
    );
  });

  it("should handle logger errors gracefully and still call original console", () => {
    // Make logger throw error (spy that throws so we can assert it was called)

    mockLogger.error = vi.fn(() => {
      throw new Error("Logger failed");
    });

    setupConsoleWrapper(mockLogger);

    // Should not throw error even if logger fails
    expect(() => {
      console.error("test message");
    }).not.toThrow();

    // assert the throwing spy was invoked

    expect(mockLogger.error as ReturnType<typeof vi.fn>).toHaveBeenCalled();
  });

  it("should capture stack trace in logged error", () => {
    setupConsoleWrapper(mockLogger);

    function testFunction() {
      console.error("error from function");
    }

    testFunction();

    expect(errorSpy).toHaveBeenCalledWith(
      "console.error",
      expect.objectContaining({
        args: ["error from function"],
        stack: expect.stringContaining("testFunction"),
      }),
    );
  });

  it("should handle various argument types", () => {
    setupConsoleWrapper(mockLogger);

    const testObj = { key: "value" };
    const testArray = [1, 2, 3];
    const testError = new Error("test error");

    console.error(
      "string",
      42,
      true,
      testObj,
      testArray,
      testError,
      null,
      undefined,
    );

    expect(errorSpy).toHaveBeenCalledWith(
      "console.error",
      expect.objectContaining({
        args: [
          "string",
          42,
          true,
          testObj,
          testArray,
          testError,
          null,
          undefined,
        ],
      }),
    );
  });
});
