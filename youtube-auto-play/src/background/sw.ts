import { setupMasterToggleHandler } from '../bg/master-toggle';
import { setupMessageHandler } from '../bg/message-handler';
import { handleShortcutCommand } from '../bg/shortcut-commands';
import { setupSocketEvents } from '../bg/socket-events';
import { getActivePlaybackTabId, handleTabCreated, handleTabRemoved, handleTabUpdated } from '../bg/tab-manager';
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
    closeDocument?: () => Promise<void>;
};

type ChromeLike = typeof chrome & { offscreen?: OffscreenApiLike };
const chromeApi = chrome as ChromeLike;
const chromeAny = chrome as any;

const BROKER_URL = 'http://localhost:3000' as const;
const BROKER_EVENT_URL = `${BROKER_URL}/api/extension/event` as const;

const LEADER_RESPONSE_TIMEOUT_MS = 2500;

let leaderTabId: number | null = null;
let leaderBrokerConnected = false;
let leaderLastSeenAt = 0;

const playingTabIds = new Set<number>();
const offscreenHolds = new Map<string, number | null>();
let offscreenMaybeCloseTimer: number | null = null;

function holdOffscreen(reason: string, ttlMs?: number): void {
    void getFeatureFlagsCached().then(flags => {
        if (!flags.eventDrivenOffscreen) return;

        const expiresAt = typeof ttlMs === 'number' ? Date.now() + ttlMs : null;
        offscreenHolds.set(reason, expiresAt);
        if (offscreenMaybeCloseTimer !== null) {
            clearTimeout(offscreenMaybeCloseTimer);
            offscreenMaybeCloseTimer = null;
        }

        // Ensure offscreen + audio keepalive when we have any hold.
        void kickOffscreenConnection();
    });
}

function releaseOffscreenHold(reason: string): void {
    offscreenHolds.delete(reason);
    void scheduleMaybeCloseOffscreen('hold_released');
}

async function closeOffscreen(): Promise<void> {
    try {
        if (!(await hasOffscreenDocument())) return;
    } catch {
        // ignore
    }

    try {
        await sendToOffscreenRaw({ type: 'audio_disconnect', __fromSwInternal: true } as any);
    } catch {
        // ignore
    }

    try {
        await chromeApi.offscreen?.closeDocument?.();
        cachedHasOffscreen = null;
        markOffscreenNotReady('offscreen closed');
        try {
            pushOffscreenLifecycleLog({ when: Date.now(), type: 'closed' });
        } catch {}
    } catch {
        // ignore
    }
}

async function scheduleMaybeCloseOffscreen(trigger: string): Promise<void> {
    const flags = await getFeatureFlagsCached();
    if (!flags.eventDrivenOffscreen) return;

    if (offscreenMaybeCloseTimer !== null) {
        clearTimeout(offscreenMaybeCloseTimer);
        offscreenMaybeCloseTimer = null;
    }

    // Debounce close to avoid thrashing during rapid state changes.
    offscreenMaybeCloseTimer = setTimeout(() => {
        offscreenMaybeCloseTimer = null;
        void (async () => {
            const now = Date.now();
            for (const [key, expiresAt] of offscreenHolds.entries())
                if (expiresAt !== null && expiresAt <= now) offscreenHolds.delete(key);

            if (playingTabIds.size > 0) return;
            if (offscreenHolds.size > 0) return;
            if (flushQueueInFlight || queuedAckMessages.length > 0 || queuedNonAckByEvent.size > 0) return;

            try {
                pushOffscreenLifecycleLog({ when: Date.now(), type: 'maybe_close', trigger });
            } catch {}
            await closeOffscreen();
        })();
    }, 5000) as unknown as number;
}

type RequiredFeatureFlags = {
    brokerShadow: boolean;
    brokerActive: boolean;
    eventDrivenOffscreen: boolean;
    strictContentTimers: boolean;
};

const DEFAULT_FEATURE_FLAGS: RequiredFeatureFlags = {
    brokerShadow: false,
    brokerActive: false,
    eventDrivenOffscreen: true,
    strictContentTimers: false,
};

let cachedFeatureFlags: { value: RequiredFeatureFlags; atMs: number } | null = null;
const FEATURE_FLAGS_CACHE_TTL_MS = 5000;

async function getFeatureFlagsCached(): Promise<RequiredFeatureFlags> {
    const now = Date.now();
    if (cachedFeatureFlags && now - cachedFeatureFlags.atMs < FEATURE_FLAGS_CACHE_TTL_MS)
        return cachedFeatureFlags.value;

    const value = await new Promise<RequiredFeatureFlags>(resolve => {
        try {
            (chrome.storage.local as any).get(['extensionFeatureFlags'], (result: any) => {
                const raw = (result as any)?.extensionFeatureFlags;
                resolve({
                    ...DEFAULT_FEATURE_FLAGS,
                    ...(raw && typeof raw === 'object' ? raw : {}),
                });
            });
        } catch {
            resolve(DEFAULT_FEATURE_FLAGS);
        }
    });

    cachedFeatureFlags = { value, atMs: now };
    return value;
}

function shouldRecordMigrationDiag(flags: RequiredFeatureFlags): boolean {
    return !!(
        flags.brokerShadow
        || flags.brokerActive
        || flags.eventDrivenOffscreen
        || flags.strictContentTimers
    );
}

function pushMigrationDiag(entry: Record<string, unknown>): void {
    void getFeatureFlagsCached().then(flags => {
        if (!shouldRecordMigrationDiag(flags)) return;
        try {
            const key = 'migration_diag_logs';
            (chrome.storage.local as any).get({ [key]: [] }, (result: any) => {
                try {
                    const arr = Array.isArray(result?.[key]) ? result[key] : [];
                    arr.push(entry);
                    if (arr.length > 200) arr.splice(0, arr.length - 200);
                    try {
                        (chrome.storage.local as any).set({ [key]: arr }, () => {});
                    } catch {}
                } catch {}
            });
        } catch {}
    });
}

function markLeaderSeen(): void {
    leaderLastSeenAt = Date.now();
}

function clearLeader(reason: string): void {
    if (leaderTabId === null) return;
    const prev = leaderTabId;
    leaderTabId = null;
    leaderBrokerConnected = false;
    leaderLastSeenAt = 0;
    socketConnected = false;
    dispatchSocketEvent('disconnect', []);
    console.log('[SW] leader cleared', { reason, prev });
}

async function sendToLeader(message: any): Promise<any> {
    const targetId = leaderTabId;
    if (targetId === null) throw new Error('leader not set');

    return await new Promise<any>((resolve, reject) => {
        try {
            chrome.tabs.sendMessage(targetId, message, resp => {
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
}

async function connectLeaderBroker(): Promise<void> {
    if (leaderTabId === null) return;

    try {
        await Promise.race([
            sendToLeader({ type: 'leader_broker_connect', __fromSwInternal: true }),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('leader connect timeout')), LEADER_RESPONSE_TIMEOUT_MS)
            ),
        ]);
        markLeaderSeen();
    } catch (err) {
        clearLeader('connect failed');
        throw err;
    }
}

async function disconnectLeaderBroker(): Promise<void> {
    if (leaderTabId === null) return;
    try {
        await Promise.race([
            sendToLeader({ type: 'leader_broker_disconnect', __fromSwInternal: true }),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('leader disconnect timeout')), LEADER_RESPONSE_TIMEOUT_MS)
            ),
        ]);
    } catch (err) {
        console.warn('[SW] leader disconnect failed', err);
    }
}

async function queryYouTubeTabIds(): Promise<number[]> {
    const mainTabs = await new Promise<any[]>(resolve => {
        try {
            chrome.tabs.query({ url: '*://*.youtube.com/*' }, tabs => resolve(tabs || []));
        } catch {
            resolve([]);
        }
    });
    const shortTabs = await new Promise<any[]>(resolve => {
        try {
            chrome.tabs.query({ url: '*://youtu.be/*' }, tabs => resolve(tabs || []));
        } catch {
            resolve([]);
        }
    });

    return [...mainTabs, ...shortTabs]
        .map(t => t?.id)
        .filter((id): id is number => typeof id === 'number');
}

async function pickLeaderCandidate(): Promise<number | null> {
    const activePlayback = getActivePlaybackTabId();
    if (typeof activePlayback === 'number') return activePlayback;

    const tabIds = await queryYouTubeTabIds();
    return tabIds[0] ?? null;
}

async function ensureLeaderOrFallback(reason: string): Promise<void> {
    if (leaderTabId !== null) {
        void connectLeaderBroker().catch(() => {});
        return;
    }

    const candidate = await pickLeaderCandidate();
    if (typeof candidate === 'number') {
        leaderTabId = candidate;
        console.log('[SW] leader selected', { tabId: candidate, reason });
        void connectLeaderBroker().catch(() => {});
        return;
    }
}

async function disconnectActiveSocket(): Promise<void> {
    if (leaderTabId !== null) {
        await disconnectLeaderBroker();
        leaderBrokerConnected = false;
    }
}

async function postBrokerEvent(
    event: string,
    payload: unknown,
    expectAck: boolean,
): Promise<unknown> {
    const startedAt = Date.now();
    try {
        const resp = await fetch(BROKER_EVENT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, payload, expectAck }),
        });

        const durationMs = Date.now() - startedAt;
        if (!resp.ok) {
            pushMigrationDiag({
                ts: Date.now(),
                type: 'broker_event',
                event,
                expectAck,
                ok: false,
                status: resp.status,
                durationMs,
            });
            throw new Error(`broker request failed (${resp.status})`);
        }

        const json = await resp.json().catch(() => ({}));
        pushMigrationDiag({
            ts: Date.now(),
            type: 'broker_event',
            event,
            expectAck,
            ok: true,
            status: resp.status,
            durationMs,
        });
        return (json as { result?: unknown }).result ?? json;
    } catch (err) {
        const durationMs = Date.now() - startedAt;
        pushMigrationDiag({
            ts: Date.now(),
            type: 'broker_event',
            event,
            expectAck,
            ok: false,
            status: 'error',
            durationMs,
            error: err instanceof Error ? err.message : String(err),
        });
        throw err;
    }
}

function waitForOffscreenReady(timeoutMs: number): Promise<void> {
    return new Promise(resolve => {
        const start = Date.now();
        const tick = () => {
            if (offscreenReady || Date.now() - start >= timeoutMs) {
                resolve();
                return;
            }
            setTimeout(tick, 150);
        };
        tick();
    });
}

let ensureOffscreenInFlight: Promise<void> | null = null;
let cachedHasOffscreen: { value: boolean; atMs: number } | null = null;
let lastCreateAttemptAtMs = 0;

let minCreateIntervalMs = 1500;

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

function getTotalSocketHandlerCount(): number {
    let total = 0;
    for (const set of socketHandlers.values()) total += set.size;
    return total;
}

function swDiag(context?: string): void {
    try {
        const nonAckSize = queuedNonAckByEvent.size;
        const ackSize = queuedAckMessages.length;
        const handlerCount = getTotalSocketHandlerCount();
        console.info('[SW DIAG]', context ?? 'periodic', {
            handlerCount,
            nonAckSize,
            ackSize,
            flushQueueInFlight: !!flushQueueInFlight,
            offscreenReady,
            socketConnected,
            offscreenReadyAtMs,
            offscreenReadySocketId,
        });
    } catch (err) {
        console.warn('[SW DIAG] failed to collect diag', err);
    }
}

function markOffscreenNotReady(reason: string): void {
    if (!offscreenReady) return;
    offscreenReady = false;
    offscreenReadyAtMs = 0;
    offscreenReadySocketId = undefined;
    console.log('[SW] offscreen marked not ready', { reason });
}

function pushOffscreenLifecycleLog(entry: Record<string, unknown>): void {
    try {
        const key = 'offscreen_lifecycle_logs';
        (chrome.storage.local as any).get([key], (result: any) => {
            try {
                const arr = Array.isArray(result?.[key]) ? result[key] : [];
                arr.push(entry);
                // cap history to last 500 entries
                if (arr.length > 500) arr.splice(0, arr.length - 500);
                try {
                    (chrome.storage.local as any).set({ [key]: arr }, () => {});
                } catch {}
            } catch {}
        });
    } catch {}
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
        void ensureLeaderOrFallback('socketProxy.connect');
    },
    emit: (event: string, data?: unknown, callback?: any) => {
        const expectAck = typeof callback === 'function';
        void postBrokerEvent(event, data, expectAck)
            .then(result => {
                if (typeof callback === 'function') callback((result as any)?.response ?? result);
            })
            .catch(() => {
                if (typeof callback === 'function') callback(undefined);
            });
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
    get: () => (leaderTabId !== null ? leaderBrokerConnected : socketConnected),
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
            type: 'audio_connect',
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
        try {
            pushOffscreenLifecycleLog({
                when: Date.now(),
                type: 'enqueue_non_ack',
                event,
                queuedAtMs,
                queuedNonAckSize: queuedNonAckByEvent.size,
            });
        } catch {}
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
        try {
            pushOffscreenLifecycleLog({
                when: Date.now(),
                type: 'enqueue_ack',
                queuedAtMs,
                queuedAckSize: queuedAckMessages.length,
            });
        } catch {}
    });
}

async function flushOffscreenQueueIfReady(): Promise<void> {
    if (!offscreenReady) return;
    if (flushQueueInFlight) return await flushQueueInFlight;

    flushQueueInFlight = (async () => {
        try {
            pushOffscreenLifecycleLog({
                when: Date.now(),
                type: 'flush_start',
                nonAckSize: queuedNonAckByEvent.size,
                ackSize: queuedAckMessages.length,
            });
        } catch {}
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
        try {
            pushOffscreenLifecycleLog({
                when: Date.now(),
                type: 'flush_end',
                flushedNonAck: nonAckEntries.length,
                flushedAck: ackEntries.length,
            });
        } catch {}
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
        try {
            pushOffscreenLifecycleLog({ when: Date.now(), type: 'ensure_start' });
        } catch {}
        if (await hasOffscreenDocument()) return;

        const now = Date.now();
        if (now - lastCreateAttemptAtMs < minCreateIntervalMs) {
            try {
                pushOffscreenLifecycleLog({
                    when: Date.now(),
                    type: 'create_skipped_recent_attempt',
                    now,
                    lastCreateAttemptAtMs,
                    minCreateIntervalMs,
                });
            } catch {}
            return;
        }
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
                    justification: 'Use an offscreen document with silent audio to keep background playback alive.',
                });
                cachedHasOffscreen = { value: true, atMs: Date.now() };
                markOffscreenNotReady('offscreen created');
                console.log('[SW] Offscreen document created successfully', { url });
                try {
                    pushOffscreenLifecycleLog({ when: Date.now(), type: 'created', url });
                } catch {}
                return;
            } catch (err) {
                cachedHasOffscreen = null;
                console.warn('[SW] Failed to create offscreen with URL', { url, error: err });
                try {
                    pushOffscreenLifecycleLog({ when: Date.now(), type: 'create_failed', url, error: String(err) });
                } catch {}
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
    void getFeatureFlagsCached().then(flags => {
        if (flags.eventDrivenOffscreen) {
            console.log('[SW] eventDrivenOffscreen enabled: skip ensure on install');
            return;
        }
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
});

chromeAny.runtime?.onStartup?.addListener?.(() => {
    console.log('[SW] onStartup fired');
    void getFeatureFlagsCached().then(flags => {
        if (flags.eventDrivenOffscreen) {
            console.log('[SW] eventDrivenOffscreen enabled: skip ensure on startup');
            return;
        }
        void ensureOffscreen().then(
            () => console.log('[SW] Offscreen ensured on startup'),
            err => console.error('[SW] Failed to ensure offscreen on startup', err),
        );
        void kickOffscreenConnection();
    });
});

// Leader tab -> SW: socket events/status/ack dispatch
chrome.runtime.onMessage.addListener((message: any, sender: any, sendResponse?: (resp: any) => void) => {
    if (!message || typeof message !== 'object') return false;
    if (message.__fromLeaderInternal !== true) return false;

    const senderTabId = typeof sender?.tab?.id === 'number' ? sender.tab.id : undefined;
    if (typeof senderTabId === 'number') markLeaderSeen();

    if (message.type === 'leader_candidate' && typeof senderTabId === 'number') {
        const activePlayback = getActivePlaybackTabId();
        if (leaderTabId === null || activePlayback === senderTabId) {
            if (leaderTabId !== senderTabId) {
                leaderTabId = senderTabId;
                leaderBrokerConnected = false;
                console.log('[SW] leader candidate accepted', { tabId: senderTabId });
            }
            void connectLeaderBroker().catch(() => {});
        }
        if (typeof sendResponse === 'function') {
            try {
                sendResponse({ status: 'ok' });
            } catch {}
        }
        return true;
    }

    if (message.type === 'leader_broker_status' && typeof message.connected === 'boolean') {
        leaderBrokerConnected = message.connected;
        socketConnected = message.connected;
        dispatchSocketEvent(message.connected ? 'connect' : 'disconnect', []);
        return false;
    }

    if (message.type === 'leader_broker_event' && typeof message.event === 'string') {
        dispatchSocketEvent(message.event, Array.isArray(message.args) ? message.args : []);
        return false;
    }

    return false;
});

// Offscreen -> SW: socket events/status dispatch
chrome.runtime.onMessage.addListener((message: any, sender: any, sendResponse?: (resp: any) => void) => {
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

    if (message.type === 'offscreen_diag' && typeof message.diag === 'object') {
        try {
            try {
                pushOffscreenLifecycleLog({ when: Date.now(), type: 'offscreen_diag', diag: message.diag });
            } catch {}
            swDiag('received_offscreen_diag');
            console.info('[SW] received offscreen diag', { diag: message.diag });
        } catch (err) {
            console.warn('[SW] failed to handle offscreen_diag', err);
        }
        if (typeof sendResponse === 'function') {
            try {
                sendResponse({ status: 'ok' });
            } catch {}
        }
        return false;
    }

    if (message.type === 'offscreen_deep_diag' && typeof message.payload === 'object') {
        try {
            try {
                pushOffscreenLifecycleLog({ when: Date.now(), type: 'offscreen_deep_diag_received' });
            } catch {}
            (chrome.storage.local as any).get({ offscreen_deep_diag_samples: [] }, (result: any) => {
                try {
                    const arr = result?.offscreen_deep_diag_samples ?? [];
                    arr.push({ ts: Date.now(), deep: message.payload });
                    if (arr.length > 200) arr.shift();
                    try {
                        (chrome.storage.local as any).set({ offscreen_deep_diag_samples: arr });
                    } catch {}
                } catch {}
            });
            console.info('[SW] received offscreen deep diag (stored)', {
                shallow: Object.keys(message.payload || {}).slice(0, 10),
            });
        } catch (err) {
            console.warn('[SW] failed to handle offscreen_deep_diag', err);
        }
        if (typeof sendResponse === 'function') {
            try {
                sendResponse({ status: 'ok' });
            } catch {}
        }
        return false;
    }

    if (message.type === 'offscreen_mem_sample' && typeof message.payload === 'object') {
        try {
            try {
                pushOffscreenLifecycleLog({ when: Date.now(), type: 'offscreen_mem_sample_received' });
            } catch {}
            (chrome.storage.local as any).get({ offscreen_memory_samples: [] }, (result: any) => {
                try {
                    const arr = result?.offscreen_memory_samples ?? [];
                    arr.push({ ts: Date.now(), memory: message.payload });
                    if (arr.length > 500) arr.shift();
                    try {
                        (chrome.storage.local as any).set({ offscreen_memory_samples: arr });
                    } catch {}
                } catch {}
            });
            console.info('[SW] received offscreen mem sample (stored)', { memory: message.payload });
        } catch (err) {
            console.warn('[SW] failed to handle offscreen_mem_sample', err);
        }
        if (typeof sendResponse === 'function') {
            try {
                sendResponse({ status: 'ok' });
            } catch {}
        }
        return false;
    }

    if (message.type === 'offscreen_lifecycle' && typeof message.event === 'string') {
        try {
            try {
                pushOffscreenLifecycleLog({
                    when: Date.now(),
                    type: 'offscreen_lifecycle',
                    event: message.event,
                    data: message.data ?? null,
                });
            } catch {}
            console.info('[SW] offscreen lifecycle', { event: message.event, data: message.data ?? null });
        } catch (err) {
            console.warn('[SW] failed to handle offscreen_lifecycle', err);
        }
        if (typeof sendResponse === 'function') {
            try {
                sendResponse({ status: 'ok' });
            } catch {}
        }
        return false;
    }

    return false;
});

chromeAny.alarms?.onAlarm?.addListener?.((alarm: any) => {
    if (alarm.name !== ENSURE_OFFSCREEN_ALARM) return;
    void getFeatureFlagsCached().then(flags => {
        if (flags.eventDrivenOffscreen) return;
        void ensureOffscreen();
    });
});

// Expose a small debug API in the SW for interactive diagnostics in DevTools
try {
    (globalThis as any).__swDiag = {
        ensureOffscreen: async () => {
            try {
                await ensureOffscreen();
                return { status: 'ok' };
            } catch (e) {
                return { status: 'error', error: String(e) };
            }
        },
        sendToOffscreen: async (msg: any, opts?: any) => {
            try {
                const res = await sendToOffscreen(msg, opts ?? { expectResponse: true });
                return { status: 'ok', resp: res };
            } catch (e) {
                return { status: 'error', error: String(e) };
            }
        },
        getState: () => ({
            offscreenReady,
            offscreenReadyAtMs,
            lastCreateAttemptAtMs,
            minCreateIntervalMs,
            cachedHasOffscreen: !!cachedHasOffscreen,
            queuedNonAckByEvent: queuedNonAckByEvent.size,
            queuedAckMessages: queuedAckMessages.length,
            socketConnected,
            flushQueueInFlight: !!flushQueueInFlight,
            leaderTabId,
            leaderBrokerConnected,
            leaderLastSeenAt,
        }),
    };
} catch {}

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
        if (leaderTabId === tabId) {
            clearLeader('tab removed');
            void ensureLeaderOrFallback('leader_removed');
        }

        try {
            if (playingTabIds.has(tabId)) {
                playingTabIds.delete(tabId);
                if (playingTabIds.size === 0) void scheduleMaybeCloseOffscreen('tab_removed');
            }
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
    holdOffscreen('shortcut_command', 15000);
    try {
        handleShortcutCommand(command, socketProxy);
    } catch (err) {
        console.error('[SW] Command handler failed; falling back', err);
        void handleShortcutFallback(command);
    }
});

// Side-effect only: offscreen lifecycle control (feature-flagged)
chrome.runtime.onMessage.addListener((message: any, sender: any) => {
    if (!message || typeof message !== 'object') return false;
    if (message.__fromSwInternal === true) return false;
    if (message.__fromLeaderInternal === true) return false;
    if (message.__fromOffscreenInternal === true) return false;

    const type = message.type as string | undefined;
    const senderTabId = typeof sender?.tab?.id === 'number' ? sender.tab.id : undefined;

    if (type === 'youtube_video_state' && typeof senderTabId === 'number') {
        const state = typeof message.state === 'string' ? message.state : '';
        if (state === 'playing') {
            playingTabIds.add(senderTabId);
            holdOffscreen('youtube_playing');
        } else if (state === 'paused' || state === 'ended') {
            playingTabIds.delete(senderTabId);
            if (playingTabIds.size === 0) releaseOffscreenHold('youtube_playing');
        }
        return false;
    }

    // Popup/shortcut/button actions: short-lived hold to avoid thrash
    const userActionTypes = new Set([
        'delete_url',
        'move_prev_video',
        'move_next_video',
        'wait_for_end',
        'toggle_play_pause',
        'pause_video',
        'yt_play',
        'yt_pause',
        'request_url_list',
        'reconnect_socket',
    ]);
    if (type && userActionTypes.has(type)) {
        holdOffscreen('user_action', 15000);
        return false;
    }

    return false;
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
try {
    void ensureLeaderOrFallback('startup');
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
    if ((message as any).__fromLeaderInternal === true) return false;

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

    if ((message as any).type === 'disconnect_socket') {
        void disconnectActiveSocket().then(
            () => sendResponse({ status: 'ok' }),
            err => sendResponse({ status: 'error', error: err instanceof Error ? err.message : String(err) }),
        );
        return true;
    }

    // Debug / control handlers
    if ((message as any).type === 'force_offscreen_create') {
        void ensureOffscreen().then(
            () => sendResponse({ status: 'ok' }),
            err => sendResponse({ status: 'error', error: err instanceof Error ? err.message : String(err) }),
        );
        return true;
    }

    if ((message as any).type === 'get_offscreen_backoff_state') {
        try {
            sendResponse({
                status: 'ok',
                lastCreateAttemptAtMs,
                minCreateIntervalMs,
                offscreenReady,
                offscreenReadyAtMs,
            } as any);
        } catch (err) {
            try {
                sendResponse({ status: 'error', error: String(err) } as any);
            } catch {}
        }
        return true;
    }

    if ((message as any).type === 'get_offscreen_lifecycle_logs') {
        try {
            (chrome.storage.local as any).get(['offscreen_lifecycle_logs'], (result: any) => {
                try {
                    sendResponse({ status: 'ok', logs: result?.offscreen_lifecycle_logs ?? [] } as any);
                } catch (err) {
                    try {
                        sendResponse({ status: 'error', error: String(err) } as any);
                    } catch {}
                }
            });
        } catch (err) {
            try {
                sendResponse({ status: 'error', error: String(err) } as any);
            } catch {}
        }
        return true;
    }

    if ((message as any).type === 'request_offscreen_diag') {
        // ensure offscreen is created and ready, then request diag; fall back to stored samples if unreachable
        (async () => {
            try {
                await ensureOffscreen();
                // wait briefly for offscreen to finish init and mark ready
                let resp: any = null;
                await waitForOffscreenReady(5000);

                try {
                    resp = await sendToOffscreen({ type: 'collect_diag', __fromSwInternal: true }, {
                        expectResponse: true,
                    });
                    try {
                        sendResponse({ status: 'ok', diag: resp?.diag ?? resp } as any);
                    } catch {}
                    return;
                } catch (err) {
                    try {
                        pushOffscreenLifecycleLog({
                            when: Date.now(),
                            type: 'request_offscreen_diag_failed',
                            error: String(err),
                        });
                    } catch {}
                }
            } catch (err) {
                try {
                    pushOffscreenLifecycleLog({
                        when: Date.now(),
                        type: 'request_offscreen_diag_failed',
                        error: String(err),
                    });
                } catch {}
            }

            // fallback: read most recent stored sample
            try {
                (chrome.storage.local as any).get(['offscreen_diag_samples'], (result: any) => {
                    try {
                        const arr = result?.offscreen_diag_samples ?? [];
                        const last = arr.length ? arr[arr.length - 1].diag : null;
                        if (last) {
                            try {
                                sendResponse({ status: 'ok', diag: last, fallback: true } as any);
                            } catch {}
                        } else {
                            try {
                                sendResponse({ status: 'error', error: 'no persisted diag samples available' } as any);
                            } catch {}
                        }
                    } catch (e2) {
                        try {
                            sendResponse({ status: 'error', error: String(e2) } as any);
                        } catch {}
                    }
                });
            } catch (e3) {
                try {
                    sendResponse({ status: 'error', error: String(e3) } as any);
                } catch {}
            }
        })();
        return true;
    }

    if ((message as any).type === 'request_offscreen_deep_diag') {
        (async () => {
            try {
                await ensureOffscreen();
                await waitForOffscreenReady(5000);

                try {
                    const resp = await sendToOffscreen({ type: 'collect_deep_diag', __fromSwInternal: true }, {
                        expectResponse: true,
                    });
                    try {
                        sendResponse({ status: 'ok', deep: resp?.deep ?? resp } as any);
                    } catch {}
                    return;
                } catch (err) {
                    try {
                        pushOffscreenLifecycleLog({
                            when: Date.now(),
                            type: 'request_offscreen_deep_diag_failed',
                            error: String(err),
                        });
                    } catch {}
                }
            } catch (err) {
                try {
                    pushOffscreenLifecycleLog({
                        when: Date.now(),
                        type: 'request_offscreen_deep_diag_failed',
                        error: String(err),
                    });
                } catch {}
            }

            // fallback to stored deep samples
            try {
                (chrome.storage.local as any).get(['offscreen_deep_diag_samples'], (result: any) => {
                    try {
                        const arr = result?.offscreen_deep_diag_samples ?? [];
                        const last = arr.length ? arr[arr.length - 1].deep : null;
                        if (last) {
                            try {
                                sendResponse({ status: 'ok', deep: last, fallback: true } as any);
                            } catch {}
                        } else {
                            try {
                                sendResponse(
                                    { status: 'error', error: 'no persisted deep diag samples available' } as any,
                                );
                            } catch {}
                        }
                    } catch (e2) {
                        try {
                            sendResponse({ status: 'error', error: String(e2) } as any);
                        } catch {}
                    }
                });
            } catch (e3) {
                try {
                    sendResponse({ status: 'error', error: String(e3) } as any);
                } catch {}
            }
        })();
        return true;
    }

    if ((message as any).type === 'set_min_create_interval_ms' && typeof (message as any).ms === 'number') {
        try {
            minCreateIntervalMs = Math.max(0, Math.floor((message as any).ms));
            try {
                sendResponse({ status: 'ok', minCreateIntervalMs } as any);
            } catch {}
        } catch (e) {
            try {
                sendResponse({ status: 'error', error: String(e) } as any);
            } catch {}
        }
        return true;
    }

    return false;
});
