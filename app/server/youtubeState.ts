// YouTube状態管理用（内容はserver.tsから移植、ロジックは一切変更しない）
import type { Music } from "~/stores/musicStore";

export const currentState = {
  currentYoutubeState: { state: "", url: "" },
  lastYoutubeStatus: null as any,
  currentPlayingId: null as string | null,
};
export const musics: Music[] = [];
export const clients = new Map();
