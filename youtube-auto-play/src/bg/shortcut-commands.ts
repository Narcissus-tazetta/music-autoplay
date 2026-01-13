import {
    EXTENSION_NAMESPACE,
    MESSAGE_TYPES,
    TIMING,
    YOUTUBE_SHORT_URL_PATTERN,
    YOUTUBE_URL_PATTERN,
} from '../constants';
import {
    addExtensionTab,
    getActiveExtensionTabId,
    getActivePlaybackTabId,
    getLastOpenedByExtensionTabId,
    setLastOpenedByExtensionTabId,
} from './tab-manager';
import type { ExtensionGlobal, SocketInstance, TabInfo } from './types';
import { findPlayingTab, sendTabMessage } from './utils';

let currentSocket: SocketInstance | null = null;
let commandListener: ((command: string) => void) | null = null;

const PAUSE_COMMAND_DEBOUNCE_MS = 300;
let lastPauseCommandAt = 0;
let pauseCommandInFlight = false;

export function setupShortcutCommands(socket: SocketInstance): void {
    currentSocket = socket;
    if (commandListener) return;

    commandListener = (command: string) => {
        const g = (globalThis as unknown as Record<string, ExtensionGlobal>)[EXTENSION_NAMESPACE];
        if (!g?.isExtensionEnabled?.()) return;

        handleShortcutCommand(command, currentSocket);
    };

    chrome.commands.onCommand.addListener(commandListener);
}

export function handleShortcutCommand(command: string, socket: SocketInstance | null): void {
    switch (command) {
        case 'pause-youtube':
            void handlePauseYouTube();
            break;
        case 'open-first-url':
            handleOpenFirstUrl(socket);
            break;
        case 'toggle-popup-hidden-ui':
            handleTogglePopupHiddenUI();
            break;
    }
}

function handleTogglePopupHiddenUI(): void {
    try {
        if ((chrome as any).action && typeof (chrome as any).action.openPopup === 'function') {
            try {
                const p = (chrome as any).action.openPopup();
                if (p && typeof p.then === 'function') p.catch(() => {});
            } catch {}
            setTimeout(() => {
                try {
                    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.TOGGLE_HIDDEN_UI } as any);
                } catch {}
            }, 150);
            return;
        }

        if ((chrome as any).sidePanel && typeof (chrome as any).sidePanel.open === 'function') {
            try {
                const p = (chrome as any).sidePanel.open();
                if (p && typeof p.then === 'function') p.catch(() => {});
            } catch {}
            setTimeout(() => {
                try {
                    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.TOGGLE_HIDDEN_UI } as any);
                } catch {}
            }, 150);
            return;
        }
        chrome.runtime.sendMessage({ type: MESSAGE_TYPES.TOGGLE_HIDDEN_UI } as any);
    } catch {
        try {
            chrome.runtime.sendMessage({ type: MESSAGE_TYPES.TOGGLE_HIDDEN_UI } as any);
        } catch {}
    }
}

async function handlePauseYouTube(): Promise<void> {
    const now = Date.now();
    if (now - lastPauseCommandAt < PAUSE_COMMAND_DEBOUNCE_MS) return;
    lastPauseCommandAt = now;
    if (pauseCommandInFlight) return;
    pauseCommandInFlight = true;

    try {
        const targetTabId = await resolvePauseTargetTabId();
        if (typeof targetTabId === 'number') {
            try {
                await sendTogglePlayPauseWithDebug(targetTabId, 'resolved_target');
            } catch (err) {
                console.error('[handlePauseYouTube] Failed to toggle play/pause on target tab', err);
            }
            return;
        }

        const tabs = await new Promise<TabInfo[]>(resolve => {
            chrome.tabs.query({ url: YOUTUBE_URL_PATTERN }, resolve);
        });
        if (!Array.isArray(tabs) || tabs.length === 0) return;

        const playingTab = await findPlayingTab(tabs);
        const target = playingTab ?? tabs.find(t => t?.id !== undefined);
        if (!target?.id) return;

        try {
            await sendTogglePlayPauseWithDebug(target.id, 'fallback_playing_or_first');
        } catch (err) {
            console.error('[handlePauseYouTube] Failed to toggle play/pause', err);
        }
    } finally {
        pauseCommandInFlight = false;
    }
}

function sendTogglePlayPauseWithDebug(tabId: number, reason: string): Promise<void> {
    return new Promise(resolve => {
        try {
            chrome.tabs.sendMessage(tabId, { type: 'toggle_play_pause' } as any, response => {
                const err = chrome.runtime.lastError?.message;
                if (err) console.warn('[pause-youtube] toggle_play_pause failed', { tabId, reason, err });
                else console.info('[pause-youtube] toggle_play_pause ok', { tabId, reason, response });
                resolve();
            });
        } catch (e) {
            console.error('[pause-youtube] toggle_play_pause threw', { tabId, reason, e });
            resolve();
        }
    });
}

async function resolvePauseTargetTabId(): Promise<number | null> {
    try {
        const audibleTabs = await new Promise<TabInfo[]>(resolve => {
            chrome.tabs.query({ url: YOUTUBE_URL_PATTERN, audible: true, currentWindow: true } as any, resolve);
        });
        const t = audibleTabs?.find(tab => typeof tab?.id === 'number');
        if (t?.id) return t.id;
    } catch {
        // ignore
    }

    const activePlayback = getActivePlaybackTabId();
    if (typeof activePlayback === 'number') return activePlayback;

    const lastOpened = getLastOpenedByExtensionTabId();
    if (typeof lastOpened === 'number') return lastOpened;

    const activeExt = getActiveExtensionTabId();
    if (typeof activeExt === 'number') return activeExt;

    try {
        const tabs = await new Promise<TabInfo[]>(resolve => {
            chrome.tabs.query({ url: YOUTUBE_URL_PATTERN }, resolve);
        });
        if (!Array.isArray(tabs) || tabs.length === 0) return null;
        const playingTab = await findPlayingTab(tabs);
        const target = playingTab ?? tabs.find(t => typeof t?.id === 'number');
        return typeof target?.id === 'number' ? target.id : null;
    } catch {
        try {
            const shortTabs = await new Promise<TabInfo[]>(resolve => {
                chrome.tabs.query({ url: YOUTUBE_SHORT_URL_PATTERN }, resolve);
            });
            const t = shortTabs?.find(tab => typeof tab?.id === 'number');
            return typeof t?.id === 'number' ? t.id : null;
        } catch {
            return null;
        }
    }
}

function handleOpenFirstUrl(socket: SocketInstance | null): void {
    console.info('[handleOpenFirstUrl] Invoked');

    const fallbackToLocal = () => {
        chrome.storage.local.get(['urlList'], result => {
            const urls = result.urlList || [];
            if (urls.length === 0 || !urls[0].url) return;
            openYouTubeUrlWithWait(urls[0].url);
        });
    };

    if (!socket?.connected) {
        console.warn('[handleOpenFirstUrl] Socket not connected, falling back to local storage');
        fallbackToLocal();
        return;
    }

    let responded = false;
    const timer = setTimeout(() => {
        if (!responded) {
            console.warn('[handleOpenFirstUrl] Server did not respond in time, falling back to local storage');
            fallbackToLocal();
        }
    }, 2000);

    try {
        socket.emit('request_first_url', (response: unknown) => {
            responded = true;
            clearTimeout(timer);

            if (!response || typeof response !== 'object') {
                console.warn('[handleOpenFirstUrl] Invalid response from server, falling back to local storage');
                fallbackToLocal();
                return;
            }

            const { firstUrl } = response as { firstUrl?: string };
            if (typeof firstUrl === 'string') openYouTubeUrlWithWait(firstUrl);
            else fallbackToLocal();
        });
    } catch (err) {
        clearTimeout(timer);
        console.error('[handleOpenFirstUrl] Error while requesting first URL from server', err);
        fallbackToLocal();
    }
}

function openYouTubeUrlWithWait(targetUrl: string): void {
    chrome.tabs.query({ url: YOUTUBE_URL_PATTERN }, (ytabs: TabInfo[]) => {
        const ytIds = ytabs.map(t => t.id);

        const openWithWait = () => {
            chrome.tabs.query({ url: YOUTUBE_URL_PATTERN }, async (tabs: TabInfo[]) => {
                if (tabs.length === 0) return createExtensionTab(targetUrl);
                const playingTab = await findPlayingTab(tabs);
                if (playingTab) waitForVideoEnd(playingTab, targetUrl);
                else createExtensionTab(targetUrl);
            });
        };

        if (ytIds.length > 0) {
            chrome.tabs.remove(ytIds, () => {
                if (chrome.runtime.lastError)
                    console.error('[openYouTubeUrlWithWait] Failed to remove tabs', chrome.runtime.lastError);
                openWithWait();
            });
        } else {
            openWithWait();
        }
    });
}

function createExtensionTab(url: string): void {
    chrome.tabs.create({ url }, (tab: TabInfo) => {
        if (chrome.runtime.lastError) {
            console.error('[createExtensionTab] Failed to create tab', chrome.runtime.lastError);
            return;
        }

        if (tab.id) {
            addExtensionTab(tab.id);
            setLastOpenedByExtensionTabId(tab.id);
            setTimeout(() => {
                sendTabMessage(tab.id!, { type: 'mark_extension_opened' });
            }, TIMING.MARK_EXTENSION_DELAY);
        }
    });
}

function waitForVideoEnd(playingTab: TabInfo, targetUrl: string): void {
    let handled = false;

    const cleanup = () => {
        chrome.tabs.onRemoved.removeListener(onTabRemoved);
        chrome.runtime.onMessage.removeListener(onEnded);
    };

    const onTabRemoved = (closedTabId: number) => {
        if (closedTabId === playingTab.id && !handled) {
            handled = true;
            cleanup();
            createExtensionTab(targetUrl);
        }
    };

    const onEnded = (msg: { type: string; __senderTabId?: number }, sender: { tab?: TabInfo }) => {
        const senderTabId = typeof sender?.tab?.id === 'number'
            ? sender.tab.id
            : (typeof msg?.__senderTabId === 'number' ? msg.__senderTabId : undefined);
        if (msg.type === 'video_ended' && senderTabId === playingTab.id && !handled) {
            handled = true;
            cleanup();
            createExtensionTab(targetUrl);
        }
    };

    chrome.tabs.onRemoved.addListener(onTabRemoved);
    chrome.runtime.onMessage.addListener(onEnded);

    sendTabMessage(playingTab.id, { type: 'wait_for_end' });
}
