import { io, type Socket } from 'socket.io-client';

const SOCKET_OPTIONS = {
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
    timeout: 10000,
    transports: ['websocket', 'polling'] as ('websocket' | 'polling')[],
    path: '/api/socket.io',
    autoConnect: false,
} as const;

const SOCKET_URL = 'http://localhost:3000' as const;
// Change the above URL if your backend server runs on a different address or port.

const CONNECTION_TIMEOUT_MS = 5000;

interface SocketConnection {
    socket: Socket;
    url: string;
    isPrimary: boolean;
}

let currentConnection: SocketConnection | null = null;
let lastHeartbeatAtMs = 0;

let initInFlight: Promise<void> | null = null;
let silentAudioStarted = false;

const chromeAny = (globalThis as any).chrome as any;

function hasExtensionApis(): boolean {
    return typeof chromeAny?.runtime?.id === 'string' && typeof chromeAny?.runtime?.sendMessage === 'function';
}

function log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const logData = data ? ` ${JSON.stringify(data)}` : '';
    console[level](`[Offscreen ${timestamp}] ${message}${logData}`);
}

async function tryConnect(url: string, _isPrimary: boolean): Promise<Socket | null> {
    return new Promise(resolve => {
        console.log('[Offscreen] tryConnect start', {
            url,
            path: SOCKET_OPTIONS.path,
            transports: SOCKET_OPTIONS.transports,
        });
        const socket = io(url, SOCKET_OPTIONS);
        let settled = false;

        const timeout = setTimeout(() => {
            if (!settled) {
                settled = true;
                socket.disconnect();
                socket.close();
                resolve(null);
            }
        }, CONNECTION_TIMEOUT_MS);

        socket.once('connect', () => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);

            console.log('[Offscreen] tryConnect connected', {
                url,
                socketId: socket.id,
            });
            resolve(socket);
        });

        socket.once('connect_error', (err: unknown) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            console.warn('[Offscreen] tryConnect connect_error', {
                url,
                error: err instanceof Error ? err.message : String(err),
            });
            socket.disconnect();
            socket.close();
            resolve(null);
        });

        socket.connect();
    });
}

function ensureSilentAudioKeepAlive(): void {
    if (silentAudioStarted) return;
    silentAudioStarted = true;

    try {
        const audio = document.createElement('audio');
        audio.autoplay = true;
        audio.loop = true;
        audio.muted = true;
        audio.volume = 0;
        try {
            audio.setAttribute('playsinline', '');
        } catch {
            // ignore
        }
        audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';

        document.body.appendChild(audio);
        const p = audio.play();
        if (p && typeof (p as any).catch === 'function') {
            (p as any).catch(() => {
                // ignore
            });
        }
    } catch {
        // ignore
    }
}

async function initLocalSocket(): Promise<void> {
    ensureSilentAudioKeepAlive();

    console.log('[Offscreen] initLocalSocket', {
        url: SOCKET_URL,
        options: {
            path: SOCKET_OPTIONS.path,
            transports: SOCKET_OPTIONS.transports,
            timeout: SOCKET_OPTIONS.timeout,
            reconnection: SOCKET_OPTIONS.reconnection,
        },
    });

    const initial = await tryConnect(SOCKET_URL, true);
    currentConnection = {
        socket: initial ?? io(SOCKET_URL, SOCKET_OPTIONS),
        url: SOCKET_URL,
        isPrimary: true,
    };
    socket = currentConnection.socket;

    console.log('[Offscreen] Socket created', { url: currentConnection.url, connected: socket.connected });
    bindSocketForwarders(socket);

    if (socket.connected) {
        try {
            console.log('[Offscreen] Socket already connected; syncing status to SW', {
                url: currentConnection.url,
                socketId: socket.id,
            });
        } catch {}
        notifySw({ type: 'socket_status', connected: true, url: currentConnection.url });
        notifySw({ type: 'socket_event', event: 'connect', args: [] });
    }

    if (!socket.connected) {
        console.log('[Offscreen] Socket not connected, attempting connect');
        try {
            socket.connect();
        } catch (err) {
            console.error('[Offscreen] Socket connect failed', err);
        }
    } else {
        console.log('[Offscreen] Socket already connected');
    }
}

let socket: Socket;

function notifySw(message: Record<string, unknown> & { type: string }): void {
    try {
        chromeAny?.runtime?.sendMessage?.({
            ...message,
            __fromOffscreenInternal: true,
        });
    } catch {
        // ignore
    }
}

function bindSocketForwarders(sock: Socket): void {
    try {
        sock.on('connect', () => {
            console.log('[Offscreen] socket connect', {
                url: currentConnection?.url ?? '',
                socketId: sock.id,
            });
            notifySw({ type: 'socket_status', connected: true, url: currentConnection?.url ?? '' });
            notifySw({ type: 'socket_event', event: 'connect', args: [] });
        });
    } catch {}

    try {
        sock.on('disconnect', (...args: unknown[]) => {
            console.log('[Offscreen] socket disconnect', {
                url: currentConnection?.url ?? '',
                args,
            });
            notifySw({ type: 'socket_status', connected: false, url: currentConnection?.url ?? '' });
            notifySw({ type: 'socket_event', event: 'disconnect', args });
        });
    } catch {}

    try {
        sock.on('connect_error', (...args: unknown[]) => {
            const err = args?.[0] as any;
            console.warn('[Offscreen] socket connect_error', {
                url: currentConnection?.url ?? '',
                message: err?.message ?? String(err),
                description: err?.description,
                context: err?.context,
                type: err?.type,
            });
            notifySw({ type: 'socket_event', event: 'connect_error', args });
        });
    } catch {}

    try {
        (sock as any).onAny?.((event: string, ...args: unknown[]) => {
            if (event === 'connect' || event === 'disconnect' || event === 'connect_error') return;
            notifySw({ type: 'socket_event', event, args });
        });
    } catch {
        // ignore
    }
}

async function initConnectionFromMode(): Promise<void> {
    if (initInFlight) return await initInFlight;
    initInFlight = initLocalSocket().finally(() => {
        initInFlight = null;
    });
    return await initInFlight;
}

chrome.runtime.onMessage.addListener((message: any, _sender, sendResponse) => {
    if (!message || typeof message !== 'object') return false;
    if (message.__fromSwInternal !== true) return false;

    if (message.type === 'socket_connect') {
        try {
            if (!currentConnection?.socket) {
                void initConnectionFromMode().then(
                    () => {
                        try {
                            sendResponse({ status: 'ok' } as any);
                        } catch {
                            // ignore
                        }
                    },
                    (err: any) => {
                        try {
                            sendResponse(
                                { status: 'error', error: err instanceof Error ? err.message : String(err) } as any,
                            );
                        } catch {
                            // ignore
                        }
                    },
                );
                return true;
            }
            try {
                currentConnection.socket.connect();
            } catch {
                // ignore
            }
            try {
                sendResponse({ status: 'ok' } as any);
            } catch {
                // ignore
            }
        } catch (err) {
            try {
                sendResponse({ status: 'error', error: err instanceof Error ? err.message : String(err) } as any);
            } catch {
                // ignore
            }
        }
        return true;
    }

    if (message.type === 'socket_emit' && typeof message.event === 'string') {
        const event = message.event as string;
        const args: unknown[] = Array.isArray(message.args) ? message.args : [];
        const expectAck = message.expectAck === true;

        if (!currentConnection?.socket) {
            try {
                sendResponse({ status: 'error', error: 'socket not initialized' } as any);
            } catch {
                // ignore
            }
            return true;
        }

        try {
            if (!currentConnection.socket.connected) {
                try {
                    currentConnection.socket.connect();
                } catch {
                    // ignore
                }
            }

            if (expectAck) {
                currentConnection.socket.emit(event, ...args, (...ack: unknown[]) => {
                    try {
                        sendResponse({ status: 'ok', ack } as any);
                    } catch {
                        // ignore
                    }
                });
                return true;
            }

            currentConnection.socket.emit(event, ...args);
            try {
                sendResponse({ status: 'ok' } as any);
            } catch {
                // ignore
            }
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

    return false;
});

console.log('[Offscreen] Script loaded', {
    hasChromeGlobal: typeof chrome !== 'undefined',
    hasChromeRuntime: typeof (globalThis as any)?.chrome?.runtime !== 'undefined',
    runtimeId: (globalThis as any)?.chrome?.runtime?.id,
    documentReadyState: document.readyState,
});

const tryInit = () => {
    console.log('[Offscreen] Attempting init', {
        hasChromeGlobal: typeof chrome !== 'undefined',
        hasChromeRuntime: typeof (globalThis as any)?.chrome?.runtime !== 'undefined',
        runtimeId: (globalThis as any)?.chrome?.runtime?.id,
        hasExtensionApis: hasExtensionApis(),
    });

    if (hasExtensionApis()) {
        console.log('[Offscreen] Starting initialization');
        (async () => {
            console.log('[Offscreen] Calling initConnectionFromMode');
            await initConnectionFromMode();
            console.log('[Offscreen] Init completed');
        })().catch(err => {
            console.error('[Offscreen] Init failed', err);
            log('error', 'Failed to init offscreen', { err: err instanceof Error ? err.message : String(err) });
        });
    } else {
        console.warn('[Offscreen] Extension APIs not available, will retry');
        setTimeout(tryInit, 100);
    }
};

if (document.readyState === 'loading') {
    console.log('[Offscreen] Waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[Offscreen] DOMContentLoaded fired');
        tryInit();
    });
} else {
    console.log('[Offscreen] Document already ready');
    tryInit();
}

setInterval(() => {
    const sock = currentConnection?.socket;
    if (!sock) return;

    if (!sock.connected) {
        try {
            sock.connect();
        } catch {
            // ignore
        }
        return;
    }

    const now = Date.now();
    if (now - lastHeartbeatAtMs >= 25_000) {
        lastHeartbeatAtMs = now;
        try {
            sock.emit('extension_heartbeat', { timestamp: now });
        } catch {
            // ignore
        }
    }
}, 30_000);
