import type { Music, RemoteStatus } from '@/shared/stores/musicStore';
import type { HistoryItem, HistoryQuery } from '@/shared/types/history';

type ReplyOptions = { formErrors?: string[] } | Record<string, unknown>;

export interface EventMap {
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
    getHistory: [payload: HistoryQuery | undefined, cb: (items: HistoryItem[]) => void];
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
    move_prev_video: [payload: unknown];
    move_next_video: [payload: unknown];
    tab_closed: [payload: unknown];
    ad_state_changed: [payload: unknown];
    video_ended: [payload: unknown];
    video_next: [payload: unknown];
    admin_youtube_control: [
        payload: { action: 'toggle_play_pause' | 'prev' | 'next' | 'skip' },
        callback?: (res: { success: boolean; error?: string }) => void,
    ];

    // server -> client (emit)
    musicAdded: [payload: unknown];
    musicRemoved: [id: string];
    historyAdded: [item: HistoryItem];
    remoteStatusUpdated: [RemoteStatus];
    initMusics: [Array<Music & { url: string }>];
    url_list: [Array<Music & { url: string }>];
    // メモ: 今後追加されるイベントはここに追記してください
    deleteMusic: [string];
    admin_youtube_control_command: [payload: { action: 'toggle_play_pause' | 'prev' | 'next' | 'skip' }];
}

export type EventName = keyof EventMap;
