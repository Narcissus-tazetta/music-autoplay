import { EXTENSION_NAMESPACE } from '../constants';
import {
    addExtensionTab,
    getActiveExtensionTabId,
    getActivePlaybackTabId,
    isActivePlaybackTab,
    isExtensionOpenedTab,
    setActiveExtensionTab,
    setActivePlaybackTab,
} from './tab-manager';
import type { ExtensionGlobal, MessageSender, SocketInstance } from './types';
import { isPlaylistUrl, sendTabMessage } from './utils';

interface YouTubeVideoStateMessage {
    type: 'youtube_video_state';
    state: string;
    url: string;
    currentTime?: number;
    duration?: number;
    timestamp?: number;
    isAdvertisement?: boolean;
    seq?: number;
    openedByExtension?: boolean;
}

const PAUSE_HOLD_MS = 3000;
const RESUME_EPSILON_SEC = 0.75;
const lastPausedByTabId = new Map<number, { at: number; seq?: number; currentTime?: number; url: string }>();

export function handleYouTubeVideoState(
    message: YouTubeVideoStateMessage,
    sender: MessageSender,
    socket: SocketInstance,
): void {
    const g = (globalThis as unknown as Record<string, ExtensionGlobal>)[EXTENSION_NAMESPACE];
    const tabId = typeof sender?.tab?.id === 'number'
        ? sender.tab.id
        : (typeof (message as any).__senderTabId === 'number' ? (message as any).__senderTabId : undefined);

    if (message.openedByExtension === true && typeof tabId === 'number') addExtensionTab(tabId);

    const extensionEnabled = !!g?.isExtensionEnabled?.();
    if (!extensionEnabled) {
        console.info('[Background] handleYouTubeVideoState ignored', {
            state: message.state,
            url: message.url,
            tabId,
            reason: 'extension_disabled',
        });
        return;
    }

    const isKnownTab = typeof tabId === 'number' && (isExtensionOpenedTab(tabId) || isActivePlaybackTab(tabId));
    let shouldProcess = isKnownTab;

    // Strong signals that should never be dropped:
    // - playing: always accept and promote the tab to active playback
    // - paused: accept if it's already active OR we don't have an active playback tab yet
    if (typeof tabId === 'number') {
        if (message.state === 'playing') {
            const recentPause = lastPausedByTabId.get(tabId);
            if (recentPause && Date.now() - recentPause.at <= PAUSE_HOLD_MS) {
                const hasSeq = typeof message.seq === 'number' && typeof recentPause.seq === 'number';
                const seqLooksStale = hasSeq ? (message.seq as number) <= (recentPause.seq as number) : true;
                const hasTime = typeof message.currentTime === 'number' && typeof recentPause.currentTime === 'number';
                const timeLooksStale = hasTime
                    ? (message.currentTime as number) <= (recentPause.currentTime as number) + RESUME_EPSILON_SEC
                    : true;
                if (recentPause.url === message.url && seqLooksStale && timeLooksStale) {
                    console.info('[Background] handleYouTubeVideoState ignored stale playing', {
                        currentTime: message.currentTime,
                        seq: message.seq,
                        tabId,
                        url: message.url,
                    });
                    return;
                }
            }
            lastPausedByTabId.delete(tabId);
            setActivePlaybackTab(tabId);
            shouldProcess = true;
            console.info('[Background] handleYouTubeVideoState promoted tab to activePlaybackTab', {
                tabId,
                state: message.state,
                url: message.url,
                reason: 'playing',
            });
        } else if (message.state === 'paused') {
            lastPausedByTabId.set(tabId, {
                at: Date.now(),
                seq: message.seq,
                currentTime: message.currentTime,
                url: message.url,
            });
            const activeId = getActivePlaybackTabId();
            if (activeId === null || activeId === tabId || isKnownTab) {
                if (activeId === null) setActivePlaybackTab(tabId);
                shouldProcess = true;
            }
        }
    }

    if (!shouldProcess) {
        console.info('[Background] handleYouTubeVideoState ignored', {
            state: message.state,
            url: message.url,
            tabId,
            reason: 'not_extension_tab',
        });
        return;
    }

    console.info('[Background] handleYouTubeVideoState', {
        state: message.state,
        url: message.url,
        tabId,
    });

    if (typeof tabId === 'number') {
        setActivePlaybackTab(tabId);
        setActiveExtensionTab(tabId);
    }

    if (socket.connected) {
        socket.emit('youtube_video_state', {
            state: message.state,
            url: message.url,
            currentTime: message.currentTime,
            duration: message.duration,
            timestamp: message.timestamp,
            isAdvertisement: message.isAdvertisement,
            seq: message.seq,
        });
    }

    if (message.state === 'ended' && typeof tabId === 'number') handleVideoEnded(message.url, tabId, socket);
}

function hasChromeError(): boolean {
    return !!chrome.runtime.lastError;
}

export function handleVideoEnded(currentUrl: string, tabId: number, socket: SocketInstance): void {
    if (isPlaylistUrl(currentUrl)) return;

    console.info('[Background] handleVideoEnded', {
        currentUrl,
        tabId,
        socketConnected: socket.connected,
    });

    if (!socket.connected) {
        chrome.storage.local.get(['urlList'], result => {
            const list = Array.isArray(result?.urlList) ? result.urlList : [];
            const idx = list.findIndex((v: any) => typeof v?.url === 'string' && v.url === currentUrl);
            const next = idx >= 0 && idx + 1 < list.length ? list[idx + 1]?.url : undefined;

            if (typeof next === 'string') {
                console.warn('[Background] handleVideoEnded fallback navigating (socket disconnected)', {
                    currentUrl,
                    next,
                    tabId,
                });
                navigateToNextVideo(next, tabId);
                return;
            }

            console.warn('[Background] handleVideoEnded fallback: no next video in local list', {
                currentUrl,
                tabId,
            });
            handleNoNextVideo(tabId);
        });
        return;
    }

    if (socket.connected) {
        socket.emit('video_ended', { url: currentUrl, tabId });
        socket.emit('video_next', { url: currentUrl, tabId });
    }
}

export function navigateToNextVideo(nextUrl: string, tabId: number): void {
    try {
        console.info('[Background] navigateToNextVideo requested', { nextUrl, tabId });
    } catch {}

    let targetTabId = tabId;
    if (tabId === -1) {
        const activePlayback = getActivePlaybackTabId();
        const activeExt = getActiveExtensionTabId();
        targetTabId = activePlayback ?? activeExt ?? -1;
        if (targetTabId === -1) {
            console.warn('[Background] navigateToNextVideo: no active tab found for tabId=-1');
            return;
        }
        console.info('[Background] navigateToNextVideo: resolved tabId=-1 to', { targetTabId });
    }

    addExtensionTab(targetTabId);
    sendTabMessage(targetTabId, { type: 'mark_extension_navigating' });

    chrome.tabs.update(targetTabId, { url: nextUrl }, () => {
        if (hasChromeError()) console.error('[Background] Failed to navigate to next video', chrome.runtime.lastError);
        else {
            try {
                console.info('[Background] navigateToNextVideo succeeded', { nextUrl, tabId: targetTabId });
            } catch {}
        }
    });

    chrome.storage.local.set({ latestUrl: nextUrl }, () => {
        if (hasChromeError()) console.error('[Background] Failed to save latestUrl', chrome.runtime.lastError);
        else {
            try {
                console.info('[Background] latestUrl saved on navigate', { nextUrl });
            } catch {}
        }
    });
}

export function handleNoNextVideo(tabId: number): void {
    let targetTabId = tabId;
    if (tabId === -1) {
        const activePlayback = getActivePlaybackTabId();
        const activeExt = getActiveExtensionTabId();
        targetTabId = activePlayback ?? activeExt ?? -1;
        if (targetTabId === -1) {
            console.warn('[Background] handleNoNextVideo: no active tab found for tabId=-1');
            chrome.storage.local.set({ latestUrl: 'ended' }, () => {
                if (hasChromeError())
                    console.error('[Background] Failed to save latestUrl as ended', chrome.runtime.lastError);
            });
            return;
        }
    }

    sendTabMessage(targetTabId, { type: 'show_video_end_alert' });
    chrome.storage.local.set({ latestUrl: 'ended' }, () => {
        if (hasChromeError()) console.error('[Background] Failed to save latestUrl as ended', chrome.runtime.lastError);
    });
}
