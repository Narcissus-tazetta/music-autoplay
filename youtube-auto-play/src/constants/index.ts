export const YOUTUBE_URL_PATTERN = '*://www.youtube.com/*';
export const YOUTUBE_WATCH_URL_PATTERN = '*://www.youtube.com/watch*';
export const YOUTUBE_VIDEO_ID_REGEX = /[?&]v=([\w-]{11})/;

export const VIDEO_RETRY_CONFIG = {
    MAX_RETRIES: 5,
    INITIAL_DELAY: 500,
    MAX_DELAY: 1000,
} as const;

export const STORAGE_KEYS = {
    MANUAL_AUTOPLAY_ENABLED: 'manualAutoPlayEnabled',
    DEADLINE_ENABLED: 'deadlineEnabled',
    URL_LIST: 'urlList',
    LATEST_URL: 'latestUrl',
    MANUALLY_DISABLED: 'manuallyDisabled',
    OPENED_BY_EXTENSION: 'opened_by_extension',
} as const;

export const MESSAGE_TYPES = {
    EXTENSION_MASTER_TOGGLE: 'extension_master_toggle',
    SET_MANUAL_AUTOPLAY: 'set_manual_autoplay',
    SET_DEADLINE: 'set_deadline',
    FIND_YOUTUBE_TABS: 'find_youtube_tabs',
    GET_CURRENT_URL: 'get_current_url',
    DELETE_URL: 'delete_url',
    YT_PLAY: 'yt_play',
    YT_PAUSE: 'yt_pause',
    RECONNECT_SOCKET: 'reconnect_socket',
    URL_LIST: 'url_list',
    SOCKET_ERROR: 'socket_error',
    SOCKET_DISCONNECTED: 'socket_disconnected',
    YOUTUBE_VIDEO_STATE: 'youtube_video_state',
} as const;

export const UI_TEXT = {
    EXTENSION_STATUS_ON: 'ON',
    EXTENSION_STATUS_OFF: 'OFF',
    AUTO_TAB_LABEL: 'Auto Tab',
    DEADLINE_LABEL: 'Deadline',
    NO_URLS_MESSAGE: 'URLがありません',
    PREV_BUTTON: '前の動画',
    NEXT_BUTTON: '次の動画',
    PAUSE_BUTTON: '停止',
    PLAY_BUTTON: '再生',
    SKIP_BUTTON: 'スキップ',
    OPEN_URL_BUTTON: 'URLを開く',
    URL_LIST_TITLE: 'URLリスト',
    SHORTCUTS_TITLE: 'ショートカットキー一覧',
} as const;

export const EXTENSION_NAMESPACE = '__YOUTUBE_AUTOPLAY_EXT__' as const;

export const TIMING = {
    TAB_CREATION_DELAY: 1000,
    MARK_EXTENSION_DELAY: 1000,
    WEEKEND_CHECK_INTERVAL: 60000,
    VIDEO_END_ALERT_TIMEOUT: 2000,
    WAIT_FOR_END_TIMEOUT: 600000,
} as const;

export const SHORTCUTS = [
    {
        key: 'Cmd+Shift+X',
        description: 'YouTube動画の再生/停止',
    },
    {
        key: 'Cmd+Shift+L',
        description: 'URLリストの先頭を開く',
    },
] as const;

export const TIMEOUTS = {
    VIDEO_END_ALERT: 2000,
    PAGE_CHANGE_DETECT: 100,
    URL_CHANGE_POLL: 500,
} as const;
