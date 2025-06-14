import type { Server, Socket } from "socket.io";
import type { C2S, S2C } from "~/socket";
import { musics, currentState } from "../youtubeState";
import { extractYouTubeId } from "../utils";
import { fetchVideoInfo } from "../youtubeApi";

export function registerYouTubeHandlers(
  io: Server<C2S, S2C>,
  socket: Socket<C2S, S2C>
) {
  socket.on("youtube_video_state", async (data) => {
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

    // リスト外動画の場合、YouTube APIで情報を取得
    if (!isMatch && data.url) {
      const videoId = extractYouTubeId(data.url);
      if (videoId) {
        console.log(`🔍 Fetching info for unlisted video: ${videoId}`);
        const videoInfo = await fetchVideoInfo(videoId);
        if (videoInfo) {
          nowMusic = {
            url: data.url,
            title: videoInfo.title,
            thumbnail: videoInfo.thumbnail,
          };
          console.log(`📺 Got unlisted video: "${videoInfo.title}"`);
        } else {
          // API取得に失敗した場合の代替表示
          nowMusic = {
            url: data.url,
            title: "Unknown Video",
            thumbnail: "",
          };
          console.log(`❓ Could not fetch video info for: ${videoId}`);
        }
      }
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

  socket.on("youtube_tab_closed", async (data) => {
    currentState.currentYoutubeState.state = "window_close";
    currentState.currentYoutubeState.url = data.url;
    
    let nowMusic = musics[0] || null;
    let isMatch = nowMusic && nowMusic.url === data.url;
    
    // リスト外動画の場合、YouTube APIで情報を取得
    if (!isMatch && data.url) {
      const videoId = extractYouTubeId(data.url);
      if (videoId) {
        console.log(`🔍 Fetching info for closed unlisted video: ${videoId}`);
        const videoInfo = await fetchVideoInfo(videoId);
        if (videoInfo) {
          nowMusic = {
            url: data.url,
            title: videoInfo.title,
            thumbnail: videoInfo.thumbnail,
          };
          console.log(`📺 Got closed unlisted video: "${videoInfo.title}"`);
        } else {
          // API取得に失敗した場合の代替表示
          nowMusic = {
            url: data.url,
            title: "Unknown Video",
            thumbnail: "",
          };
          console.log(`❓ Could not fetch closed video info for: ${videoId}`);
        }
      }
    }
    
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
