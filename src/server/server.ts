import { createRequestHandler } from "@react-router/express";
import type { ServerBuild } from "react-router";

import compression from "compression";
import express from "express";
import morgan from "morgan";

import { SocketServerInstance } from "@/server/socket";
import FileStore from "@/server/musicPersistence";
import logger from "@/server/logger";
import type { ServerContext } from "@/shared/types/server";

import dotenv from "dotenv";
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const _origConsoleError = console.error.bind(console);
const _origConsoleWarn = console.warn.bind(console);
console.error = (...args: unknown[]) => {
  try {
    logger.error("console.error", { args, stack: new Error().stack });
  } catch (e) {
    try {
      _origConsoleError("failed to log console.error via logger", e);
    } catch {}
  }
  try {
    _origConsoleError(...(args as [unknown, ...unknown[]]));
  } catch {}
};
console.warn = (...args: unknown[]) => {
  try {
    logger.warn("console.warn", { args, stack: new Error().stack });
  } catch (e) {
    try {
      _origConsoleWarn("failed to log console.warn via logger", e);
    } catch {}
  }
  try {
    _origConsoleWarn(...(args as [unknown, ...unknown[]]));
  } catch {}
};
const server = app.listen(port, () => {
  logger.info(
    `Server[${process.env.NODE_ENV || "development"}] running at ${port} | ${new Date().toLocaleString("ja-JP")}`,
  );
});
server.on("error", (err) => {
  if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
    logger.error(
      `Port ${port} is already in use. Please choose a different port or stop the existing process.`,
    );
    process.exit(1);
  } else {
    logger.error("HTTP server error during startup", { error: err });
    throw err;
  }
});

const fileStore = new FileStore();
const socketServer = new SocketServerInstance(undefined, fileStore);
await socketServer.init(server);
const metrics = {
  apiMusics: { calls: 0, errors: 0, totalMs: 0 },
  rpcGetAllMusics: { calls: 0, errors: 0, totalMs: 0 },
};
(globalThis as any).__simpleMetrics = metrics;

async function gracefulShutdown() {
  const shutdownTimeout = Number(process.env.SHUTDOWN_TIMEOUT_MS || 5000);
  const forceExit = () => {
    logger.error("graceful shutdown timeout, forcing exit");
    process.exit(1);
  };

  const timer = setTimeout(forceExit, shutdownTimeout);

  try {
    logger.info("graceful shutdown initiated", { shutdownTimeout });

    await new Promise<void>((resolve, reject) => {
      server.close((err?: Error) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
    logger.info("http server closed");

    try {
      await socketServer.close();
      logger.info("socket.io closed");
    } catch (e: unknown) {
      logger.warn("error while closing socket.io", { error: e });
    }

    try {
      await fileStore.flush();
      logger.info("filestore flushed");
    } catch (e) {
      logger.warn("fileStore.flush failed, attempting sync close", {
        error: e,
      });
      try {
        fileStore.closeSync();
      } catch (err) {
        logger.warn("fileStore.closeSync failed", { error: err });
      }
    }

    clearTimeout(timer);
    logger.info("graceful shutdown complete, exiting");
    process.exit(0);
  } catch (e) {
    clearTimeout(timer);
    logger.error("graceful shutdown failed", { error: e });
    process.exit(1);
  }
}

process.on("SIGINT", () => void gracefulShutdown());
process.on("SIGTERM", () => void gracefulShutdown());

app.use(compression());
app.disable("x-powered-by");
app.get("/api/musics", (req, res) => {
  const start = Date.now();
  metrics.apiMusics.calls++;
  try {
    try {
      if (socketServer && (socketServer as any).musicDB instanceof Map) {
        const musicDB: Map<string, unknown> = (socketServer as any).musicDB;
        const list = Array.from(musicDB.values());
        const sample = Array.from(musicDB.keys()).slice(0, 5);
        const socketInitialized = Boolean((socketServer as any).io);
        res.json({
          ok: true,
          musics: list,
          meta: {
            count: list.length,
            sample,
            socketInitialized,
            ts: new Date().toISOString(),
          },
        });
        metrics.apiMusics.totalMs += Date.now() - start;
        return;
      }
    } catch (e) {
      void e;
    }
    res.json({
      ok: true,
      musics: [],
      meta: {
        count: 0,
        sample: [],
        socketInitialized: Boolean((socketServer as any).io),
        ts: new Date().toISOString(),
      },
    });
    metrics.apiMusics.totalMs += Date.now() - start;
  } catch (e) {
    metrics.apiMusics.errors++;
    metrics.apiMusics.totalMs += Date.now() - start;
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.get("/api/metrics", (req, res) => {
  res.json({
    ok: true,
    metrics: {
      apiMusics: metrics.apiMusics,
      rpcGetAllMusics: metrics.rpcGetAllMusics,
    },
  });
});

app.get("/api/socket-info", (req, res) => {
  try {
    const socketInitialized = Boolean((socketServer as any).io);
    const socketPath = process.env.SOCKET_PATH || "/api/socket.io";
    const allowExtensions = process.env.ALLOW_EXTENSION_ORIGINS === "true";
    const corsOrigins = (process.env.CORS_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    res.json({
      ok: true,
      socket: {
        initialized: socketInitialized,
        path: socketPath,
        allowExtensions,
        corsOrigins,
        serverUrl: `http://localhost:${port}`,
        socketUrl: `http://localhost:${port}${socketPath}`,
        wsUrl: `ws://localhost:${port}${socketPath}`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

const viteDevServer =
  process.env.NODE_ENV === "production"
    ? null
    : await import("vite").then((vite) =>
        vite.createServer({ server: { middlewareMode: true } }),
      );
if (viteDevServer) {
  app.use(viteDevServer.middlewares);
} else {
  app.use(
    "/assets",
    express.static("build/client/assets", { immutable: true, maxAge: "1y" }),
  );
}

app.use(express.static("build/client", { maxAge: "1h" }));
app.use(morgan("tiny"));

app.all(
  "*splat",
  createRequestHandler({
    build: viteDevServer
      ? async () => {
          try {
            return (await viteDevServer.ssrLoadModule(
              "virtual:react-router/server-build",
            )) as ServerBuild;
          } catch (err) {
            console.warn(
              "vite ssrLoadModule failed, falling back to built server build",
              err,
            );
            // @ts-expect-error ../../build/server/index.jsの型不足エラーを回避
            return (await import("../../build/server/index.js")) as ServerBuild;
          }
        }
      : // @ts-expect-error ../../build/server/index.jsの型不足エラーを回避
        ((await import("../../build/server/index.js")) as ServerBuild),
    getLoadContext: () =>
      ({
        io: socketServer,
      }) satisfies ServerContext,
  }),
);
