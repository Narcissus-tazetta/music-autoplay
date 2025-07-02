import type { Music } from "./stores/musicStore";
import { io, type Socket } from "socket.io-client";

/**
 * Socket.IOクライアントインスタンス
 * 型安全な通信のためにS2C/C2Sインターフェースを適用
 */
export const socket: Socket<S2C, C2S> = io();

export interface S2C {
  addMusic(music: Music): void;
  initMusics(musics: Music[]): void;
  deleteMusic(url: string): void;
  url_list(musics: Music[]): void;
  new_url(music: Music | null): void;
  delete_url(url: string): void;

  current_youtube_status(data: {
    state: string;
    url: string;
    match: boolean;
    music: Music | null;
  }): void;
}

export interface C2S {
  addMusic(music: Music, callback: (error?: string) => void): void;
  deleteMusic(url: string): void;

  get_urls(): void;
  submit_url(url: string): void;
  delete_url(url: string | { url: string }): void;

  youtube_video_state(data: { state: string; url: string }): void;
  youtube_tab_closed(data: { url: string }): void;
  move_prev_video(data: { url: string }): void;
  move_next_video(data: { url: string }): void;

  adminAuth(code: string, callback: (result: { success: boolean; error?: string }) => void): void;
  adminAuthByQuery(
    queryParam: string,
    callback: (result: { success: boolean; error?: string }) => void
  ): void;
}
