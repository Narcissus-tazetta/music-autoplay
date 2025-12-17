import { io, type Socket } from 'socket.io-client';
import { setupMasterToggleHandler } from '../bg/master-toggle';
import { setupMessageHandler } from '../bg/message-handler';
import { setupShortcutCommands } from '../bg/shortcut-commands';
import { handleUrlList, setupSocketEvents } from '../bg/socket-events';
import { handleTabCreated, handleTabRemoved, handleTabUpdated } from '../bg/tab-manager';
import type { ExtensionMode } from '../types';

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
const LAST_ATTEMPT: Map<string, number> = new Map();
const BACKOFF_BASE_MS = 2000;

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
                if (url.includes('localhost') && typeof navigator !== 'undefined')
                    log('warn', 'Connected to localhost - ensure this is intentional in your environment', { url });

                const now = Date.now();
                LAST_ATTEMPT.set(url, now);

                if (url.includes('localhost')) {
                    (async () => {
                        try {
                            const controller = new AbortController();
                            const id = setTimeout(() => controller.abort(), 1500);
                            const healthUrl = `${url.replace(/\/$/, '')}/healthz`;
                            const res = await fetch(healthUrl, { method: 'GET', signal: controller.signal });
                            clearTimeout(id);
                            if (res.ok) resolve(socket);
                            else {
                                socket.disconnect();
                                socket.close();
                                resolve(null);
                            }
                        } catch {
                            try {
                                socket.disconnect();
                                socket.close();
                            } catch {
                                // ignore
                            }
                            resolve(null);
                        }
                    })();
                } else {
                    resolve(socket);
                }
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

async function getStoredExtensionMode(): Promise<ExtensionMode> {
    return new Promise(resolve => {
        chrome.storage.local.get(['extensionMode'], result => {
            const mode = result.extensionMode as ExtensionMode | undefined;
            resolve(mode ?? 'auto');
        });
    });
}

async function createSocketWithPreference(mode: ExtensionMode): Promise<SocketConnection> {
    if (mode === 'local') {
        log('info', 'Mode: local - connecting to localhost only', { mode });
        const socket = await tryConnect(SOCKET_URLS.local, true);
        if (socket) return { socket, url: SOCKET_URLS.local, isPrimary: true };

        log('error', 'Local mode connection failed, creating disconnected socket');
        const fallbackSocket = io(SOCKET_URLS.local, SOCKET_OPTIONS);
        return { socket: fallbackSocket, url: SOCKET_URLS.local, isPrimary: true };
    }

    if (mode === 'production') {
        log('info', 'Mode: production - connecting to production only', { mode });
        const socket = await tryConnect(SOCKET_URLS.production, true);
        if (socket) return { socket, url: SOCKET_URLS.production, isPrimary: true };

        log('error', 'Production mode connection failed, creating disconnected socket');
        const fallbackSocket = io(SOCKET_URLS.production, SOCKET_OPTIONS);
        return { socket: fallbackSocket, url: SOCKET_URLS.production, isPrimary: true };
    }

    log('info', 'Mode: auto - trying local then production', { mode });
    let socket = await tryConnect(SOCKET_URLS.local, true);
    if (socket) return { socket, url: SOCKET_URLS.local, isPrimary: true };

    log('info', 'Primary connection failed, falling back to secondary', { fallback: SOCKET_URLS.production });
    socket = await tryConnect(SOCKET_URLS.production, false);
    if (socket) return { socket, url: SOCKET_URLS.production, isPrimary: false };

    log('error', 'All connection attempts failed, creating fallback socket in disconnected state');
    const fallbackSocket = io(SOCKET_URLS.production, SOCKET_OPTIONS);
    return { socket: fallbackSocket, url: SOCKET_URLS.production, isPrimary: false };
}

type TabUpdateListener = (tabId: number, changeInfo: unknown, tab: { id?: number; url?: string }) => void;
type TabRemovedListener = (tabId: number, removeInfo: unknown) => void;

let tabUpdateListener: TabUpdateListener | null = null;
let tabRemovedListener: TabRemovedListener | null = null;
let isFirstInit = true;

async function initConnectionFromMode(): Promise<void> {
    const mode = await getStoredExtensionMode();
    currentConnection = await createSocketWithPreference(mode);
    socket = currentConnection.socket;

    if (tabUpdateListener) {
        try {
            (chrome.tabs.onUpdated as { removeListener?: (cb: TabUpdateListener) => void }).removeListener?.(
                tabUpdateListener,
            );
        } catch {}
    }
    if (tabRemovedListener) {
        try {
            (chrome.tabs.onRemoved as { removeListener?: (cb: TabRemovedListener) => void }).removeListener?.(
                tabRemovedListener,
            );
        } catch {}
    }

    tabUpdateListener = (tabId, changeInfo, tab) => {
        if (typeof tab.id === 'number') handleTabUpdated(tabId, changeInfo, { id: tab.id, url: tab.url }, socket);
    };
    tabRemovedListener = (tabId, removeInfo) => {
        handleTabRemoved(tabId, removeInfo, socket);
    };

    chrome.tabs.onUpdated.addListener(tabUpdateListener);
    if (isFirstInit) chrome.tabs.onCreated.addListener(handleTabCreated);
    chrome.tabs.onRemoved.addListener(tabRemovedListener);

    setupMessageHandler(socket);
    setupSocketEvents(socket, () => currentConnection?.socket);
    if (isFirstInit) setupMasterToggleHandler();
    setupShortcutCommands(socket);

    if (socket.connected) {
        socket.emit('getAllMusics', {}, (response: unknown) => {
            log('info', 'Requested getAllMusics after connection', { response });
            try {
                if (Array.isArray(response)) {
                    // Normalize response items to include `url` if possible (some servers return id/title)
                    const rawList = response as any[];
                    const normalized = rawList.map(item => {
                        // If already has url, use it
                        if (item && typeof item.url === 'string' && item.url.length > 0) return item;
                        // If has id, build youtube watch url
                        if (item && typeof item.id === 'string')
                            return { ...item, url: `https://www.youtube.com/watch?v=${item.id}` };
                        return item;
                    }).filter(i => i && typeof i.url === 'string');

                    if (normalized.length === 0) {
                        log('warn', 'getAllMusics returned items but none could be normalized to url list', {
                            sample: rawList[0],
                        });
                    } else {
                        try {
                            handleUrlList(normalized as any);
                        } catch (err) {
                            log('warn', 'Failed to handle url list from getAllMusics response', {
                                err: err instanceof Error ? err.message : err,
                            });
                        }
                    }
                }
            } catch (err) {
                log('warn', 'Error processing getAllMusics response', {
                    err: err instanceof Error ? err.message : err,
                });
            }
        });
        try {
            socket.emit('request_url_list', (response: unknown) => {
                log('info', 'Requested url_list after connection', { response });
            });
        } catch {}
    } else {
        socket.once('connect', () => {
            socket.emit('getAllMusics', {}, (response: unknown) => {
                log('info', 'Requested getAllMusics after connection', { response });
                try {
                    if (Array.isArray(response)) {
                        // eslint-disable-next-line @typescript-eslint/no-var-requires
                        const { handleUrlList } = require('./socket-events');
                        try {
                            handleUrlList(response as any);
                        } catch (err) {
                            log('warn', 'Failed to handle url list from getAllMusics response', { err });
                        }
                    }
                } catch {}
            });
            try {
                socket.emit('request_url_list', (response: unknown) => {
                    log('info', 'Requested url_list after connection', { response });
                });
            } catch {}
        });
    }

    if (isFirstInit && alarmsApi) {
        alarmsApi.clear?.(RESTORE_PRIMARY_ALARM, () => {
            alarmsApi.create?.(RESTORE_PRIMARY_ALARM, {
                periodInMinutes: PRIMARY_RECONNECT_INTERVAL_MS / 60000,
            });
        });
    }

    isFirstInit = false;
}

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
    await initConnectionFromMode();
})();

if (typeof chrome !== 'undefined' && chrome.storage) {
    const storageApi = chrome.storage as typeof chrome.storage & {
        onChanged?: {
            addListener: (
                callback: (
                    changes: { [key: string]: { oldValue?: unknown; newValue?: unknown } },
                    areaName: string,
                ) => void,
            ) => void;
        };
    };

    let _modeChangeTimer: ReturnType<typeof setTimeout> | null = null;
    let _pendingMode: ExtensionMode | null = null;

    storageApi.onChanged?.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.extensionMode) {
            const newMode = changes.extensionMode.newValue as ExtensionMode;
            // Debounce rapid mode changes to avoid flapping connections
            _pendingMode = newMode;
            if (_modeChangeTimer) clearTimeout(_modeChangeTimer as any);
            _modeChangeTimer = setTimeout(() => {
                const modeToApply = _pendingMode as ExtensionMode;
                _pendingMode = null;
                _modeChangeTimer = null;

                log('info', 'Extension mode changed (debounced), reconnecting', { modeToApply });

                (async () => {
                    const oldSocket = currentConnection?.socket;
                    if (oldSocket) {
                        try {
                            oldSocket.removeAllListeners();
                        } catch {}
                        oldSocket.disconnect();
                        oldSocket.close();
                    }

                    await initConnectionFromMode();

                    const newSocket = currentConnection?.socket;
                    if (newSocket?.connected) {
                        try {
                            newSocket.emit('request_url_list', () => {});
                        } catch {}
                    }
                })();
            }, 250);
        }
    });
}

alarmsApi?.onAlarm?.addListener(async (alarm: AlarmLike) => {
    if (alarm.name !== RESTORE_PRIMARY_ALARM) return;
    if (!(currentConnection && !currentConnection.isPrimary && currentConnection.socket.connected)) return;

    const last = LAST_ATTEMPT.get(SOCKET_URLS.local) ?? 0;
    const elapsed = Date.now() - last;
    if (elapsed < BACKOFF_BASE_MS) return;

    log('info', 'Attempting to restore primary (local) connection', { current: currentConnection.url });

    const primarySocket = await tryConnect(SOCKET_URLS.local, true);
    if (primarySocket) {
        log('info', 'Successfully restored primary connection (local), switching from fallback', {
            from: currentConnection.url,
            to: SOCKET_URLS.local,
        });

        const oldSocket = currentConnection.socket;
        try {
            oldSocket.removeAllListeners();
        } catch {}
        oldSocket.disconnect();
        oldSocket.close();

        currentConnection = { socket: primarySocket, url: SOCKET_URLS.local, isPrimary: true };
        socket = primarySocket;

        setupMessageHandler(socket);
        setupSocketEvents(socket);

        log('info', 'Primary (local) connection restored and handlers re-registered successfully.');
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

// Use the global chrome available in service worker/global scope instead of `window.chrome`.
// In MV3 service workers, `window` is undefined so previous checks could skip sidePanel setup.
const chromeApi = (globalThis as unknown as { chrome?: ChromeExtendedRuntime }).chrome as
    | ChromeExtendedRuntime
    | undefined;

function ensureSidePanelBehavior(): void {
    try {
        chromeApi?.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (error) {
        console.warn('Failed to set sidePanel behavior', error);
    }
}

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

// Attempt to set sidePanel behavior on install/startup and immediately on load.
chromeApi?.runtime?.onStartup?.addListener(() => {});

chromeApi?.runtime?.onInstalled?.addListener(() => {
    ensureSidePanelBehavior();
});

// Try once now so that if the service worker is already active we still set the behavior.
ensureSidePanelBehavior();

self.addEventListener('activate', reconnectSocketIfNeeded);

setInterval(() => {
    reconnectSocketIfNeeded();
    emitExtensionHeartbeatIfConnected();
    chromeApi?.runtime?.getPlatformInfo?.(() => {});
}, KEEP_ALIVE_INTERVAL);

chromeApi?.alarms?.create?.('keepAlive', { periodInMinutes: KEEP_ALIVE_ALARM_INTERVAL });
chromeApi?.alarms?.onAlarm?.addListener(alarm => {
    if (alarm.name === 'keepAlive') {
        chrome.storage.local.get([], () => {});
        reconnectSocketIfNeeded();
        emitExtensionHeartbeatIfConnected();
    }
});
