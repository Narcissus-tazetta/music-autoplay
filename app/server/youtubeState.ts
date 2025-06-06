import type { Music } from "~/stores/musicStore";

export const currentState = {
  currentYoutubeState: { state: "", url: "" },
  lastYoutubeStatus: null as any,
  currentPlayingId: null as string | null,
};
export const musics: Music[] = [];
export const clients = new Map();
