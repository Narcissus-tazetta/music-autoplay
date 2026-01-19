import { EXTENSION_NAMESPACE } from '../constants';
import {
    addExtensionTab,
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
            setActivePlaybackTab(tabId);
            shouldProcess = true;
            console.info('[Background] handleYouTubeVideoState promoted tab to activePlaybackTab', {
                tabId,
                state: message.state,
                url: message.url,
                reason: 'playing',
            });
        } else if (message.state === 'paused') {
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

    if (socket.connected) socket.emit('video_ended', { url: currentUrl, tabId });
}

export function navigateToNextVideo(nextUrl: string, tabId: number): void {
    try {
        console.info('[Background] navigateToNextVideo requested', { nextUrl, tabId });
    } catch {}

    addExtensionTab(tabId);
    sendTabMessage(tabId, { type: 'mark_extension_navigating' });

    chrome.tabs.update(tabId, { url: nextUrl }, () => {
        if (hasChromeError()) console.error('[Background] Failed to navigate to next video', chrome.runtime.lastError);
        else {
            try {
                console.info('[Background] navigateToNextVideo succeeded', { nextUrl, tabId });
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
    sendTabMessage(tabId, { type: 'show_video_end_alert' });
    chrome.storage.local.set({ latestUrl: 'ended' }, () => {
        if (hasChromeError()) console.error('[Background] Failed to save latestUrl as ended', chrome.runtime.lastError);
    });
}
