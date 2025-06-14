import { createRequestHandler } from "@react-router/express";
import compression from "compression";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import { Server } from "socket.io";
import type { C2S, S2C } from "~/socket";
import { musics, clients } from "./youtubeState";
import { registerSocketHandlers } from "./socketHandlers";

console.log("🚀 Starting Music Auto-Play Server...");
console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔧 Node.js: ${process.version}`);

let reactRouterHandler: any;
let viteDevServer: any = undefined;
if (process.env.NODE_ENV === "production") {
  console.log("📦 Loading production build...");
  // 本番はビルド成果物のSSRハンドラを関数としてrequire
  const ssrBuild = require("../../build/server/index.js");
  reactRouterHandler = createRequestHandler({ build: ssrBuild });
  console.log("✅ Production build loaded successfully");
} else {
  console.log("🔄 Setting up Vite development server...");
  // 開発はVite SSR
  viteDevServer = await import("vite").then((vite) =>
    vite.createServer({ server: { middlewareMode: true } })
  );
  reactRouterHandler = createRequestHandler({
    build: () => viteDevServer.ssrLoadModule("virtual:react-router/server-build"),
  });
  console.log("✅ Vite development server configured");
}

const port = process.env.PORT || 3000;
console.log(`🌐 Port: ${port}`);

const app = express();
console.log("⚙️  Configuring middleware...");

app.use(cors());
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, access_token");
    next();
});
console.log("🔐 CORS and security headers configured");

const server = app.listen(port, () => {
    console.log(`🎵 Music Auto-Play Server [${process.env.NODE_ENV || 'development'}] running at http://localhost:${port} | Socket.IO enabled | ${new Date().toLocaleString('ja-JP')}`);
    console.log(`📊 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    console.log("🎯 Ready to accept connections!");
});

app.use(compression());
app.disable("x-powered-by");
console.log("📦 Compression enabled, x-powered-by header disabled");

if (viteDevServer) {
    app.use(viteDevServer.middlewares);
    console.log("🔧 Vite middleware attached");
} else {
    app.use("/assets", express.static("build/client/assets", { immutable: true, maxAge: "1y" }));
    console.log("📁 Static assets serving configured (production)");
}

app.use(express.static("build/client", { maxAge: "1h" }));
app.use(morgan("tiny"));
console.log("📝 Static file serving and request logging configured");

app.all("*splat", reactRouterHandler);
console.log("🛣️  React Router handler configured");

const io = new Server<C2S, S2C>(server);
console.log("🔌 Socket.IO server initialized");

io.on("connection", (socket) => {
    console.log(`👤 New client connected: ${socket.id}`);
    registerSocketHandlers(io, socket, clients);
});

console.log("🎉 Server initialization complete!");
