// socket.io関連の全ハンドラ（server.tsから移植、ロジックは一切変更しない）
import type { Server, Socket } from "socket.io";
import type { C2S, S2C } from "~/socket";
import type { Music } from "~/stores/musicStore";
import { musics, currentYoutubeState, lastYoutubeStatus, currentPlayingId } from "./youtubeState";
import { extractYouTubeId } from "./utils";

export function registerSocketHandlers(io: Server<C2S, S2C>, socket: Socket<C2S, S2C>, clients: Map<any, any>) {
    const { musics } = require("./youtubeState");
    const { extractYouTubeId } = require("./utils");
    let { currentYoutubeState, lastYoutubeStatus, currentPlayingId } = require("./youtubeState");

    console.log("[server] 拡張機能が接続:", socket.id);
    clients.set(socket.id, {});
    socket.emit("initMusics", musics);
    if (lastYoutubeStatus) {
        setTimeout(() => {
            socket.emit("current_youtube_status", lastYoutubeStatus);
        }, 10);
    }

    socket.on("youtube_video_state", (data) => {
        currentYoutubeState.state = data.state;
        currentYoutubeState.url = data.url;
        if (data.state === "playing" || data.state === "paused") {
            if (!currentPlayingId) {
                currentPlayingId = extractYouTubeId(data.url);
            }
        } else if (data.state === "window_close") {
            currentPlayingId = null;
        }
        let nowMusic = null;
        let isMatch = false;
        if (currentPlayingId) {
            nowMusic = musics.find(m => extractYouTubeId(m.url) === currentPlayingId) || null;
            isMatch = nowMusic ? extractYouTubeId(data.url) === currentPlayingId : false;
        } else {
            nowMusic = musics[0] || null;
            isMatch = nowMusic && nowMusic.url === data.url;
        }
        console.log("[拡張機能] YouTube動画状態:", data, "再生中ID:", currentPlayingId, "isMatch:", isMatch);
        if (data.state === "window_close") {
            lastYoutubeStatus = null;
            io.emit("current_youtube_status", { state: "window_close", url: data.url, match: isMatch, music: nowMusic });
        } else {
            lastYoutubeStatus = {
                state: data.state,
                url: data.url,
                match: isMatch,
                music: nowMusic,
            };
            io.emit("current_youtube_status", lastYoutubeStatus);
        }
    });
    socket.on("youtube_tab_closed", (data) => {
        currentYoutubeState.state = "window_close";
        currentYoutubeState.url = data.url;
        const nowMusic = musics[0] || null;
        const isMatch = nowMusic && nowMusic.url === data.url;
        console.log("[拡張機能] YouTubeタブ閉じた:", data, "music.list[0]と一致:", isMatch);
        lastYoutubeStatus = null;
        io.emit("current_youtube_status", { state: "window_close", url: data.url, match: isMatch, music: nowMusic });
    });
    socket
        .on("addMusic", (music, error) => {
            if (!musics.find((m) => m.title === music.title || m.url === music.url)) {
                console.log("addMusic", music);
                musics.push(music);
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
                io.emit("deleteMusic", removed.url);
            }
        });
    console.log("[server] url_list emit(接続時):", musics, "to", socket.id);
    socket.emit("url_list", musics);
    socket.on("get_urls", () => {
        console.log("[server] get_urls受信 from", socket.id);
        console.log("[server] url_list emit(get_urls):", musics, "to", socket.id);
        socket.emit("url_list", musics);
    });
    socket.on("submit_url", (url) => {
        console.log("[server] submit_url受信:", url, "from", socket.id);
        if (!url || musics.some((item) => item.url === url)) return;
        const videoData = { url, title: '', thumbnail: '' };
        musics.push(videoData);
        console.log("[server] url_list emit(submit_url):", musics);
        io.emit("url_list", musics);
        console.log("[server] new_url emit(submit_url):", videoData);
        io.emit("new_url", videoData);
    });
    socket.on("delete_url", (data) => {
        console.log("[server] delete_url受信:", data, "from", socket.id);
        const url = typeof data === "string" ? data : data?.url;
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
    socket.on("move_prev_video", (data) => {
        console.log("[拡張機能] move_prev_video受信:", data);
        const videoId = extractYouTubeId(data.url);
        currentPlayingId = videoId;
        const nowMusic = musics.find(m => extractYouTubeId(m.url) === videoId) || null;
        const isMatch = !!nowMusic;
        currentYoutubeState.state = "prev_video";
        currentYoutubeState.url = data.url;
        lastYoutubeStatus = {
            state: "prev_video",
            url: data.url,
            match: isMatch,
            music: nowMusic,
        };
        io.emit("current_youtube_status", lastYoutubeStatus);
    });
    socket.on("move_next_video", (data) => {
        console.log("[拡張機能] move_next_video受信:", data);
        const videoId = extractYouTubeId(data.url);
        currentPlayingId = videoId;
        const nowMusic = musics.find(m => extractYouTubeId(m.url) === videoId) || null;
        const isMatch = !!nowMusic;
        currentYoutubeState.state = "next_video";
        currentYoutubeState.url = data.url;
        lastYoutubeStatus = {
            state: "next_video",
            url: data.url,
            match: isMatch,
            music: nowMusic,
        };
        io.emit("current_youtube_status", lastYoutubeStatus);
    });
    socket.on("disconnect", (reason) => {
        console.warn("[server] 拡張機能が切断:", socket.id, reason);
        clients.delete(socket.id);
    });
    socket.on("error", (err) => {
        console.error("[server] Socket.IO error:", err);
    });
}
