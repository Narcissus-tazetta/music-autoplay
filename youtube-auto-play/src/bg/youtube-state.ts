import { EXTENSION_NAMESPACE } from '../constants';
import { addExtensionTab, isExtensionOpenedTab } from './tab-manager';
import type { ExtensionGlobal, MessageSender, SocketInstance } from './types';
import { sendTabMessage } from './utils';

interface YouTubeVideoStateMessage {
    type: 'youtube_video_state';
    state: string;
    url: string;
}

export function handleYouTubeVideoState(
    message: YouTubeVideoStateMessage,
    sender: MessageSender,
    socket: SocketInstance,
): void {
    const g = (globalThis as unknown as Record<string, ExtensionGlobal>)[EXTENSION_NAMESPACE];
    const tabId = sender?.tab?.id;

    if (!g?.isExtensionEnabled?.() || !sender?.tab || !isExtensionOpenedTab(sender.tab.id)) {
        console.info('[Background] handleYouTubeVideoState ignored', {
            state: message.state,
            url: message.url,
            tabId,
            reason: !g.isExtensionEnabled?.() ? 'extension_disabled' : 'not_extension_tab',
        });
        return;
    }

    console.info('[Background] handleYouTubeVideoState', {
        state: message.state,
        url: message.url,
        tabId,
    });

    if (socket.connected) socket.emit('youtube_video_state', { state: message.state, url: message.url });

    if (message.state === 'ended') handleVideoEnded(message.url, sender.tab.id, socket);
}

function isPlaylistUrl(url: string): boolean {
    try {
        return new URL(url).searchParams.has('list');
    } catch {
        return false;
    }
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

    if (socket.connected) socket.emit('video_ended', { url: currentUrl, tabId });
}

export function navigateToNextVideo(nextUrl: string, tabId: number): void {
    addExtensionTab(tabId);

    chrome.tabs.update(tabId, { url: nextUrl }, () => {
        if (hasChromeError()) console.error('[Background] Failed to navigate to next video', chrome.runtime.lastError);
    });

    chrome.storage.local.set({ latestUrl: nextUrl }, () => {
        if (hasChromeError()) console.error('[Background] Failed to save latestUrl', chrome.runtime.lastError);
    });
}

export function handleNoNextVideo(tabId: number): void {
    sendTabMessage(tabId, { type: 'show_video_end_alert' });
    chrome.storage.local.set({ latestUrl: 'ended' }, () => {
        if (hasChromeError()) console.error('[Background] Failed to save latestUrl as ended', chrome.runtime.lastError);
    });
}
