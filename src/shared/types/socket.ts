export type MusicPayload = {
  id?: string;
  title: string;
  url?: string;
  thumbnail?: string;
};

export type RemoteStatus = {
  type: "open" | "closed" | "playing" | "paused";
  nowPlayingId?: string;
};

// Server -> Client
export interface S2C {
  musicAdded: (music: MusicPayload) => void;
  musicRemoved: (id: string) => void;
  remoteStatusChanged: (status: RemoteStatus) => void;
}

// Client -> Server
export interface C2S {
  getAllMusics: (cb: (musics: MusicPayload[]) => void) => void;
  getRemoteStatus: (cb: (status: RemoteStatus) => void) => void;
}
