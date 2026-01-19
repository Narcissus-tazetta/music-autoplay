import { setupMasterToggleHandler } from '../bg/master-toggle';
import { setupMessageHandler } from '../bg/message-handler';
import { handleShortcutCommand } from '../bg/shortcut-commands';
import { setupSocketEvents } from '../bg/socket-events';
import { handleTabCreated, handleTabRemoved, handleTabUpdated } from '../bg/tab-manager';
import type { SocketInstance } from '../bg/types';
import type { ChromeMessage } from '../types';

function getOffscreenUrlPathCandidates(): string[] {
    try {
        const swPath = chromeAny?.runtime?.getManifest?.()?.background?.service_worker;
        // If the extension is loaded from youtube-auto-play/dist, service_worker is usually "background.js".
        // If it's loaded from youtube-auto-play (repo root), service_worker is usually "dist/background.js".
        const isDistRoot = typeof swPath === 'string' && !swPath.includes('/');
        console.log('[SW] Offscreen path selection', { serviceWorker: swPath, isDistRoot });
        return isDistRoot
            ? ['src/offscreen/index.html', 'dist/src/offscreen/index.html']
            : ['dist/src/offscreen/index.html', 'src/offscreen/index.html'];
    } catch {
        return ['src/offscreen/index.html', 'dist/src/offscreen/index.html'];
    }
}
const ENSURE_OFFSCREEN_ALARM = 'ensure_offscreen' as const;

type OffscreenApiLike = {
    hasDocument?: () => Promise<boolean>;
    createDocument?: (options: {
        url: string;
        reasons: string[];
        justification: string;
    }) => Promise<void>;
};

type ChromeLike = typeof chrome & { offscreen?: OffscreenApiLike };
const chromeApi = chrome as ChromeLike;
const chromeAny = chrome as any;

let ensureOffscreenInFlight: Promise<void> | null = null;
let cachedHasOffscreen: { value: boolean; atMs: number } | null = null;
let lastCreateAttemptAtMs = 0;

type SocketHandler = (...args: unknown[]) => void;
const socketHandlers = new Map<string, Set<SocketHandler>>();
let socketConnected = false;

let offscreenReady = false;
let offscreenReadyAtMs = 0;
let offscreenReadySocketId: string | undefined;

type QueuedOffscreenMessage = {
    message: any;
    opts?: { expectResponse?: boolean };
    queuedAtMs: number;
    resolve?: (value: any) => void;
    reject?: (reason?: any) => void;
};

const queuedNonAckByEvent = new Map<string, QueuedOffscreenMessage>();
const queuedAckMessages: QueuedOffscreenMessage[] = [];
let flushQueueInFlight: Promise<void> | null = null;

function markOffscreenNotReady(reason: string): void {
    if (!offscreenReady) return;
    offscreenReady = false;
    offscreenReadyAtMs = 0;
    offscreenReadySocketId = undefined;
    console.log('[SW] offscreen marked not ready', { reason });
}

function dispatchSocketEvent(event: string, args: unknown[]): void {
    if (event === 'connect') socketConnected = true;
    if (event === 'disconnect') socketConnected = false;

    if (event === 'connect' || event === 'disconnect' || event === 'connect_error') {
        const first = args?.[0] as any;
        console.log('[SW] socket event', {
            event,
            connected: socketConnected,
            message: first?.message ?? (typeof first === 'string' ? first : undefined),
        });
    }

    const handlers = socketHandlers.get(event);
    if (!handlers || handlers.size === 0) return;
    for (const handler of handlers) {
        try {
            handler(...args);
        } catch {
            // ignore
        }
    }
}

const socketProxy: SocketInstance & {
    once?: (event: string, cb: SocketHandler) => void;
    off?: (event: string, cb: SocketHandler) => void;
} = {
    connected: false,
    connect: () => {
        void sendToOffscreen({
            type: 'socket_connect',
            __fromSwInternal: true,
        } as any);
    },
    emit: (event: string, data?: unknown, callback?: any) => {
        let payload = data;
        let cb = callback;

        if (typeof payload === 'function' && cb === undefined) {
            cb = payload;
            payload = undefined;
        }

        const args = payload === undefined ? [] : [payload];

        if (typeof cb === 'function') {
            void sendToOffscreen(
                {
                    type: 'socket_emit',
                    event,
                    args,
                    expectAck: true,
                    __fromSwInternal: true,
                } as any,
                { expectResponse: true },
            ).then(
                (resp: any) => {
                    try {
                        const ackArgs = Array.isArray(resp?.ack) ? resp.ack : [];
                        cb(ackArgs[0]);
                    } catch {
                        // ignore
                    }
                },
                () => {
                    try {
                        cb(undefined);
                    } catch {
                        // ignore
                    }
                },
            );
            return;
        }

        void sendToOffscreen({
            type: 'socket_emit',
            event,
            args,
            expectAck: false,
            __fromSwInternal: true,
        } as any);
    },
    on: (event: string, callback: SocketHandler) => {
        const set = socketHandlers.get(event) ?? new Set<SocketHandler>();
        set.add(callback);
        socketHandlers.set(event, set);
    },
};

socketProxy.once = (event: string, cb: SocketHandler) => {
    const wrapper: SocketHandler = (...args: unknown[]) => {
        socketProxy.off?.(event, wrapper);
        cb(...args);
    };
    socketProxy.on(event, wrapper);
};

socketProxy.off = (event: string, cb: SocketHandler) => {
    const set = socketHandlers.get(event);
    if (!set) return;
    set.delete(cb);
};

Object.defineProperty(socketProxy, 'connected', {
    get: () => socketConnected,
});

function isNoReceiverError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return message.includes('Receiving end does not exist')
        || message.includes('Could not establish connection')
        || message.includes('The message port closed before a response was received');
}

async function sleep(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
}

async function sendToOffscreenRaw(message: any, opts?: { expectResponse?: boolean }): Promise<any> {
    const maxAttempts = 5;
    const delayMs = 200;

    const sendOnce = async (): Promise<any> => {
        return await new Promise<any>((resolve, reject) => {
            try {
                chrome.runtime.sendMessage(message, resp => {
                    const lastErr = chrome.runtime.lastError;
                    if (lastErr) {
                        reject(new Error(lastErr.message));
                        return;
                    }
                    resolve(resp);
                });
            } catch (err) {
                reject(err);
            }
        });
    };

    const attemptSend = async (attempt: number): Promise<any> => {
        try {
            return await sendOnce();
        } catch (err) {
            if (attempt < maxAttempts - 1 && isNoReceiverError(err)) {
                try {
                    await ensureOffscreen();
                } catch {
                    // ignore; we'll retry send anyway
                }
                await sleep(delayMs);
                return await attemptSend(attempt + 1);
            }
            if (opts?.expectResponse) throw err;
            return undefined;
        }
    };

    return await attemptSend(0);
}

async function kickOffscreenConnection(): Promise<void> {
    try {
        await ensureOffscreen();
    } catch {
        // ignore
    }

    try {
        await sendToOffscreenRaw({
            type: 'socket_connect',
            __fromSwInternal: true,
        } as any);
    } catch {
        // ignore
    }
}

function enqueueUntilOffscreenReady(message: any, opts?: { expectResponse?: boolean }): Promise<any> {
    void kickOffscreenConnection();

    const queuedAtMs = Date.now();

    if (message?.type === 'socket_emit' && message?.expectAck !== true) {
        const event = typeof message?.event === 'string' ? message.event : '__unknown__';
        queuedNonAckByEvent.set(event, { message, opts, queuedAtMs });
        return Promise.resolve(undefined);
    }

    // Ack / expectResponse: keep ordering but cap memory.
    const MAX_ACK_QUEUE = 50;
    if (queuedAckMessages.length >= MAX_ACK_QUEUE) {
        const dropped = queuedAckMessages.shift();
        try {
            dropped?.reject?.(new Error('dropped queued offscreen message (queue full)'));
        } catch {
            // ignore
        }
    }

    return new Promise((resolve, reject) => {
        queuedAckMessages.push({ message, opts, queuedAtMs, resolve, reject });
    });
}

async function flushOffscreenQueueIfReady(): Promise<void> {
    if (!offscreenReady) return;
    if (flushQueueInFlight) return await flushQueueInFlight;

    flushQueueInFlight = (async () => {
        // Flush non-ack (latest per event). Order is not required here.
        const nonAckEntries = Array.from(queuedNonAckByEvent.values());
        queuedNonAckByEvent.clear();
        await Promise.all(
            nonAckEntries.map(async entry => {
                try {
                    await sendToOffscreenRaw(entry.message, entry.opts);
                } catch {
                    // ignore
                }
            }),
        );

        // Flush ack (preserve order) without `await` in a loop.
        const ackEntries = queuedAckMessages.splice(0, queuedAckMessages.length);
        await ackEntries.reduce<Promise<void>>((p, entry) => {
            return p.then(async () => {
                try {
                    const resp = await sendToOffscreenRaw(entry.message, entry.opts);
                    entry.resolve?.(resp);
                } catch (err) {
                    entry.reject?.(err);
                }
            });
        }, Promise.resolve());
    })().finally(() => {
        flushQueueInFlight = null;
    });

    return await flushQueueInFlight;
}

async function sendToOffscreen(message: any, opts?: { expectResponse?: boolean }): Promise<any> {
    // Gate socket emits until Offscreen has confirmed:
    // 1) silent audio keepalive is started
    // 2) socket is connected
    // then it sends OFFSCREEN_READY.
    if (message?.type === 'socket_emit' && offscreenReady !== true)
        return await enqueueUntilOffscreenReady(message, opts);

    return await sendToOffscreenRaw(message, opts);
}

async function hasOffscreenDocument(): Promise<boolean> {
    try {
        if (!chromeApi.offscreen?.hasDocument) return false;

        const now = Date.now();
        if (cachedHasOffscreen && now - cachedHasOffscreen.atMs < 2000) return cachedHasOffscreen.value;
        const value = await chromeApi.offscreen.hasDocument();
        cachedHasOffscreen = { value, atMs: now };
        if (!value) markOffscreenNotReady('hasDocument:false');
        return value;
    } catch {
        return false;
    }
}

async function ensureOffscreen(): Promise<void> {
    if (!chromeApi.offscreen?.createDocument) return;

    if (ensureOffscreenInFlight) return await ensureOffscreenInFlight;
    ensureOffscreenInFlight = (async () => {
        if (await hasOffscreenDocument()) return;

        const now = Date.now();
        if (now - lastCreateAttemptAtMs < 1500) return;
        lastCreateAttemptAtMs = now;

        const pathCandidates = getOffscreenUrlPathCandidates();
        const urlCandidates = pathCandidates.map(path => {
            try {
                return chromeAny?.runtime?.getURL?.(path) ?? path;
            } catch {
                return path;
            }
        });

        console.log('[SW] Offscreen URL candidates', { pathCandidates, urlCandidates });

        const tryCreate = async (idx: number, lastError: unknown): Promise<void> => {
            if (idx >= urlCandidates.length) {
                console.error('[SW] Failed to create offscreen with all URLs', lastError);
                if (lastError) throw lastError;
                return;
            }

            const createDocument = chromeApi.offscreen?.createDocument;
            if (!createDocument) return;

            const url = urlCandidates[idx];
            console.log('[SW] Attempting to create offscreen', { url, attempt: idx + 1 });
            try {
                await createDocument({
                    url,
                    reasons: ['AUDIO_PLAYBACK'],
                    justification:
                        'Use an offscreen document with silent audio to keep a stable socket connection for YouTube playback status updates.',
                });
                cachedHasOffscreen = { value: true, atMs: Date.now() };
                markOffscreenNotReady('offscreen created');
                console.log('[SW] Offscreen document created successfully', { url });
                return;
            } catch (err) {
                cachedHasOffscreen = null;
                console.warn('[SW] Failed to create offscreen with URL', { url, error: err });
                return await tryCreate(idx + 1, err);
            }
        };

        await tryCreate(0, null);
    })().finally(() => {
        ensureOffscreenInFlight = null;
    });

    return await ensureOffscreenInFlight;
}

function ensureSidePanelBehavior(): void {
    try {
        (chrome as any).sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true });
    } catch {
        // ignore
    }
}

chromeAny.runtime?.onInstalled?.addListener?.(() => {
    console.log('[SW] onInstalled fired');
    ensureSidePanelBehavior();
    void ensureOffscreen().then(
        () => console.log('[SW] Offscreen ensured on install'),
        err => console.error('[SW] Failed to ensure offscreen on install', err),
    );
    void kickOffscreenConnection();

    try {
        chromeAny.alarms?.create?.(ENSURE_OFFSCREEN_ALARM, { periodInMinutes: 1 });
    } catch {
        // ignore
    }
});

chromeAny.runtime?.onStartup?.addListener?.(() => {
    console.log('[SW] onStartup fired');
    void ensureOffscreen().then(
        () => console.log('[SW] Offscreen ensured on startup'),
        err => console.error('[SW] Failed to ensure offscreen on startup', err),
    );
    void kickOffscreenConnection();
});

// Offscreen -> SW: socket events/status dispatch
chrome.runtime.onMessage.addListener((message: any) => {
    if (!message || typeof message !== 'object') return false;
    if (message.__fromOffscreenInternal !== true) return false;

    if (message.type === 'OFFSCREEN_READY') {
        offscreenReady = true;
        offscreenReadyAtMs = typeof message.atMs === 'number' ? message.atMs : Date.now();
        offscreenReadySocketId = typeof message.socketId === 'string' ? message.socketId : undefined;
        console.log('[SW] OFFSCREEN_READY received', {
            atMs: offscreenReadyAtMs,
            socketId: offscreenReadySocketId,
            url: typeof message.url === 'string' ? message.url : undefined,
            audioStarted: message.audioStarted === true,
        });
        void flushOffscreenQueueIfReady();
        return false;
    }

    if (message.type === 'socket_status' && typeof message.connected === 'boolean') {
        socketConnected = message.connected;
        if (!socketConnected) markOffscreenNotReady('socket disconnected');
        dispatchSocketEvent(message.connected ? 'connect' : 'disconnect', []);
        return false;
    }

    if (message.type === 'socket_event' && typeof message.event === 'string') {
        dispatchSocketEvent(message.event, Array.isArray(message.args) ? message.args : []);
        return false;
    }

    return false;
});

chromeAny.alarms?.onAlarm?.addListener?.((alarm: any) => {
    if (alarm.name !== ENSURE_OFFSCREEN_ALARM) return;
    void ensureOffscreen();
});

// Tabs lifecycle: keep tab-manager state in SW (tabs API is reliable here)
try {
    chrome.tabs.onCreated.addListener(tab => {
        try {
            handleTabCreated(tab as any);
        } catch {
            // ignore
        }
    });
} catch {
    // ignore
}

try {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        try {
            handleTabUpdated(tabId, changeInfo, tab as any, socketProxy);
        } catch {
            // ignore
        }
    });
} catch {
    // ignore
}

try {
    chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
        try {
            handleTabRemoved(tabId, removeInfo, socketProxy as any);
        } catch {
            // ignore
        }
    });
} catch {
    // ignore
}

// Commands: handle in SW and use socketProxy when needed
chrome.commands.onCommand.addListener(command => {
    console.log('[SW] Command received', command);
    try {
        handleShortcutCommand(command, socketProxy);
    } catch (err) {
        console.error('[SW] Command handler failed; falling back', err);
        void handleShortcutFallback(command);
    }
});

// Initialize SW-side handlers
try {
    setupMasterToggleHandler();
} catch {
    // ignore
}
try {
    setupMessageHandler(socketProxy);
} catch {
    // ignore
}
try {
    setupSocketEvents(socketProxy, () => socketProxy);
} catch {
    // ignore
}

async function sendTogglePlayPause(tabId: number): Promise<boolean> {
    return await new Promise<boolean>(resolve => {
        try {
            chrome.tabs.sendMessage(tabId, { type: 'toggle_play_pause' }, () => {
                resolve(!chrome.runtime.lastError);
            });
        } catch {
            resolve(false);
        }
    });
}

async function handleShortcutFallback(command: string): Promise<void> {
    try {
        if (command === 'pause-youtube') {
            const activeTab = await new Promise<any>(resolve => {
                try {
                    chrome.tabs.query({ active: true, currentWindow: true }, tabs => resolve(tabs?.[0]));
                } catch {
                    resolve(undefined);
                }
            });

            const url = typeof activeTab?.url === 'string' ? activeTab.url : '';
            const isYouTube = url.includes('youtube.com/') || url.includes('youtu.be/');
            const targetTabId = isYouTube ? activeTab?.id : undefined;

            if (typeof targetTabId === 'number') {
                await sendTogglePlayPause(targetTabId);
                return;
            }

            const ytTabs = await new Promise<any[]>(resolve => {
                try {
                    chrome.tabs.query({ url: '*://*.youtube.com/*' }, tabs => resolve(tabs || []));
                } catch {
                    resolve([]);
                }
            });
            const first = ytTabs.find(t => typeof t?.id === 'number');
            if (first?.id) await sendTogglePlayPause(first.id);
            return;
        }

        if (command === 'open-first-url') {
            const firstUrl = await new Promise<string | null>(resolve => {
                try {
                    chrome.storage.local.get(['urlList'], result => {
                        const list = result?.urlList || [];
                        const url = list?.[0]?.url;
                        resolve(typeof url === 'string' ? url : null);
                    });
                } catch {
                    resolve(null);
                }
            });

            if (!firstUrl) return;
            await new Promise<void>(resolve => {
                try {
                    chrome.tabs.create({ url: firstUrl }, tab => {
                        try {
                            if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'mark_extension_opened' });
                        } catch {
                            // ignore
                        }
                        resolve();
                    });
                } catch {
                    resolve();
                }
            });
            return;
        }
    } catch (err) {
        console.error('[SW] Shortcut fallback failed', err);
    }
}

chrome.runtime.onMessage.addListener((message: ChromeMessage & Record<string, unknown>, sender, sendResponse) => {
    if (!message || typeof message !== 'object') return false;
    if ((message as any).__fromSwInternal === true) return false;
    if ((message as any).__fromOffscreenInternal === true) return false;

    if ((message as any).type === 'find_youtube_tabs') {
        try {
            chrome.tabs.query({ url: '*://*.youtube.com/*' }, tabs => {
                const tabIds = (tabs || []).map(tab => tab.id).filter((id): id is number => id !== undefined);
                try {
                    chrome.tabs.query({ url: '*://youtu.be/*' }, shortTabs => {
                        const shortIds = (shortTabs || [])
                            .map(tab => tab.id)
                            .filter((id): id is number => id !== undefined);
                        sendResponse({ status: 'ok', tabIds: [...tabIds, ...shortIds] } as any);
                    });
                } catch {
                    sendResponse({ status: 'ok', tabIds } as any);
                }
            });
            return true;
        } catch (err) {
            try {
                sendResponse({ status: 'error', error: err instanceof Error ? err.message : String(err) } as any);
            } catch {
                // ignore
            }
            return true;
        }
    }

    if ((message as any).type === 'ensure_offscreen') {
        void ensureOffscreen().then(
            () => sendResponse({ status: 'ok' }),
            err => sendResponse({ status: 'error', error: err instanceof Error ? err.message : String(err) }),
        );
        return true;
    }

    return false;
});
