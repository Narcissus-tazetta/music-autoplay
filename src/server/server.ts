import { SERVER_ENV } from "@/app/env.server";
import logger, { replaceConsoleWithLogger } from "@/server/logger";
import type { ServerContext } from "@/shared/types/server";
import { createRequestHandler } from "@react-router/express";
import express from "express";
import { bootstrap } from "./bootstrap";
import configureApp, { type ConfigureAppResult } from "./configureApp";
import { getConfig, safeNumber } from "./utils/configUtils";

const app = express();
const config = getConfig();

const portCandidate = config.getNumber("PORT");
const port =
  typeof portCandidate === "number" && !Number.isNaN(portCandidate)
    ? portCandidate
    : safeNumber(SERVER_ENV.PORT, 3000);

if (config.nodeEnv !== "test") replaceConsoleWithLogger();
const { appShutdownHandlers, socketServer, metricsManager } = await bootstrap();

const server = app.listen(port, () => {
  const envName = config.nodeEnv;
  logger.info(
    `Server[${envName}] running at ${port} | ${new Date().toLocaleString("ja-JP")}`,
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

await socketServer.init(server);

let isShuttingDown = false;

async function gracefulShutdown() {
  if (isShuttingDown) {
    logger.info("graceful shutdown already in progress, ignoring");
    return;
  }
  isShuttingDown = true;

  const shutdownTimeoutCandidate = config.getNumber("SHUTDOWN_TIMEOUT_MS");
  const shutdownTimeout =
    typeof shutdownTimeoutCandidate === "number" &&
    !Number.isNaN(shutdownTimeoutCandidate)
      ? shutdownTimeoutCandidate
      : safeNumber(SERVER_ENV.SHUTDOWN_TIMEOUT_MS, 5000);
  const forceExit = () => {
    logger.error("graceful shutdown timeout, forcing exit");
    process.exit(1);
  };

  const timer = setTimeout(forceExit, shutdownTimeout);

  try {
    logger.info("graceful shutdown initiated", { shutdownTimeout });

    await new Promise<void>((resolve, reject) => {
      if (!server.listening) {
        logger.info("http server already closed");
        resolve();
        return;
      }

      server.close((err?: Error) => {
        if (err) {
          if (err.message.includes("Server is not running")) {
            logger.info("http server already closed during shutdown");
            resolve();
            return;
          }
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
      const errorMsg =
        e && typeof e === "object" && "message" in e
          ? String(e.message)
          : String(e);
      if (
        errorMsg.includes("not running") ||
        errorMsg.includes("already closed")
      )
        logger.info("socket.io already closed during shutdown");
      else logger.warn("socket.io close failed", { error: e });
    }

    for (const h of appShutdownHandlers) {
      try {
        await h();
      } catch (e: unknown) {
        logger.warn("shutdown handler failed", { error: e });
      }
    }

    clearTimeout(timer);
    logger.info("graceful shutdown complete, exiting");
    process.exit(0);
  } catch (e: unknown) {
    clearTimeout(timer);
    const errorMsg =
      e && typeof e === "object" && "message" in e
        ? String(e.message)
        : String(e);
    if (
      errorMsg.includes("Server is not running") ||
      errorMsg.includes("already closed")
    ) {
      logger.info("graceful shutdown complete (server already stopped)");
      process.exit(0);
    } else {
      logger.error("graceful shutdown failed", { error: e });
      process.exit(1);
    }
  }
}

process.on("SIGINT", () => {
  if (!isShuttingDown) {
    logger.info("received SIGINT, initiating graceful shutdown");
    void gracefulShutdown();
  }
});
process.on("SIGTERM", () => {
  if (!isShuttingDown) {
    logger.info("received SIGTERM, initiating graceful shutdown");
    void gracefulShutdown();
  }
});
process.on("SIGUSR2", () => {
  if (!isShuttingDown) {
    logger.info(
      "received SIGUSR2 (nodemon restart), initiating graceful shutdown",
    );
    void gracefulShutdown();
  }
});

const viteDevServer =
  config.nodeEnv === "production"
    ? null
    : await import("vite").then((vite) =>
        vite.createServer({
          server: {
            middlewareMode: true,
            hmr: false,
          },
          optimizeDeps: {
            include: ["socket.io-client", "framer-motion", "zustand"],
          },
        }),
      );
let configResult: ConfigureAppResult;
try {
  configResult = await configureApp(app, () => socketServer, viteDevServer);
  logger.info("App configuration completed successfully");
} catch (error: unknown) {
  logger.error("Failed to configure app", { error });
  process.exit(1);
}
app.get("/api/metrics", (req, res) => {
  try {
    const metrics = metricsManager.getMetrics();
    res.json({
      status: "ok",
      data: {
        apiMusics: metrics.apiMusics,
        rpcGetAllMusics: metrics.rpcGetAllMusics,
      },
    });
  } catch (error: unknown) {
    logger.error("Error in /api/metrics endpoint", { error });
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

app.get("/api/socket-info", (req, res) => {
  try {
    const socketPath = config.getString("SOCKET_PATH");

    const corsRaw = config.getString("CORS_ORIGINS");
    const corsOrigins = (corsRaw || "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);

    res.json({
      ok: true,
      socket: {
        corsOrigins,
        serverUrl: `http://localhost:${port}`,
        socketUrl: `http://localhost:${port}${socketPath}`,
        wsUrl: `ws://localhost:${port}${socketPath}`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    logger.error("Error in /api/socket-info endpoint", { error });
    const safe =
      typeof error === "string"
        ? error
        : error instanceof Error
          ? error.message
          : JSON.stringify(error);
    res.status(500).json({ ok: false, error: safe });
  }
});

app.all(
  "*splat",
  createRequestHandler({
    build: configResult.buildValue,
    getLoadContext: () =>
      ({
        io: socketServer,
      }) satisfies ServerContext,
  }),
);

logger.info("All middleware and routes registered successfully", {
  environment: config.nodeEnv,
  port,
  timestamp: new Date().toISOString(),
});
