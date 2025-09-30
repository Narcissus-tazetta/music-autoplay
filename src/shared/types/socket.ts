import type { Music, RemoteStatus } from "~/stores/musicStore";

export interface S2C {
  musicAdded(music: Music): void;
  musicRemoved(musicId: string): void;
  remoteStatusUpdated(state: RemoteStatus): void;
  initMusics?(musics: Array<Music & { url: string }>): void;
  url_list?(musics: Array<Music & { url: string }>): void;
  addMusic?(music: Music & { url?: string }): void;
  deleteMusic?(url: string): void;
}

export interface C2S {
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
  youtube_video_state?(
    payload:
      | { state: "playing"; url: string; origin?: string }
      | { state: "paused"; url?: string; origin?: string }
      | { state: "ended" | "window_close"; origin?: string }
      | { state: string; [k: string]: unknown },
  ): void;
}
