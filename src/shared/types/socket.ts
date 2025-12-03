import type { Music, RemoteStatus } from '@/shared/stores/musicStore';

export interface S2C {
    musicAdded(music: Music): void;
    musicRemoved(musicId: string): void;
    remoteStatusUpdated(state: RemoteStatus): void;
    initMusics?(musics: Array<Music & { url: string }>): void;
    url_list?(musics: Array<Music & { url: string }>): void;
    addMusic?(music: Music & { url?: string }): void;
    deleteMusic?(url: string): void;
    navigate_to_video?(payload: { videoId: string; url: string }): void;
    next_video_navigate?(payload: { nextUrl: string; tabId?: number; videoId?: string }): void;
    no_next_video?(payload: { tabId?: number }): void;
}

export interface C2S {
    getAllMusics(callback: (musics: Music[]) => void): void;
    getRemoteStatus(callback: (state: RemoteStatus) => void): void;
    adminAuth(token: string, callback: (result: { success: boolean; error?: string }) => void): void;
    adminAuthByQuery(token: string, callback: (result: { success: boolean; error?: string }) => void): void;
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
            | { state: 'playing'; url: string; origin?: string }
            | { state: 'paused'; url?: string; origin?: string }
            | { state: 'ended' | 'window_close'; origin?: string }
            | { state: string; [k: string]: unknown },
    ): void;
    move_prev_video?(payload: unknown): void;
    move_next_video?(payload: unknown): void;
    tab_closed?(payload: unknown): void;
    ad_state_changed?(payload: unknown): void;
    video_ended?(payload: unknown): void;
    progress_update?(payload: unknown): void;
    no_next_video?(payload: unknown): void;
}
