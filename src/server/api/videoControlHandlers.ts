import type { Server, Socket } from "socket.io";
import type { C2S, S2C } from "../../shared/types/socket";
import { musics, currentState } from "../youtubeState";
import { extractYouTubeId } from "../utils";
import { log } from "../logger";

export function registerVideoControlHandlers(io: Server<C2S, S2C>, socket: Socket<C2S, S2C>) {
  socket.on("move_prev_video", (data: { url: string }) => {
    log.info("⏮️  Previous video");
    const videoId = extractYouTubeId(data.url);
    currentState.currentPlayingId = videoId;
    const nowMusic = musics.find((m) => extractYouTubeId(m.url) === videoId) || null;
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

  socket.on("move_next_video", (data: { url: string }) => {
    log.info("⏭️  Next video");
    const videoId = extractYouTubeId(data.url);
    currentState.currentPlayingId = videoId;
    const nowMusic = musics.find((m) => extractYouTubeId(m.url) === videoId) || null;
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
}
