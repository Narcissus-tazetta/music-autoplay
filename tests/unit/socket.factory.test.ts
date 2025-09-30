/* eslint-disable */

import type { Server as HttpServer } from "http";
import { beforeEach, describe, expect, it, vi } from "vitest";

// We'll import the factory under test after mocking its dependencies

const mockMusic = { id: "m1", title: "t", requesterHash: "h" };

describe("initSocketServer factory", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  // increase timeout for this file's tests (factory initialization may be slower under parallel runs)
  (vi as any).setTimeout?.(10000);

  it("loads persisted musics and registers connection handler", async () => {
    // mock fileStore
    type TestFileStore = {
      load: () => unknown[];
      flush: () => Promise<unknown>;
    };
    const fileStore = {
      load: vi.fn(() => [mockMusic]),
      flush: vi.fn(() => Promise.resolve()),
    } as unknown as TestFileStore;

    // mock createSocketIo to return an io-like object. Because vi.mock is hoisted,
    // create the io inside the mock factory and expose listeners via globalThis.
    vi.mock("../../src/server/socket/createSocketIo", () => {
      const listeners: Record<string, Function[]> = {};
      const mockIo = {
        on: (ev: string, h: (...args: unknown[]) => void) => {
          listeners[ev] = listeners[ev] || [];
          listeners[ev].push(h as Function);
        },
        emit: vi.fn(),
      } as unknown;
      // expose for test assertions
      (globalThis as any).__mockIo_listeners = listeners;
      (globalThis as any).__mockIo = mockIo;
      return {
        createSocketIo: (server: HttpServer) => ({
          io: mockIo,
          socketPath: "/socket.io",
        }),
      };
    });

    // mock connectionHandler module - create the spy inside the mock factory (hoisting-safe)
    vi.mock("../../src/server/socket/connectionHandler", () => {
      const fakeHandler = vi.fn((socket: unknown) => {});
      (globalThis as any).__fakeHandler = fakeHandler;
      return { makeConnectionHandler: () => fakeHandler, default: undefined };
    });

    // now import the factory under test (ESM dynamic import behavior respected)
    const { initSocketServer } = await import(
      "../../src/server/socket/factory"
    );

    // call factory
    const server = {} as unknown as HttpServer;
    const res = await initSocketServer(server, {
      musicDB: new Map<string, unknown>(),
      fileStore: fileStore as unknown as Parameters<
        typeof initSocketServer
      >[1]["fileStore"],
      adminHash: "ah",
      opts: { debounceMs: 10, graceMs: 10, inactivityMs: 1000 },
    } as unknown as Parameters<typeof initSocketServer>[1]);

    // expected: fileStore.load called and music stored in DB
    expect(fileStore.load).toHaveBeenCalled();
    expect(res.runtime).toBeDefined();

    // ensure io.on registered connection handler
    const g = globalThis as any;
    expect(g.__mockIo_listeners["connection"]).toBeDefined();
    expect(g.__mockIo_listeners["connection"][0]).toBeTruthy();
  }, 10000);
});
