import type { Music, RemoteStatus } from "@/shared/stores/musicStore";

// Minimal ReplyOptions shape used by socket events
type ReplyOptions = { formErrors?: string[] } | Record<string, unknown>;

export type EventMap = {
  // client -> server
  addMusic: [
    url: string,
    requesterHash?: string,
    requesterName?: string,
    cb?: (res: ReplyOptions) => void,
  ];
  removeMusic: [
    url: string,
    requesterHash?: string,
    cb?: (res: ReplyOptions) => void,
  ];
  getAllMusics: [cb: (musics: Music[]) => void];
  getRemoteStatus: [cb: (state: RemoteStatus) => void];
  adminAuth: [
    token: string,
    cb: (result: { success: boolean; error?: string }) => void,
  ];
  adminAuthByQuery: [
    token: string,
    cb: (result: { success: boolean; error?: string }) => void,
  ];
  youtube_video_state: [payload: unknown];
  delete_url: [
    url: unknown,
    callback?: (res: {
      success: boolean;
      error?: string;
      message?: string;
    }) => void,
  ];
  window_close: [payload: unknown];

  // server -> client (emit)
  musicAdded: [payload: unknown];
  musicRemoved: [id: string];
  remoteStatusUpdated: [RemoteStatus];
  initMusics: [Array<Music & { url: string }>];
  url_list: [Array<Music & { url: string }>];
  // メモ: 今後追加されるイベントはここに追記してください
  deleteMusic: [string];
};

export type EventName = keyof EventMap;
