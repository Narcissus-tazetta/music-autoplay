import type { Music, RemoteStatus } from "~/stores/musicStore";

export interface S2C {
  musicAdded(music: Music): void;
  musicRemoved(musicId: string): void;
  remoteStatusUpdated(state: RemoteStatus): void;
}

export interface C2S {
  getAllMusics(callback: (musics: Music[]) => void): void;
  getRemoteStatus(callback: (state: RemoteStatus) => void): void;
}
