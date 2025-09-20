import type { Music, RemoteStatus } from "~/stores/musicStore";

export interface S2C {
  // current events
  musicAdded(music: Music): void;
  musicRemoved(musicId: string): void;
  remoteStatusUpdated(state: RemoteStatus): void;

  // legacy / compatibility events used by older clients / extensions
  initMusics?(musics: Array<Music & { url: string }>): void;
  url_list?(musics: Array<Music & { url: string }>): void;
  // legacy add/delete events (some clients expect these)
  addMusic?(music: Music & { url?: string }): void;
  deleteMusic?(url: string): void;
}

export interface C2S {
  // current RPC-style client -> server calls
  getAllMusics(callback: (musics: Music[]) => void): void;
  getRemoteStatus(callback: (state: RemoteStatus) => void): void;
  adminAuth(
    token: string,
    callback: (result: { success: boolean; error?: string }) => void,
  ): void;
  adminAuthByQuery(
    token: string,
    callback: (result: { success: boolean; error?: string }) => void,
  ): void;

  // server expects these events from clients (including legacy clients)
  // add/remove follow the handler signatures in server.handlers.music
  // add/remove return ReplyOptions-like responses. Keep it minimal here.
  addMusic?(
    url: string,
    requesterHash?: string,
    cb?: (res: { formErrors?: string[] } | Record<string, unknown>) => void,
  ): void;
  removeMusic?(
    url: string,
    requesterHash: string,
    cb?: (res: { formErrors?: string[] } | Record<string, unknown>) => void,
  ): void;

  // extension -> server custom event for youtube player state
  // extension -> server payload for youtube player state. Use discriminated union for common states.
  youtube_video_state?(
    payload:
      | { state: "playing"; url: string; origin?: string }
      | { state: "paused"; url?: string; origin?: string }
      | { state: "ended" | "window_close"; origin?: string }
      | { state: string; [k: string]: unknown },
  ): void;
}
