import { useEffect, useState } from "react";
import { useMusicStore, type Music } from "../stores/musicStore";

interface YouTubeStatusData {
  state: string;
  url: string;
  match: boolean;
  music: Music | null;
}

interface ProcessedYouTubeStatus extends Omit<YouTubeStatusData, "state"> {
  state: "playing" | "paused" | "window_close";
}

export function useYouTubeStatus() {
  const socket = useMusicStore((store) => store.socket);
  const [ytStatus, setYtStatus] = useState<ProcessedYouTubeStatus | null>(null);

  useEffect(() => {
    if (!socket) return;
    const handler = (data: YouTubeStatusData) => {
      let state: "playing" | "paused" | "window_close" = "paused";
      if (data.state === "playing" || data.state === "paused" || data.state === "window_close") {
        state = data.state;
      } else if (data.state === "closed") {
        state = "window_close";
      }
      setYtStatus({ ...data, state });
    };
    socket.on("current_youtube_status", handler);
    return () => {
      socket.off("current_youtube_status", handler);
    };
  }, [socket]);

  return ytStatus;
}
