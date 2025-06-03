import { createRequestHandler } from "@react-router/express";
import compression from "compression";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import { Server } from "socket.io";
import type { C2S, S2C } from "~/socket";
import { musics, clients } from "./youtubeState";
import { registerSocketHandlers } from "./socketHandlers";

let reactRouterHandler: any;
let viteDevServer: any = undefined;
if (process.env.NODE_ENV === "production") {
  // 本番はビルド成果物のSSRハンドラを関数としてrequire
  const ssrBuild = require("../../build/server/index.js");
  reactRouterHandler = createRequestHandler({ build: ssrBuild });
} else {
  // 開発はVite SSR
  viteDevServer = await import("vite").then((vite) =>
    vite.createServer({ server: { middlewareMode: true } })
  );
  reactRouterHandler = createRequestHandler({
    build: () => viteDevServer.ssrLoadModule("virtual:react-router/server-build"),
  });
}

const port = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, access_token");
    next();
});
const server = app.listen(port, () => {
    console.log(`Server is running at ${port}`);
});

app.use(compression());
app.disable("x-powered-by");

if (viteDevServer) app.use(viteDevServer.middlewares);
else {
    app.use("/assets", express.static("build/client/assets", { immutable: true, maxAge: "1y" }));
}

app.use(express.static("build/client", { maxAge: "1h" }));
app.use(morgan("tiny"));

app.all("*splat", reactRouterHandler);

const io = new Server<C2S, S2C>(server);
io.on("connection", (socket) => {
    registerSocketHandlers(io, socket, clients);
});
