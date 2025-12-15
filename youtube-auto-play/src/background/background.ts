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
    autoConnect: false,
} as const;

const SOCKET_URLS = {
    local: 'http://localhost:3000',
    production: 'https://music-auto-play.onrender.com',
} as const;

const CONNECTION_TIMEOUT_MS = 5000;
const PRIMARY_RECONNECT_INTERVAL_MS = 30000;
const RESTORE_PRIMARY_ALARM = 'restore_primary';

type AlarmLike = { name?: string };
type AlarmsApiLike = {
    clear?: (name: string, cb?: () => void) => void;
    create?: (name: string, info: { periodInMinutes?: number }) => void;
    onAlarm?: { addListener: (cb: (alarm: AlarmLike) => void) => void };
};

const alarmsApi = (globalThis as unknown as { chrome?: { alarms?: AlarmsApiLike } }).chrome?.alarms;

interface SocketConnection {
    socket: Socket;
    url: string;
    isPrimary: boolean;
}

let currentConnection: SocketConnection | null = null;
let lastHeartbeatAtMs = 0;

function log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const logData = data ? ` ${JSON.stringify(data)}` : '';
    console[level](`[SocketManager ${timestamp}] ${message}${logData}`);
}

async function tryConnect(url: string, isPrimary: boolean): Promise<Socket | null> {
    return new Promise(resolve => {
        log('info', 'Attempting connection', { url, isPrimary });

        const socket = io(url, SOCKET_OPTIONS);
        let settled = false;

        const timeout = setTimeout(() => {
            if (!settled) {
                settled = true;
                log('warn', 'Connection timeout', { url, timeout: CONNECTION_TIMEOUT_MS });
                socket.disconnect();
                socket.close();
                resolve(null);
            }
        }, CONNECTION_TIMEOUT_MS);

        socket.once('connect', () => {
            if (!settled) {
                settled = true;
                clearTimeout(timeout);
                log('info', 'Connection successful', { url, isPrimary });

                // Warn if connected to localhost in what appears to be production context
                if (url.includes('localhost') && typeof navigator !== 'undefined')
                    log('warn', 'Connected to localhost - ensure this is intentional in your environment', { url });

                resolve(socket);
            }
        });

        socket.once('connect_error', error => {
            if (!settled) {
                settled = true;
                clearTimeout(timeout);
                log('info', 'Connection failed', { url, error: error.message });
                socket.disconnect();
                socket.close();
                resolve(null);
            }
        });

        socket.connect();
    });
}

async function createSocketWithFallback(): Promise<SocketConnection> {
    // Try primary (production) first
    log('info', 'Starting socket connection with fallback mechanism', { primary: SOCKET_URLS.production });

    let socket = await tryConnect(SOCKET_URLS.production, true);
    if (socket) return { socket, url: SOCKET_URLS.production, isPrimary: true };

    // Fallback to local
    log('info', 'Primary connection failed, falling back to secondary', { fallback: SOCKET_URLS.local });
    socket = await tryConnect(SOCKET_URLS.local, false);

    if (socket) return { socket, url: SOCKET_URLS.local, isPrimary: false };

    // If both fail, return production socket in disconnected state as last resort
    log('error', 'All connection attempts failed, creating fallback socket in disconnected state');
    const fallbackSocket = io(SOCKET_URLS.production, SOCKET_OPTIONS);
    return { socket: fallbackSocket, url: SOCKET_URLS.production, isPrimary: true };
}

// Initialize connection (wrapped in IIFE to avoid top-level await)
let socket: Socket;

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

(async () => {
    currentConnection = await createSocketWithFallback();
    socket = currentConnection.socket;

    // Setup handlers after socket is ready
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
    setupShortcutCommands(socket);

    if (alarmsApi) {
        alarmsApi.clear(RESTORE_PRIMARY_ALARM, () => {
            alarmsApi.create(RESTORE_PRIMARY_ALARM, {
                periodInMinutes: PRIMARY_RECONNECT_INTERVAL_MS / 60000,
            });
        });
    }
})();

alarmsApi?.onAlarm.addListener(async (alarm: AlarmLike) => {
    if (alarm.name !== RESTORE_PRIMARY_ALARM) return;
    if (currentConnection && !currentConnection.isPrimary && currentConnection.socket.connected) {
        log('info', 'Attempting to restore primary connection', { current: currentConnection.url });

        const primarySocket = await tryConnect(SOCKET_URLS.production, true);
        if (primarySocket) {
            log('info', 'Successfully restored primary connection, switching from fallback', {
                from: currentConnection.url,
                to: SOCKET_URLS.production,
            });

            const oldSocket = currentConnection.socket;
            oldSocket.disconnect();
            oldSocket.close();

            currentConnection = { socket: primarySocket, url: SOCKET_URLS.production, isPrimary: true };
            socket = primarySocket;

            setupMessageHandler(socket);
            setupSocketEvents(socket);

            log('info', 'Primary connection restored and handlers re-registered successfully.');
        }
    }
});

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
    if (currentConnection?.socket && !currentConnection.socket.connected) {
        log('info', 'Reconnecting socket', { url: currentConnection.url });
        currentConnection.socket.connect();
    }
}

function emitExtensionHeartbeatIfConnected(): void {
    const sock = currentConnection?.socket;
    if (!sock?.connected) return;

    const now = Date.now();
    if (now - lastHeartbeatAtMs < 25_000) return;
    lastHeartbeatAtMs = now;

    try {
        sock.emit('extension_heartbeat', { timestamp: now });
    } catch (error) {
        log('warn', 'Failed to emit extension heartbeat', {
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

extendedChrome?.runtime?.onStartup?.addListener(() => {});

extendedChrome?.runtime?.onInstalled?.addListener(() => {
    extendedChrome?.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true });
});

self.addEventListener('activate', reconnectSocketIfNeeded);

setInterval(() => {
    reconnectSocketIfNeeded();
    emitExtensionHeartbeatIfConnected();
    extendedChrome?.runtime?.getPlatformInfo?.(() => {});
}, KEEP_ALIVE_INTERVAL);

extendedChrome?.alarms?.create?.('keepAlive', { periodInMinutes: KEEP_ALIVE_ALARM_INTERVAL });
extendedChrome?.alarms?.onAlarm?.addListener(alarm => {
    if (alarm.name === 'keepAlive') {
        chrome.storage.local.get([], () => {});
        reconnectSocketIfNeeded();
        emitExtensionHeartbeatIfConnected();
    }
});
