import { io, type Socket } from 'socket.io-client';
import { setupMasterToggleHandler } from '../bg/master-toggle';
import { setupMessageHandler } from '../bg/message-handler';
import { setupShortcutCommands } from '../bg/shortcut-commands';
import { setupSocketEvents } from '../bg/socket-events';
import { handleTabCreated, handleTabRemoved, handleTabUpdated } from '../bg/tab-manager';

const SOCKET_OPTIONS = {
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
    timeout: 10000,
    transports: ['websocket', 'polling'] as ('websocket' | 'polling')[],
    path: '/socket.io',
} as const;

const SOCKET_URLS = {
    local: 'http://localhost:3000',
    production: 'https://music-autoplay.onrender.com',
} as const;

function createSocketWithFallback(): { socket: Socket; url: string } {
    try {
        const socket = io(SOCKET_URLS.local, SOCKET_OPTIONS);
        socket.on('connect_error', () => {});
        return { socket, url: SOCKET_URLS.local };
    } catch {
        return { socket: io(SOCKET_URLS.production, SOCKET_OPTIONS), url: SOCKET_URLS.production };
    }
}

const { socket } = createSocketWithFallback();

interface FindYoutubeTabsResponse {
    status: 'ok';
    tabIds: number[];
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'find_youtube_tabs') {
        chrome.tabs.query({ url: '*://www.youtube.com/watch*' }, tabs => {
            const tabIds = tabs.map(tab => tab.id).filter((id): id is number => id !== undefined);
            const response: FindYoutubeTabsResponse = { status: 'ok', tabIds };
            sendResponse(response);
        });
        return true;
    }
    return false;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    handleTabUpdated(tabId, changeInfo, tab, socket);
});
chrome.tabs.onCreated.addListener(handleTabCreated);
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    handleTabRemoved(tabId, removeInfo, socket);
});

setupMessageHandler(socket);
setupSocketEvents(socket);
setupMasterToggleHandler();
setupShortcutCommands();

const KEEP_ALIVE_INTERVAL = 30_000;
const KEEP_ALIVE_ALARM_INTERVAL = 0.5;

interface ChromeExtendedRuntime {
    runtime?: {
        onStartup?: { addListener: (callback: () => void) => void };
        onInstalled?: { addListener: (callback: () => void) => void };
        getPlatformInfo?: (callback: () => void) => void;
    };
    sidePanel?: {
        setPanelBehavior: (options: { openPanelOnActionClick: boolean }) => void;
    };
    alarms?: {
        create?: (name: string, alarmInfo: { periodInMinutes: number }) => void;
        onAlarm?: {
            addListener: (callback: (alarm: { name: string }) => void) => void;
        };
    };
}

const extendedChrome = (
    typeof window !== 'undefined'
        ? (window as typeof window & { chrome?: ChromeExtendedRuntime }).chrome
        : undefined
) as ChromeExtendedRuntime | undefined;

function reconnectSocketIfNeeded(): void {
    if (socket && !socket.connected) socket.connect();
}

extendedChrome?.runtime?.onStartup?.addListener(() => {});

extendedChrome?.runtime?.onInstalled?.addListener(() => {
    extendedChrome?.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true });
});

self.addEventListener('activate', reconnectSocketIfNeeded);

setInterval(() => {
    reconnectSocketIfNeeded();
    extendedChrome?.runtime?.getPlatformInfo?.(() => {});
}, KEEP_ALIVE_INTERVAL);

extendedChrome?.alarms?.create?.('keepAlive', { periodInMinutes: KEEP_ALIVE_ALARM_INTERVAL });
extendedChrome?.alarms?.onAlarm?.addListener(alarm => {
    if (alarm.name === 'keepAlive') {
        chrome.storage.local.get([] as never, () => {});
        reconnectSocketIfNeeded();
    }
});
