import { EXTENSION_NAMESPACE, TIMING, YOUTUBE_WATCH_URL_PATTERN } from '../constants';
import { addExtensionTab } from './tab-manager';
import type { ExtensionGlobal, SocketInstance, TabInfo, VideoData } from './types';
import { findPlayingTab, isPlaylistUrl, sendTabMessage } from './utils';
import { handleNoNextVideo, navigateToNextVideo } from './youtube-state';

const YOUTUBE_BASE_URL_PATTERN = '*://www.youtube.com/*';

export function setupSocketEvents(socket: SocketInstance): void {
    socket.on('connect', () => {});

    socket.on('disconnect', (...args: unknown[]) => {
        const reason = args[0] as string;
        notifyPopup({ type: 'socket_disconnected', reason });
    });

    socket.on('connect_error', (...args: unknown[]) => {
        const err = args[0] as Error;
        notifyPopup({ type: 'socket_error', error: err?.message || String(err) });
    });

    socket.on('new_url', (...args: unknown[]) => {
        const videoData = args[0] as VideoData;
        if (!isValidVideoData(videoData)) return;

        chrome.storage.local.set({ latestUrl: videoData.url }, () => {
            if (chrome.runtime.lastError) {
                console.error('[setupSocketEvents] Failed to save latestUrl', chrome.runtime.lastError);
                return;
            }
            notifyPopup({ type: 'url_updated', url: videoData.url });
        });
    });

    socket.on('url_list', (...args: unknown[]) => {
        const list = args[0] as VideoData[];
        if (!Array.isArray(list) || !list.every(isValidVideoData)) return;

        handleUrlList(list);
    });

    socket.on('next_video_navigate', (...args: unknown[]) => {
        const data = args[0] as { nextUrl: string; tabId: number };
        if (!data || typeof data.nextUrl !== 'string' || typeof data.tabId !== 'number') return;

        navigateToNextVideo(data.nextUrl, data.tabId);
    });

    socket.on('no_next_video', (...args: unknown[]) => {
        const data = args[0] as { tabId: number };
        if (!data || typeof data.tabId !== 'number') return;

        handleNoNextVideo(data.tabId);
    });
}

function isValidVideoData(data: unknown): data is VideoData {
    if (!data || typeof data !== 'object') return false;

    const video = data as VideoData;
    return (
        typeof video.url === 'string'
        && (video.url.startsWith('http://') || video.url.startsWith('https://'))
    );
}

function notifyPopup(message: Record<string, unknown> & { type: string }): void {
    try {
        chrome.runtime.sendMessage(message as never, () => {
            if (chrome.runtime.lastError) return;
        });
    } catch {
        // popupが開かれていない場合は無視
    }
}

function handleUrlList(list: VideoData[]): void {
    chrome.storage.local.get(
        ['latestUrl', 'manualAutoPlayEnabled', 'autoPlayEnabled', 'urlList'],
        result => {
            const prevList = Array.isArray(result.urlList) ? result.urlList : [];

            chrome.storage.local.set({ urlList: list }, () => {
                if (chrome.runtime.lastError) {
                    console.error('[handleUrlList] Failed to save urlList', chrome.runtime.lastError);
                    return;
                }

                if (list.length === 0) {
                    chrome.storage.local.set({ latestUrl: 'ended' }, () => {
                        if (chrome.runtime.lastError) {
                            console.error(
                                '[handleUrlList] Failed to save latestUrl as ended',
                                chrome.runtime.lastError,
                            );
                        }
                    });
                }

                const shouldAutoPlay = result.manualAutoPlayEnabled
                    && result.autoPlayEnabled
                    && prevList.length === 0
                    && (!result.latestUrl || result.latestUrl === 'ended');

                if (shouldAutoPlay && list.length > 0) {
                    const g = (globalThis as unknown as Record<string, ExtensionGlobal>)[EXTENSION_NAMESPACE];
                    if (g?.isExtensionEnabled?.()) checkAndOpenUrl(list[0].url);
                }

                notifyPopup({ type: 'url_list', urls: list });
            });
        },
    );
}

function checkAndOpenUrl(firstUrl: string): void {
    chrome.tabs.query({ url: YOUTUBE_WATCH_URL_PATTERN }, async (tabs: TabInfo[]) => {
        if (chrome.runtime.lastError) {
            console.error('[checkAndOpenUrl] Failed to query tabs', chrome.runtime.lastError);
            return;
        }

        if (tabs.length === 0) {
            openNewTab(firstUrl);
            return;
        }

        const playingTab = await findPlayingTab(tabs);
        if (playingTab) waitForVideoEnd(playingTab, firstUrl);
        else openNewTab(firstUrl);
    });
}

let isTabCreationInProgress = false;

function openNewTab(url: string): void {
    if (isTabCreationInProgress) return;
    isTabCreationInProgress = true;

    const resetFlag = () => {
        isTabCreationInProgress = false;
    };

    chrome.tabs.query({ url: YOUTUBE_BASE_URL_PATTERN }, (ytabs: TabInfo[]) => {
        if (chrome.runtime.lastError) {
            resetFlag();
            return;
        }

        const ytIds = ytabs.map(t => t.id).filter((id): id is number => id !== undefined);

        const createTab = () => {
            chrome.tabs.create({ url }, (tab: TabInfo) => {
                if (chrome.runtime.lastError) {
                    resetFlag();
                    return;
                }

                if (tab.id) {
                    addExtensionTab(tab.id);
                    setTimeout(() => {
                        sendTabMessage(tab.id!, { type: 'mark_extension_opened' });
                    }, TIMING.TAB_CREATION_DELAY);
                }
                chrome.storage.local.set({ latestUrl: url }, () => {
                    if (chrome.runtime.lastError)
                        console.error('[openNewTab] Failed to save latestUrl', chrome.runtime.lastError);
                });
                resetFlag();
            });
        };

        if (ytIds.length > 0) {
            chrome.tabs.remove(ytIds, () => {
                if (chrome.runtime.lastError) {
                    resetFlag();
                    return;
                }
                createTab();
            });
        } else {
            createTab();
        }
    });
}

export function waitForVideoEnd(playingTab: TabInfo, nextUrl: string): void {
    if (!playingTab.id) return;
    if (playingTab.url && isPlaylistUrl(playingTab.url)) return;

    let handled = false;
    const playingTabId = playingTab.id;
    const WAIT_TIMEOUT = 10 * 60 * 1000;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        chrome.tabs.onRemoved.removeListener(onTabRemoved);
        chrome.runtime.onMessage.removeListener(onEnded);
    };

    timeoutId = setTimeout(() => {
        if (!handled) {
            handled = true;
            cleanup();
        }
    }, WAIT_TIMEOUT);

    const onTabRemoved = (closedTabId: number) => {
        if (closedTabId === playingTabId && !handled) {
            handled = true;
            cleanup();
            if (!(playingTab.url && isPlaylistUrl(playingTab.url))) {
                pauseOtherTabs(playingTabId);
                openNewTab(nextUrl);
            }
        }
    };

    const onEnded = (msg: { type: string }, sender: { tab?: TabInfo }) => {
        if (msg.type === 'video_ended' && sender.tab?.id === playingTabId && !handled) {
            handled = true;
            cleanup();
            if (!(sender.tab?.url && isPlaylistUrl(sender.tab.url))) {
                pauseOtherTabs(playingTabId);
                openNewTab(nextUrl);
            }
        }
    };

    chrome.tabs.onRemoved.addListener(onTabRemoved);
    chrome.runtime.onMessage.addListener(onEnded);

    sendTabMessage(playingTabId, { type: 'wait_for_end' });
}

async function pauseOtherTabs(excludeTabId: number): Promise<void> {
    chrome.tabs.query({ url: YOUTUBE_WATCH_URL_PATTERN }, (tabs: TabInfo[]) => {
        if (chrome.runtime.lastError) {
            console.error('[pauseOtherTabs] Failed to query tabs', chrome.runtime.lastError);
            return;
        }

        const tasks = tabs
            .filter(t => t.id !== undefined && t.id !== excludeTabId)
            .map(t => sendTabMessage(t.id, { type: 'force_pause' }));

        void Promise.all(tasks).catch(err => {
            console.error('[pauseOtherTabs] Error while forcing pause on other tabs', err);
        });
    });
}
