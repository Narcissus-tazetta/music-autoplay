import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import { Server, createServer } from "http";

// HTTPサーバーの起動・停止とエラーハンドリングのテスト
describe("HTTP Server startup and error handling", () => {
  let server: Server | null = null;
  let server2: Server | null = null;

  afterEach(async () => {
    // Close secondary server first if present
    if (server2) {
      try {
        await new Promise<void>((resolve) => server2!.close(() => resolve()));
      } catch {
        /* ignore */
      }
      server2 = null;
    }

    if (server) {
      try {
        await new Promise<void>((resolve) => server!.close(() => resolve()));
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
        const address = server!.address();
        expect(address).toBeTruthy();
        if (typeof address === "object" && address !== null) {
          expect((address as any).port).toBeGreaterThan(0);
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
        const port = (server!.address() as any).port;
        // Create the underlying server instance so we can attach handlers before listen
        server2 = createServer(app2);

        const errPromise = new Promise<unknown>((res) => {
          server2!.once("error", (err) => res(err));
        });

        // Now attempt to listen on the same port; the error (if any) will be captured
        server2!.listen(port);

        void errPromise.then((err) => {
          const e = err as NodeJS.ErrnoException;
          expect(e && e.code).toBe("EADDRINUSE");
          // ensure server2 is cleaned up if possible
          try {
            server2 && server2.close();
          } catch {}
          resolve();
        });
      });

      server.on("error", reject);
    });
  });

  it("should handle server close gracefully", async () => {
    const app = express();

    server = await new Promise<Server>((resolve, reject) => {
      const s = app.listen(0, () => resolve(s));
      s.on("error", reject);
    });

    const closePromise = new Promise<void>((resolve) => {
      server!.close(() => resolve());
    });

    await expect(closePromise).resolves.toBeUndefined();
  });
});
