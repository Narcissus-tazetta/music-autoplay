export interface UrlItem {
    url: string;
    title?: string;
}

export type MessageType =
    | 'extension_master_toggle'
    | 'find_youtube_tabs'
    | 'get_current_url'
    | 'delete_url'
    | 'yt_play'
    | 'yt_pause'
    | 'reconnect_socket'
    | 'disconnect_socket'
    | 'request_url_list'
    | 'url_list'
    | 'socket_error'
    | 'socket_disconnected'
    | 'youtube_video_state'
    | 'move_prev_video'
    | 'move_next_video'
    | 'show_video_end_alert'
    | 'get_video_state'
    | 'get_video_info'
    | 'wait_for_end'
    | 'mark_extension_opened'
    | 'force_pause'
    | 'toggle_play_pause'
    | 'pause_video'
    | 'video_ended'
    | 'ad_state_changed'
    | 'ad_skip_to_next'
    | 'get_ad_state'
    | 'progress_update'
    | 'batch_progress_update'
    | 'next_video_navigate'
    | 'no_next_video'
    | 'add_external_music'
    | 'mark_extension_navigating';

export interface ChromeStorageData {
    extensionMasterEnabled?: boolean;
    autoPlayEnabled?: boolean;
    urlList?: UrlItem[];
    latestUrl?: string;
    manuallyDisabled?: boolean;
}

export interface ChromeMessage {
    type: MessageType;
    url?: string;
    enabled?: boolean;
    state?: string;
    isAd?: boolean;
    currentTime?: number;
    duration?: number;
    [key: string]: unknown;
}

export interface ExtensionMasterToggleMessage extends ChromeMessage {
    type: 'extension_master_toggle';
    enabled: boolean;
}

export interface DeleteUrlMessage extends ChromeMessage {
    type: 'delete_url';
    url: string;
}

export interface UrlListMessage extends ChromeMessage {
    type: 'url_list';
    urls: UrlItem[];
}

export interface SocketErrorMessage extends ChromeMessage {
    type: 'socket_error';
    error: string;
}

export interface SocketDisconnectedMessage extends ChromeMessage {
    type: 'socket_disconnected';
    reason: string;
}

export type YouTubeVideoState = 'playing' | 'paused' | 'ended';

export interface YouTubeVideoStateMessage extends ChromeMessage {
    type: 'youtube_video_state';
    url: string;
    state: YouTubeVideoState;
    currentTime?: number;
    timestamp?: number;
    duration?: number;
    isAdvertisement?: boolean;
    videoId?: string;
    seq?: number;
    openedByExtension?: boolean;
}

export interface AdStateChangedMessage extends ChromeMessage {
    type: 'ad_state_changed';
    url: string;
    isAd: boolean;
    timestamp?: number;
    videoId?: string;
}

export interface ProgressUpdatePayload extends ChromeMessage {
    type: 'progress_update';
    url: string;
    videoId?: string;
    currentTime: number;
    duration: number;
    playbackRate?: number;
    isBuffering?: boolean;
    visibilityState?: 'visible' | 'hidden';
    timestamp: number;
    isAdvertisement?: boolean;
    musicTitle?: string;
    imminentEnd?: boolean;
    tabId?: string | number;
    progressPercent?: number;
    consecutiveStalls?: number;
    seq?: number;
    openedByExtension?: boolean;
}

export interface BatchProgressUpdateMessage extends ChromeMessage {
    type: 'batch_progress_update';
    updates: ProgressUpdatePayload[];
}

export interface MarkExtensionNavigatingMessage extends ChromeMessage {
    type: 'mark_extension_navigating';
    url: string;
}

export interface ChromeMessageResponse {
    status: 'ok' | 'error' | 'no_video' | 'not_extension_tab';
    error?: string;
    url?: string;
    title?: string;
    state?: string;
    isAd?: boolean;
}

export type ControlName = 'prev' | 'next' | 'play' | 'pause' | 'skip';

export interface ChromeTab {
    id?: number;
    url?: string;
    title?: string;
}
