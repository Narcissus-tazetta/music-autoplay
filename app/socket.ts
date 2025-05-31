import type { Music } from "./stores/musicStore";

// Server ~> Client
export interface S2C {
    addMusic(music: Music): void;
    initMusics(musics: Music[]): void;
    deleteMusic(url: string): void;

    // URLリスト機能
    url_list(urls: { url: string }[]): void;
    new_url(url: { url: string } | null): void;
    delete_url(url: string): void;
}
// Client ~> Server
export interface C2S {
    addMusic(music: Music, callback: (error?: string) => void): void;
    deleteMusic(url: string): void;

    // URLリスト機能
    submit_url(url: string): void;
    delete_url(url: string): void;
    get_urls(): void;
}
