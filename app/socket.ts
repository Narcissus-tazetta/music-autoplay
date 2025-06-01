import type { Music } from "./stores/musicStore";

// Server ~> Client
export interface S2C {
    addMusic(music: Music): void;
    initMusics(musics: Music[]): void;
    deleteMusic(url: string): void;
    url_list(musics: Music[]): void;
    new_url(music: Music | null): void;
    delete_url(url: string): void;

    // YouTube拡張: サーバー→クライアント
    current_youtube_status(data: {
        state: string;
        url: string;
        match: boolean;
        music: Music | null;
    }): void;
}
// Client ~> Server
export interface C2S {
    addMusic(music: Music, callback: (error?: string) => void): void;
    deleteMusic(url: string): void;

    // URLリスト機能
    get_urls(): void;
    submit_url(url: string): void;
    delete_url(url: string): void;

    // YouTube拡張: クライアント→サーバー
    youtube_video_state(data: { state: string; url: string }): void;
    youtube_tab_closed(data: { url: string }): void;
}
