const { createRequestHandler } = require("@react-router/express");
const compression = require("compression");
const cors = require("cors");
const express = require("express");
const morgan = require("morgan");
const { Server } = require("socket.io");
// 型importは不要
// const { C2S, S2C } = require("../socket");
// const { Music } = require("../stores/musicStore");

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

app.use("/assets", express.static("build/client/assets", { immutable: true, maxAge: "1y" }));
app.use(express.static("build/client", { maxAge: "1h" }));
app.use(morgan("tiny"));

// SSRハンドラは省略または必要に応じて追加
// app.all("*splat", reactRouterHandler);

const io = new Server(server);
const musics = [];

io.on("connection", (socket) => {
    console.log("a user connected");
    socket.emit("initMusics", musics);
    // 既存のmusic管理ロジックをここに追加
});
