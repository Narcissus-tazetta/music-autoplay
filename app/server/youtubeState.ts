import type { Music } from "~/stores/musicStore";
import type { AppState, ClientsMap } from "./types";

export const currentState: AppState = {
  currentYoutubeState: { state: "", url: "" },
  lastYoutubeStatus: null,
  currentPlayingId: null,
};

export const musics: Music[] = [];
export const clients: ClientsMap = new Map();
