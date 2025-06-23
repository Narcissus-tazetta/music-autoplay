import { createRequestHandler } from "@react-router/express";
import compression from "compression";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import type { ViteDevServer } from "vite";
import type { RequestHandler } from "express";
import type { C2S, S2C } from "~/socket";
import { clients } from "./youtubeState";
import { registerSocketHandlers } from "./socketHandlers";
import { displayApiUsageStats } from "./apiUsageDisplay";
import { log } from "./logger";
import { httpLogger } from "./httpLogger";

import dotenv from "dotenv";
dotenv.config();

log.server("🚀 Starting Music Auto-Play Server...");
log.server(`📋 Environment: ${process.env.NODE_ENV || "development"}`);
log.server(`🔧 Node.js: ${process.version}`);
log.server(`🔑 YouTube API Key: ${process.env.YOUTUBE_API_KEY ? "✅ Loaded" : "❌ Missing"}`);

import { getTodaysApiUsage } from "./apiCounter";
const apiUsage = getTodaysApiUsage();
log.apiUsage(`📊 Today's API Usage: ${apiUsage.count} calls`);

let reactRouterHandler: RequestHandler;
let viteDevServer: ViteDevServer | undefined = undefined;
if (process.env.NODE_ENV === "production") {
  log.server("📦 Loading production build...");
  const ssrBuild = require("../../build/server/index.js");
  reactRouterHandler = createRequestHandler({ build: ssrBuild });
  log.server("✅ Production build loaded successfully");
} else {
  log.server("🔄 Setting up Vite development server...");
  viteDevServer = (await import("vite").then((vite) =>
    vite.createServer({ server: { middlewareMode: true } })
  )) as ViteDevServer;

  reactRouterHandler = createRequestHandler({
    build: () => viteDevServer!.ssrLoadModule("virtual:react-router/server-build") as any,
  });
  log.server("✅ Vite development server configured");
}

const port = process.env.PORT || 3000;
log.server(`🌐 Port: ${port}`);

const app = express();
log.server("⚙️  Configuring middleware...");

const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? [
        "https://music-autoplay.onrender.com", // 本番環境
        "https://music-autoplay.onrender.com/", // トレーリングスラッシュ対応
      ]
    : [
        "http://localhost:3000", // 開発環境
        "http://localhost:5173", // Vite開発サーバー
        "http://127.0.0.1:3000", // IPv4ローカル
        "http://127.0.0.1:5173", // Vite IPv4
      ];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
  })
);

log.server(`🔐 CORS configured for origins: ${allowedOrigins.join(", ")}`);

const server = app.listen(port, () => {
  log.server(
    `🎵 Music Auto-Play Server [${process.env.NODE_ENV || "development"}] running at http://localhost:${port} | Socket.IO enabled | ${new Date().toLocaleString("ja-JP")}`
  );
  log.server(`📊 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  log.server("🎯 Ready to accept connections!");
});

app.use(compression());
app.disable("x-powered-by");
log.server("📦 Compression enabled, x-powered-by header disabled");

if (viteDevServer) {
  app.use(viteDevServer.middlewares);
  log.server("🔧 Vite middleware attached");
} else {
  app.use("/assets", express.static("build/client/assets", { immutable: true, maxAge: "1y" }));
  log.server("📁 Static assets serving configured (production)");
}

// Public static files (favicon, etc.)
app.use(express.static("public", { maxAge: "1d" }));
app.use(express.static("build/client", { maxAge: "1h" }));
app.use(httpLogger);
log.server("📝 Static file serving (public + build) and HTTP logging configured");

app.all("*splat", reactRouterHandler);
log.server("🛣️  React Router handler configured");

const io = new Server<C2S, S2C>(server);
log.server("🔌 Socket.IO server initialized");

io.on("connection", (socket) => {
  log.socket(`👤 Client connected: ${socket.id.substring(0, 8)}...`);
  registerSocketHandlers(io, socket, clients);
});

displayApiUsageStats();

log.server("🎉 Server initialization complete!");
