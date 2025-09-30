import type { C2S, S2C } from "@/shared/types/socket";
import { io, type Socket } from "socket.io-client";

let socket: Socket<S2C, C2S> | null = null;

function attachDebugListeners(s: Socket<S2C, C2S>) {
  const safeLog = (...args: unknown[]) => {
    console.debug(...args);
  };

  s.on("connect", () => {
    safeLog("[socket] connect", s.id);
  });
  s.on("connect_error", (err: unknown) => {
    if (err instanceof Error)
      console.error("[socket] connect_error", err.message);
    else
      console.error(
        "[socket] connect_error",
        typeof err === "string" ? err : String(err),
      );
  });
  s.on("disconnect", (reason) => {
    safeLog("[socket] disconnect", reason);
  });
  (s as unknown as { on?: (...a: unknown[]) => void }).on?.(
    "reconnect_attempt",
    (n: number) => {
      safeLog("[socket] reconnect_attempt", n);
    },
  );
  (s as unknown as { on?: (...a: unknown[]) => void }).on?.(
    "reconnect_failed",
    () => {
      safeLog("[socket] reconnect_failed");
    },
  );
}

function attachAutoSync(s: Socket<S2C, C2S>) {
  const tryGetAll = (maxAttempts = 3) => {
    let attempt = 0;
    const doTry = () => {
      attempt++;
      let called = false;
      const timeout = setTimeout(() => {
        if (called) return;
        called = true;
        if (attempt < maxAttempts) {
          const backoff = 500 * Math.pow(2, attempt - 1);
          setTimeout(doTry, backoff);
        }
      }, 2000);
      try {
        s.emit("getAllMusics", (musics: unknown) => {
          if (called) return;
          called = true;
          clearTimeout(timeout);
          try {
            if (Array.isArray(musics)) {
              // consumers (stores) will register their own handlers; we just
              // emit an event to allow external listeners to handle payload.
              (
                s as unknown as {
                  emitClientSync?: (name: string, payload: unknown) => void;
                }
              ).emitClientSync?.("client:getAllMusics:response", musics);
            }
          } catch (e) {
            /* ignore consumer handler errors */
            void e;
          }
        });
      } catch (e) {
        if (attempt < maxAttempts) {
          const backoff = 500 * Math.pow(2, attempt - 1);
          setTimeout(doTry, backoff);
        }
        void e;
      }
    };
    doTry();
  };

  s.on("connect", () => {
    tryGetAll();
  });
  (s as unknown as { on?: (...a: unknown[]) => void }).on?.(
    "reconnect_attempt",
    () => {
      tryGetAll();
    },
  );
}

export function getSocket(): Socket<S2C, C2S> {
  if (!socket) {
    const DEFAULT_PATH = "/api/socket.io";
    let path = DEFAULT_PATH;
    let connectUrl: string | undefined = undefined;

    const win =
      typeof window !== "undefined"
        ? (window as unknown as Record<string, unknown>)
        : undefined;
    if (win && typeof win.SOCKET_URL === "string" && win.SOCKET_URL.length > 0)
      connectUrl = win.SOCKET_URL;
    if (
      win &&
      typeof win.SOCKET_PATH === "string" &&
      win.SOCKET_PATH.length > 0
    )
      path = win.SOCKET_PATH;

    let triedDiagnostics = false;
    let triedLegacy = false;

    const makeSocket = (p: string, origin?: string) => {
      return io(origin, {
        autoConnect: false,
        path: p,
        transports: ["polling", "websocket"],
        reconnection: true,
        reconnectionAttempts: 6,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        randomizationFactor: 0.5,
      }) as Socket<S2C, C2S>;
    };

    socket = makeSocket(path, connectUrl);
    try {
      attachDebugListeners(socket);
      attachAutoSync(socket);
    } catch {
      console.warn("[socket] failed to attach debug listeners or autosync");
    }

    socket.on("connect_error", () => {
      try {
        if (triedDiagnostics) return;
        triedDiagnostics = true;
        if (typeof fetch !== "function") return;
        void fetch("/diagnostics/socket")
          .then((resp) => {
            if (!resp.ok) return null;
            return resp.json().catch(() => null);
          })
          .then((body: unknown) => {
            if (!body || typeof body !== "object") return;
            try {
              const rec = body as Record<string, unknown>;
              const discoveredPath =
                typeof rec.socketPath === "string" ? rec.socketPath : undefined;
              const discoveredOrigin =
                typeof rec.origin === "string" ? rec.origin : undefined;
              if (discoveredPath && discoveredPath !== path) {
                try {
                  socket?.close();
                } catch (e) {
                  console.debug("socketClient close failed", e);
                }
                path = discoveredPath;
                if (
                  discoveredOrigin &&
                  !connectUrl &&
                  /^https?:\/\//.test(discoveredOrigin)
                )
                  connectUrl = discoveredOrigin;
                socket = makeSocket(path, connectUrl);
                try {
                  attachDebugListeners(socket);
                } catch (e) {
                  console.debug("socketClient attachDebugListeners failed", e);
                }
                socket.connect();
                return;
              }
            } catch {
              console.debug("socketClient diagnostics parse failed");
            }
            if (!triedLegacy) {
              triedLegacy = true;
              try {
                socket?.close();
              } catch (e) {
                console.debug("socketClient close failed", e);
              }
              path = "/socket.io";
              socket = makeSocket(path, connectUrl);
              try {
                attachDebugListeners(socket);
              } catch (e) {
                console.debug("socketClient attachDebugListeners failed", e);
              }
              socket.connect();
            }
          })
          .catch((e: unknown) => {
            console.debug("socketClient diagnostics fetch failed", e);
            if (!triedLegacy) {
              triedLegacy = true;
              try {
                socket?.close();
              } catch (err) {
                console.debug("socketClient close failed", err);
              }
              path = "/socket.io";
              socket = makeSocket(path, connectUrl);
              try {
                attachDebugListeners(socket);
              } catch (err) {
                console.debug("socketClient attachDebugListeners failed", err);
              }
              socket.connect();
            }
          });
      } catch (e) {
        // intentionally ignore errors from the diagnostics flow
        void e;
      }
    });
  }
  return socket;
}
