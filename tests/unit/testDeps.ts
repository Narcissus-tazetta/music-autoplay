import type createMusicHandlers from "../../src/server/handlers/music";
import type { TestDeps } from "../../src/server/handlers/testHelpers";
import type { Socket } from "socket.io";
import { makeTestDeps } from "../../src/server/handlers/testHelpers";

type Deps = Parameters<typeof createMusicHandlers>[0];

export function makeDeps(overrides?: Partial<TestDeps>): Deps {
  // `makeTestDeps` already returns the strict Deps shape used in handlers,
  // so we can forward directly. Tests pass a loose Partial<TestDeps> for
  // convenience.
  return makeTestDeps(overrides ?? {});
}

/**
 * Create a minimal Socket stub for tests. Centralizes the single
 * cast from test code to Socket in one place so individual tests
 * don't need to use `as unknown as Socket` repeatedly.
 */
export function makeSocket(stubs: Record<string, unknown>): Socket {
  // Build a minimal, recursive partial socket so `.on` / `.emit` can return it.
  const base: Partial<Socket> = {};
  base.on = () => base as Socket;
  // socket.emit in types returns boolean
  base.emit = () => false;

  // Merge stubs onto partial base
  const mergedPartial: Partial<Socket> = Object.assign({}, base, stubs);

  // If user provided an `on`, wrap it so it still returns the socket
  const userOn = (stubs as Partial<Record<string, unknown>>).on as
    | undefined
    | ((ev: unknown, cb?: (...args: unknown[]) => void) => void);
  if (typeof userOn === "function") {
    mergedPartial.on = ((ev: unknown, cb?: (...args: unknown[]) => void) => {
      try {
        userOn(ev, cb);
      } catch {
        // swallow - tests should assert inside callbacks
      }
      return mergedPartial as Socket;
    }) as Socket["on"];
  }

  // If user provided an `emit`, wrap it so it still returns the socket
  const userEmit = (stubs as Partial<Record<string, unknown>>).emit as
    | undefined
    | ((ev: unknown, payload?: unknown) => void);
  if (typeof userEmit === "function") {
    mergedPartial.emit = ((ev: unknown, payload?: unknown) => {
      try {
        userEmit(ev, payload);
      } catch {
        // swallow
      }
      return false;
    }) as Socket["emit"];
  }

  return mergedPartial as Socket;
}

/** Create a minimal, typed `io` stub for tests that captures emits. */
export function makeIo(
  onEmit?: (ev: string, payload?: unknown) => void,
): Deps["io"] {
  const ioPartial: Partial<Deps["io"]> = {
    emit: (ev: string, payload?: unknown) => {
      onEmit?.(ev, payload);
      return false;
    },
  };
  return ioPartial as Deps["io"];
}

/** Create a minimal youtubeService stub. Accepts a partial implementation used in tests. */
export function makeYoutubeService(stub?: unknown): Deps["youtubeService"] {
  // Accept a loose stub (unknown). We support either an object with
  // getVideoDetails or a function. Normalize to a callable `userGet`.
  const asRecord = stub as Partial<Record<string, unknown>> | undefined;
  const userGet =
    (asRecord && asRecord.getVideoDetails) ??
    (typeof stub === "function"
      ? (stub as (...args: unknown[]) => Promise<unknown>)
      : undefined) ??
    (() => Promise.resolve({ ok: false, error: "not implemented" }));

  type GetRT = Deps["youtubeService"]["getVideoDetails"];
  type GetInner = GetRT extends (...args: unknown[]) => Promise<infer U>
    ? U
    : GetRT;

  const getVideoDetails = async (
    id: string,
    _retries?: number,
    _timeoutMs?: number,
    _ttlMs?: number,
  ) => {
    // reference unused params to satisfy lint rules in tests
    void _retries;
    void _timeoutMs;
    void _ttlMs;
    const res = await (userGet as (...args: unknown[]) => Promise<unknown>)(id);
    // If stub already returned a Result-like object, pass through.
    if (res && typeof res === "object" && "ok" in res) {
      return res as GetInner;
    }
    // Otherwise treat stub result as the value and wrap as ok
    return Promise.resolve({ ok: true, value: res }) as ReturnType<
      Deps["youtubeService"]["getVideoDetails"]
    >;
  };

  return { getVideoDetails } as Deps["youtubeService"];
}

/** Create a minimal fileStore stub. */
export function makeFileStore(
  stub?: Partial<Deps["fileStore"]>,
): Deps["fileStore"] {
  const fs: Partial<Deps["fileStore"]> = {
    add: () => undefined,
    remove: () => undefined,
    ...stub,
  };
  return fs as Deps["fileStore"];
}

/** Safely extract formErrors from a reply value in tests. */
export function getFormErrors(reply: unknown): string[] | undefined {
  if (reply && typeof reply === "object" && "formErrors" in reply) {
    // Narrow to unknown record and then extract formErrors safely
    const r = reply as Record<string, unknown>;
    const fe = r.formErrors;
    return Array.isArray(fe) ? (fe as string[]) : undefined;
  }
  return undefined;
}
