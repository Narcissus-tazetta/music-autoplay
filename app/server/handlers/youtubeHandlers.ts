import type { Server, Socket } from "socket.io";
import type { C2S, S2C } from "~/socket";
import { musics, currentState } from "../youtubeState";
import { extractYouTubeId } from "../utils";

export function registerYouTubeHandlers(
  io: Server<C2S, S2C>,
  socket: Socket<C2S, S2C>
) {
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
      nowMusic =
        musics.find(
          (m) => extractYouTubeId(m.url) === currentState.currentPlayingId
        ) || null;
      isMatch = nowMusic
        ? extractYouTubeId(data.url) === currentState.currentPlayingId
        : false;
    } else {
      nowMusic = musics[0] || null;
      isMatch = nowMusic && nowMusic.url === data.url;
    }

    console.log(`▶️  YouTube: ${data.state} | Match: ${isMatch ? '✅' : '❌'}`);

    if (data.state === "window_close") {
      currentState.lastYoutubeStatus = null;
      io.emit("current_youtube_status", {
        state: "window_close",
        url: data.url,
        match: isMatch,
        music: nowMusic,
      });
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
    console.log(`❌ YouTube tab closed | Match: ${isMatch ? '✅' : '❌'}`);
    currentState.lastYoutubeStatus = null;
    io.emit("current_youtube_status", {
      state: "window_close",
      url: data.url,
      match: isMatch,
      music: nowMusic,
    });
  });
}
