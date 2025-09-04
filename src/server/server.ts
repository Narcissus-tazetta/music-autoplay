import { createRequestHandler } from "@react-router/express";
import type { ServerBuild } from "react-router";

console.log("[server] module load start");

import compression from "compression";
import express from "express";
import morgan from "morgan";

import { SocketServerInstance } from "./socket.ts";
import type { ServerContext } from "../shared/types/server";

import dotenv from "dotenv";
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.info(
    `Server[${process.env.NODE_ENV || "development"}] running at ${port} | ${new Date().toLocaleString("ja-JP")}`,
  );
});
const io = new SocketServerInstance(server);

app.use(compression());
app.disable("x-powered-by");

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

// readiness endpoint for wrappers and health checks
import type { RequestHandler } from "express";

const healthHandler: RequestHandler = (_req, res) => {
  res.status(200).json({ ok: true });
};
app.get("/health", healthHandler);

app.all(
  "*splat",
  createRequestHandler({
    build: viteDevServer
      ? () =>
          viteDevServer.ssrLoadModule(
            "virtual:react-router/server-build",
          ) as Promise<ServerBuild>
      : // @ts-expect-error ../../build/server/index.jsの型不足エラーを回避
        ((await import("../../build/server/index.js")) as ServerBuild),
    getLoadContext: () =>
      ({
        io,
      }) satisfies ServerContext,
  }),
);

// Graceful shutdown helpers
async function gracefulShutdown(signal: string) {
  try {
    console.info(`Received ${signal}, shutting down...`);
    server.close(() => {
      console.info("HTTP server closed");
    });
    try {
      // SocketServerInstance exposes io
      if (typeof io.io.close === "function") {
        await io.io.close();
        console.info("Socket.IO server closed");
      }
    } catch (e) {
      console.warn("Error closing Socket.IO", e);
    }
    if (viteDevServer && typeof viteDevServer.close === "function") {
      try {
        await viteDevServer.close();
        console.info("Vite dev server closed");
      } catch (e) {
        console.warn("Error closing Vite dev server", e);
      }
    }
    // allow in-flight work a moment
    setTimeout(() => {
      console.info("Shutdown complete, exiting");
      process.exit(0);
    }, 250);
  } catch (err) {
    console.error("Error during shutdown", err);
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  void gracefulShutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void gracefulShutdown("SIGTERM");
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception", err);
  void gracefulShutdown("uncaughtException");
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection", reason);
  void gracefulShutdown("unhandledRejection");
});
