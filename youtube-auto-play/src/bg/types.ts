export interface TabInfo {
    id: number;
    url?: string;
    discarded?: boolean;
}

export interface VideoData {
    url: string;
    title?: string;
}

export interface MessageSender {
    tab?: TabInfo;
}

export interface SocketInstance {
    id?: string;
    connected: boolean;
    connect: () => void;
    emit: (event: string, data?: unknown, callback?: () => void) => void;
    on: (event: string, callback: (...args: unknown[]) => void) => void;
}

export interface VideoStateMessage {
    type: 'youtube_video_state';
    state: string;
    url: string;
}

export interface StorageResult {
    urlList?: VideoData[];
    latestUrl?: string;
    autoPlayEnabled?: boolean;
    extensionMasterEnabled?: boolean;
    manuallyDisabled?: boolean;
}

export interface ExtensionGlobal {
    isExtensionEnabled?: () => boolean;
    version?: string;
}

export interface SocketEventData {
    disconnect: string;
    connect_error: Error;
    new_url: VideoData;
    url_list: VideoData[];
    next_video_navigate: { nextUrl: string; tabId: number };
    no_next_video: { tabId: number };
}
