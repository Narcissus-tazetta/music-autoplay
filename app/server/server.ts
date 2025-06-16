import { createRequestHandler } from "@react-router/express";
import compression from "compression";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import type { ViteDevServer } from "vite";
import type { RequestHandler } from "express";
import type { C2S, S2C } from "~/socket";
import { musics, clients } from "./youtubeState";
import { registerSocketHandlers } from "./socketHandlers";
import { displayApiUsageStats } from "./apiUsageDisplay";
import { log } from "./logger";
import { httpLogger } from "./httpLogger";

// 環境変数を明示的に読み込み
import dotenv from "dotenv";
dotenv.config();

log.server("🚀 Starting Music Auto-Play Server...");
log.server(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
log.server(`🔧 Node.js: ${process.version}`);
log.server(`🔑 YouTube API Key: ${process.env.YOUTUBE_API_KEY ? '✅ Loaded' : '❌ Missing'}`);

// APIカウンターの状態を起動時に確認・表示
import { getTodaysApiUsage } from "./apiCounter";
const apiUsage = getTodaysApiUsage();
log.apiUsage(`📊 Today's API Usage: ${apiUsage.count} calls`);

let reactRouterHandler: RequestHandler;
let viteDevServer: ViteDevServer | undefined = undefined;
if (process.env.NODE_ENV === "production") {
  log.server("📦 Loading production build...");
  // 本番はビルド成果物のSSRハンドラを関数としてrequire
  const ssrBuild = require("../../build/server/index.js");
  reactRouterHandler = createRequestHandler({ build: ssrBuild });
  log.server("✅ Production build loaded successfully");
} else {
  log.server("🔄 Setting up Vite development server...");
  // 開発はVite SSR - 型安全性のため一時的にanyを使用
  viteDevServer = await import("vite").then((vite) =>
    vite.createServer({ server: { middlewareMode: true } })
  ) as ViteDevServer;
  
  reactRouterHandler = createRequestHandler({
    build: () => viteDevServer!.ssrLoadModule("virtual:react-router/server-build") as any,
  });
  log.server("✅ Vite development server configured");
}

const port = process.env.PORT || 3000;
log.server(`🌐 Port: ${port}`);

const app = express();
log.server("⚙️  Configuring middleware...");

app.use(cors());
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, access_token");
    next();
});
log.server("🔐 CORS and security headers configured");

const server = app.listen(port, () => {
    log.server(`🎵 Music Auto-Play Server [${process.env.NODE_ENV || 'development'}] running at http://localhost:${port} | Socket.IO enabled | ${new Date().toLocaleString('ja-JP')}`);
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

app.use(express.static("build/client", { maxAge: "1h" }));
app.use(httpLogger);
log.server("📝 Static file serving and HTTP logging configured");

app.all("*splat", reactRouterHandler);
log.server("🛣️  React Router handler configured");

const io = new Server<C2S, S2C>(server);
log.server("🔌 Socket.IO server initialized");

io.on("connection", (socket) => {
    log.socket(`👤 Client connected: ${socket.id.substring(0, 8)}...`);
    registerSocketHandlers(io, socket, clients);
});

// API使用量を表示
displayApiUsageStats();

log.server("🎉 Server initialization complete!");
