import { EXTENSION_NAMESPACE, TIMING, YOUTUBE_WATCH_URL_PATTERN } from '../constants';
import { addExtensionTab } from './tab-manager';
import type { ExtensionGlobal, SocketInstance, TabInfo } from './types';
import { findPlayingTab, sendTabMessage } from './utils';

const YOUTUBE_BASE_URL_PATTERN = '*://www.youtube.com/*';

export function setupShortcutCommands(socket: SocketInstance): void {
    chrome.commands.onCommand.addListener((command: string) => {
        const g = (globalThis as unknown as Record<string, ExtensionGlobal>)[EXTENSION_NAMESPACE];
        if (!g?.isExtensionEnabled?.()) return;

        switch (command) {
            case 'pause-youtube':
                handlePauseYouTube();
                break;
            case 'open-first-url':
                handleOpenFirstUrl(socket);
                break;
        }
    });
}

async function handlePauseYouTube(): Promise<void> {
    chrome.tabs.query({ url: YOUTUBE_WATCH_URL_PATTERN }, (tabs: TabInfo[]) => {
        if (!Array.isArray(tabs) || tabs.length === 0) return;
        void Promise.all(
            tabs
                .filter(t => t?.id !== undefined)
                .map(tab => sendTabMessage(tab.id, { type: 'toggle_play_pause' })),
        ).catch(err => {
            console.error('[handlePauseYouTube] Failed to toggle play/pause on tabs', err);
        });
    });
}

function handleOpenFirstUrl(socket: SocketInstance): void {
    // Request first URL from server
    if (!socket.connected) {
        console.warn('[handleOpenFirstUrl] Socket not connected, falling back to local storage');
        chrome.storage.local.get(['urlList'], result => {
            const urls = result.urlList || [];
            if (urls.length === 0 || !urls[0].url) return;
            openYouTubeUrlWithWait(urls[0].url);
        });
        return;
    }

    socket.emit('request_first_url', (response: unknown) => {
        if (!response || typeof response !== 'object') {
            console.warn('[handleOpenFirstUrl] Invalid response from server');
            return;
        }
        const { firstUrl } = response as { firstUrl?: string };
        if (typeof firstUrl === 'string') openYouTubeUrlWithWait(firstUrl);
    });
}

function openYouTubeUrlWithWait(targetUrl: string): void {
    chrome.tabs.query({ url: YOUTUBE_BASE_URL_PATTERN }, (ytabs: TabInfo[]) => {
        const ytIds = ytabs.map(t => t.id);

        const openWithWait = () => {
            chrome.tabs.query({ url: YOUTUBE_WATCH_URL_PATTERN }, async (tabs: TabInfo[]) => {
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

    const onEnded = (msg: { type: string }, sender: { tab?: TabInfo }) => {
        if (msg.type === 'video_ended' && sender.tab?.id === playingTab.id && !handled) {
            handled = true;
            cleanup();
            createExtensionTab(targetUrl);
        }
    };

    chrome.tabs.onRemoved.addListener(onTabRemoved);
    chrome.runtime.onMessage.addListener(onEnded);

    sendTabMessage(playingTab.id, { type: 'wait_for_end' });
}
