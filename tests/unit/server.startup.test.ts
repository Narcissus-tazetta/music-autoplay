/* eslint-disable @typescript-eslint/no-misused-promises, @typescript-eslint/no-unused-expressions, no-empty, @typescript-eslint/no-unnecessary-condition */
import express from "express";
import { createServer, Server } from "http";
import { afterEach, describe, expect, it, vi } from "vitest";

// HTTPサーバーの起動・停止とエラーハンドリングのテスト
describe("HTTP Server startup and error handling", () => {
  let server: Server | null = null;
  let server2: Server | null = null;

  afterEach(async () => {
    // Close secondary server first if present
    if (server2) {
      try {
        await new Promise<void>((resolve) => {
          if (server2) {
            server2.close(() => {
              resolve();
            });
          } else {
            resolve();
          }
        });
      } catch (err) {
        void err;
      }
      server2 = null;
    }

    if (server) {
      try {
        const s = server;
        await new Promise<void>((resolve) =>
          s.close(() => {
            resolve();
          }),
        );
      } catch {
        /* ignore */
      }
      server = null;
    }
  });

  it("should start server on available port", async () => {
    const app = express();

    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, () => {
        // port 0 = any available port
        const address = server ? server.address() : null;
        expect(address).toBeTruthy();
        if (address && typeof address === "object") {
          // address is AddressInfo-like
          const addrObj = address as { port?: number };
          expect(typeof addrObj.port).toBe("number");
          expect(addrObj.port && addrObj.port > 0).toBe(true);
        } else {
          // on some platforms address may be a string (pipe); ensure it's not falsy
          expect(typeof address).toBe("string");
        }
        resolve();
      });

      server.on("error", reject);
    });
  });

  it("should handle EADDRINUSE error gracefully", async () => {
    const app1 = express();
    const app2 = express();

    // Start first server on a specific port
    await new Promise<void>((resolve, reject) => {
      server = app1.listen(0, () => {
        const addr = server ? server.address() : null;
        const port =
          typeof addr === "object" && addr && "port" in addr
            ? (addr as { port?: number }).port
            : undefined;
        // Create the underlying server instance so we can attach handlers before listen
        server2 = createServer(app2);

        const errPromise = new Promise<unknown>((res) => {
          if (server2) {
            server2.once("error", (err) => {
              res(err);
            });
          }
        });

        // Now attempt to listen on the same port; the error (if any) will be captured
        if (typeof port === "number") server2.listen(port);
        else {
          // fallback: listen on 0 to force binding
          server2.listen(0);
        }

        errPromise
          .then((err) => {
            const e = err as NodeJS.ErrnoException;
            expect(e && e.code).toBe("EADDRINUSE");
            // ensure server2 is cleaned up if possible
            try {
              server2 && server2.close();
            } catch {}
            resolve();
          })
          .catch(reject);
      });

      server.on("error", reject);
    });
  });

  it("should handle server close gracefully", async () => {
    const app = express();

    server = await new Promise<Server>((resolve, reject) => {
      const s = app.listen(0, () => {
        resolve(s);
      });
      s.on("error", reject);
    });

    const closePromise = new Promise<void>((resolve) => {
      if (server) {
        server.close(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });

    await expect(closePromise).resolves.toBeUndefined();
  });
});
