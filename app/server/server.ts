import { createRequestHandler } from "@react-router/express";
import compression from "compression";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import { Server } from "socket.io";
import type { C2S, S2C } from "~/socket";
import type { Music } from "~/stores/musicStore.js";

const viteDevServer =
    process.env.NODE_ENV === "production"
        ? undefined
        : await import("vite").then((vite) =>
              vite.createServer({
                  server: { middlewareMode: true },
              })
          );
const reactRouterHandler = createRequestHandler({
    build: viteDevServer
        ? () => viteDevServer.ssrLoadModule("virtual:react-router/server-build")
        : // @ts-expect-error
          await import("./build/server/index.js"),
});

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
const musics: Music[] = [];



io.on("connection", (socket) => {
    console.log("a user connected");
    socket.emit("initMusics", musics);

    // 既存のmusic管理
    socket
        .on("addMusic", (music, error) => {
            if (!musics.find((m) => m.title === music.title || m.url === music.url)) {
                console.log("addMusic", music);
                musics.push(music);
                // addMusicイベントのemitはやめ、リスト全体はurl_listのみで管理
                console.log("[server] url_list emit(addMusic):", musics);
                io.emit("url_list", musics);
            } else {
                error("この楽曲はすでにリクエストされています");
            }
        })
        .on("deleteMusic", (url) => {
            const idx = musics.findIndex((m) => m.url === url);
            if (idx !== -1) {
                const removed = musics.splice(idx, 1)[0];
                io.emit("deleteMusic", removed.url); // 全クライアントに同期
            }
        });

    // URLリスト機能
    console.log("[server] url_list emit(接続時):", musics, "to", socket.id);
    socket.emit("url_list", musics);

    // get_urlsイベントで最新リストを返す
    socket.on("get_urls", () => {
        console.log("[server] get_urls受信 from", socket.id);
        console.log("[server] url_list emit(get_urls):", musics, "to", socket.id);
        socket.emit("url_list", musics);
    });

    // submit_urlイベント
    socket.on("submit_url", (url: string) => {
        console.log("[server] submit_url受信:", url, "from", socket.id);
        if (!url || musics.some((item) => item.url === url)) return;
        // ここでtitleやthumbnailも取得できるならセット（現状は空文字）
        const videoData: Music = { url, title: '', thumbnail: '' };
        musics.push(videoData);
        console.log("[server] url_list emit(submit_url):", musics);
        io.emit("url_list", musics);
        console.log("[server] new_url emit(submit_url):", videoData);
        io.emit("new_url", videoData);
    });

    // delete_urlイベント
    socket.on("delete_url", (data: any) => {
        console.log("[server] delete_url受信:", data, "from", socket.id);
        const url = typeof data === "string" ? data : data?.url;
        function extractYouTubeId(u: string) {
            if (!u) return null;
            try {
                const urlObj = new URL(u);
                if (urlObj.hostname === "youtu.be") {
                    return urlObj.pathname.replace(/^\//, "");
                }
                if (urlObj.hostname.includes("youtube.com")) {
                    return urlObj.searchParams.get("v");
                }
            } catch {
                const match = u.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
                return match ? match[1] : null;
            }
            return null;
        }
        const targetId = extractYouTubeId(url);
        console.log("[server] delete_url処理: 受信URL=", url, "抽出ID=", targetId);
        console.log("[server] delete_url処理: 現在のmusics=", musics.map(m => ({ url: m.url, id: extractYouTubeId(m.url) })));
        const index = musics.findIndex((item) => extractYouTubeId(item.url) === targetId);
        if (index !== -1) {
            const removed = musics.splice(index, 1)[0];
            console.log("[server] delete_url処理: 削除対象=", removed);
            console.log("[server] url_list emit(delete_url):", musics);
            io.emit("url_list", musics);
            console.log("[server] delete_url emit:", url);
            io.emit("delete_url", url);
            console.log("[server] new_url emit(delete_url):", musics[0] || null);
            io.emit("new_url", musics[0] || null);
        } else {
            console.log("[server] delete_url処理: 削除対象なし (ID一致せず)");
        }
    });

    socket.on("disconnect", () => {
        console.log("[server] クライアント切断: ", socket.id);
    });
});
