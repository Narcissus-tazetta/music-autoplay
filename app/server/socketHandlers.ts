import type { Server, Socket } from "socket.io";
import type { C2S, S2C } from "~/socket";
import type { Music } from "~/stores/musicStore";
import { musics, currentState } from "./youtubeState";
import { extractYouTubeId } from "./utils";

export function registerSocketHandlers(io: Server<C2S, S2C>, socket: Socket<C2S, S2C>, clients: Map<any, any>) {

    console.log("[server] 拡張機能が接続:", socket.id);
    clients.set(socket.id, {});
    socket.emit("initMusics", musics);
    if (currentState.lastYoutubeStatus) {
        setTimeout(() => {
            socket.emit("current_youtube_status", currentState.lastYoutubeStatus);
        }, 10);
    }

    socket.on("youtube_video_state", (data) => {
        currentState.currentYoutubeState.state = data.state;
        currentState.currentYoutubeState.url = data.url;
        if (data.state === "playing") {
            currentState.currentPlayingId = extractYouTubeId(data.url);
        } else if (data.state === "paused") {
            if (!currentState.currentPlayingId) {
                currentState.currentPlayingId = extractYouTubeId(data.url);
            }
        } else if (data.state === "window_close") {
            currentState.currentPlayingId = null;
        }
        let nowMusic = null;
        let isMatch = false;
        if (currentState.currentPlayingId) {
            nowMusic = musics.find(m => extractYouTubeId(m.url) === currentState.currentPlayingId) || null;
            isMatch = nowMusic ? extractYouTubeId(data.url) === currentState.currentPlayingId : false;
        } else {
            nowMusic = musics[0] || null;
            isMatch = nowMusic && nowMusic.url === data.url;
        }
        console.log("[拡張機能] YouTube動画状態:", data, "再生中ID:", currentState.currentPlayingId, "isMatch:", isMatch);
        if (data.state === "window_close") {
            currentState.lastYoutubeStatus = null;
            io.emit("current_youtube_status", { state: "window_close", url: data.url, match: isMatch, music: nowMusic });
        } else {
            currentState.lastYoutubeStatus = {
                state: data.state,
                url: data.url,
                match: isMatch,
                music: nowMusic,
            };
            io.emit("current_youtube_status", currentState.lastYoutubeStatus);
        }
    });
    socket.on("youtube_tab_closed", (data) => {
        currentState.currentYoutubeState.state = "window_close";
        currentState.currentYoutubeState.url = data.url;
        const nowMusic = musics[0] || null;
        const isMatch = nowMusic && nowMusic.url === data.url;
        console.log("[拡張機能] YouTubeタブ閉じた:", data, "music.list[0]と一致:", isMatch);
        currentState.lastYoutubeStatus = null;
        io.emit("current_youtube_status", { state: "window_close", url: data.url, match: isMatch, music: nowMusic });
    });
    socket
        .on("addMusic", (music, callback) => {
            // YouTube動画IDで重複判定（現在のmusicsのみ）
            const newId = extractYouTubeId(music.url);
            const exists = musics.some(m => extractYouTubeId(m.url) === newId);
            
            if (!exists) {
                console.log("addMusic", music);
                musics.push(music);
                console.log("[server] url_list emit(addMusic):", musics);
                io.emit("url_list", musics);
                
                // 成功時はエラーなしでコールバック実行
                if (typeof callback === 'function') {
                    callback();
                }
            } else {
                // エラー時はエラーメッセージでコールバック実行
                if (typeof callback === 'function') {
                    callback("この楽曲はすでにリクエストされています");
                }
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
        const url = typeof data === "string" ? data : (data as { url: string }).url;
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
        currentState.currentPlayingId = videoId;
        const nowMusic = musics.find(m => extractYouTubeId(m.url) === videoId) || null;
        const isMatch = !!nowMusic;
        currentState.currentYoutubeState.state = "prev_video";
        currentState.currentYoutubeState.url = data.url;
        currentState.lastYoutubeStatus = {
            state: "prev_video",
            url: data.url,
            match: isMatch,
            music: nowMusic,
        };
        io.emit("current_youtube_status", currentState.lastYoutubeStatus);
    });
    socket.on("move_next_video", (data) => {
        console.log("[拡張機能] move_next_video受信:", data);
        const videoId = extractYouTubeId(data.url);
        currentState.currentPlayingId = videoId;
        const nowMusic = musics.find(m => extractYouTubeId(m.url) === videoId) || null;
        const isMatch = !!nowMusic;
        currentState.currentYoutubeState.state = "next_video";
        currentState.currentYoutubeState.url = data.url;
        currentState.lastYoutubeStatus = {
            state: "next_video",
            url: data.url,
            match: isMatch,
            music: nowMusic,
        };
        io.emit("current_youtube_status", currentState.lastYoutubeStatus);
    });
    socket.on("disconnect", (reason) => {
        console.warn("[server] 拡張機能が切断:", socket.id, reason);
        clients.delete(socket.id);
    });
    socket.on("error", (err) => {
        console.error("[server] Socket.IO error:", err);
    });
}
