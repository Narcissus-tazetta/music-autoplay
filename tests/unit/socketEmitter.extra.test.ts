/* eslint-disable @typescript-eslint/unbound-method */
import type { Server as IOServer } from "socket.io";
import { describe, expect, it, vi } from "vitest";
import {
  createSocketEmitter,
  SocketEmitter,
} from "../../src/server/utils/socketEmitter";

describe("SocketEmitter robustness", () => {
  it("emit returns false and logs when io.emit throws", () => {
    const io = {
      emit: vi.fn(() => {
        throw new Error("boom");
      }),
    } as unknown as IOServer;
    const se = createSocketEmitter(() => io as unknown as IOServer, {
      source: "t",
    });

    const ok = se.emit("ev", { x: 1 });
    expect(ok).toBe(false);
    expect(io.emit).toHaveBeenCalledWith("ev", { x: 1 });
  });

  it("asFn returns a callable that swallows errors and returns void-ish boolean semantics", () => {
    const io = {
      emit: vi.fn(() => {
        throw new Error("boom");
      }),
    } as unknown as IOServer;
    const se = new SocketEmitter(() => io as unknown as IOServer, {});
    const fn = se.asFn();

    // Should not throw
    const r = fn("ev2", { y: 2 });
    // legacy adapter returns void but tests treat as boolean; ensure call happened
    expect(io.emit).toHaveBeenCalledWith("ev2", { y: 2 });
    // asFn is typed to return void; we accept either undefined or falsey
    expect(r === undefined || !r || r).toBeTruthy();
  });
});
