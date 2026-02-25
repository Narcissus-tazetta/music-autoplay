import type { ChromeMessage } from '../types';
import type { SocketInstance, TabInfo, VideoData } from './types';
import { handleNoNextVideo, navigateToNextVideo } from './youtube-state';

type AdminYouTubeControlAction = 'toggle_play_pause' | 'prev' | 'next' | 'skip';

function _openTabAndSaveLatest(url: string): void {
    try {
        chrome.tabs.create({ url }, () => {
            try {
                chrome.storage.local.set({ latestUrl: url }, () => {});
            } catch {}
        });
    } catch {
        // ignore
    }
}

export function waitForVideoEnd(playingTab: TabInfo, nextUrl: string): void {
    if (!playingTab?.id) return;

    console.info('[socket-events] waitForVideoEnd registered', { tabId: playingTab.id, nextUrl });

    let handled = false;

    const cleanup = () => {
        try {
            chrome.tabs.onRemoved.removeListener(onTabRemoved);
        } catch {}
        try {
            chrome.runtime.onMessage.removeListener(onEnded);
        } catch {}
    };

    const onTabRemoved = (closedTabId: number) => {
        if (closedTabId === playingTab.id && !handled) {
            console.info('[socket-events] waitForVideoEnd detected tab removed', { closedTabId, nextUrl });
            handled = true;
            cleanup();
            _openTabAndSaveLatest(nextUrl);
        }
    };

    const onEnded = (msg: { type?: string; __senderTabId?: number }, sender: { tab?: TabInfo }) => {
        const senderTabId = typeof sender?.tab?.id === 'number'
            ? sender.tab.id
            : (typeof msg?.__senderTabId === 'number' ? msg.__senderTabId : undefined);
        if (msg?.type === 'video_ended' && senderTabId === playingTab.id && !handled) {
            console.info('[socket-events] waitForVideoEnd received video_ended', {
                senderTabId,
                nextUrl,
            });
            handled = true;
            cleanup();
            _openTabAndSaveLatest(nextUrl);
        }
    };

    try {
        chrome.tabs.onRemoved.addListener(onTabRemoved);
    } catch {}
    try {
        chrome.runtime.onMessage.addListener(onEnded);
    } catch {}
}

export function setupSocketEvents(socket: SocketInstance, getCurrentSocket?: () => SocketInstance | undefined): void {
    socket.on('connect', () => {
        try {
            const isActive = typeof getCurrentSocket === 'function' ? getCurrentSocket() === socket : true;
            console.info('[socket-events] socket connected', { isActive });
            if (isActive) socket.emit('request_url_list', () => {});
        } catch {
            // ignore
        }
    });

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

        const isActive = typeof getCurrentSocket === 'function' ? getCurrentSocket() === socket : 'no_getCurrent';
        console.info('[socket-events] url_list received', { length: list.length, isActive });
        if (isActive !== true) {
            console.info('[socket-events] url_list ignored (inactive socket)');
            return;
        }

        handleUrlList(list);
    });

    socket.on('next_video_navigate', (...args: unknown[]) => {
        const data = args[0] as { nextUrl: string; tabId: number };
        if (!data || typeof data.nextUrl !== 'string' || typeof data.tabId !== 'number') return;

        console.info('[socket-events] next_video_navigate received', { nextUrl: data.nextUrl, tabId: data.tabId });
        navigateToNextVideo(data.nextUrl, data.tabId);
    });

    socket.on('no_next_video', (...args: unknown[]) => {
        const data = args[0] as { tabId: number };
        if (!data || typeof data.tabId !== 'number') return;

        console.info('[socket-events] no_next_video received', { tabId: data.tabId });
        handleNoNextVideo(data.tabId);
    });

    socket.on('open_first_url', (...args: unknown[]) => {
        const data = args[0] as { firstUrl?: string };
        if (!data || typeof data.firstUrl !== 'string') return;

        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            if (tabs[0]) chrome.tabs.update(tabs[0].id, { url: data.firstUrl });
        });
    });

    socket.on('admin_youtube_control_command', (...args: unknown[]) => {
        const data = args[0] as { action?: unknown };
        if (!data || typeof data.action !== 'string') return;
        if (
            data.action !== 'toggle_play_pause' && data.action !== 'prev' && data.action !== 'next'
            && data.action !== 'skip'
        ) { return; }
        void handleAdminYouTubeControl(socket, data.action);
    });
}

async function handleAdminYouTubeControl(
    socket: SocketInstance,
    action: AdminYouTubeControlAction,
): Promise<void> {
    const tab = await findPlaybackTab();
    if (!tab || typeof tab.id !== 'number') return;

    if (action === 'toggle_play_pause') {
        await sendTabMessage(tab.id, { type: 'toggle_play_pause' });
        return;
    }

    const currentUrl = await getCurrentUrlFromTab(tab);
    if (!currentUrl) return;

    const urlList = await getStoredUrlList();
    if (urlList.length === 0) return;

    const currentIndex = findIndexByVideoId(urlList, currentUrl);
    if (currentIndex < 0) return;

    if (action === 'prev' || action === 'next') {
        const targetIndex = action === 'prev' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= urlList.length) return;
        await updateTabUrl(tab.id, urlList[targetIndex].url);
        return;
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= urlList.length) return;
    await updateTabUrl(tab.id, urlList[nextIndex].url);

    if (socket.connected) {
        try {
            socket.emit('delete_url', currentUrl);
        } catch {
            // ignore
        }
    }
}

function findPlaybackTab(): Promise<TabInfo | undefined> {
    return new Promise(resolve => {
        chrome.tabs.query({ active: true, currentWindow: true }, activeTabs => {
            const active = activeTabs?.[0] as TabInfo | undefined;
            if (active?.id && isYouTubeUrl(active.url)) {
                resolve(active);
                return;
            }

            chrome.tabs.query({ url: '*://*.youtube.com/*' }, tabs => {
                const first = (tabs || []).find(tab => typeof tab?.id === 'number') as TabInfo | undefined;
                resolve(first);
            });
        });
    });
}

function sendTabMessage(tabId: number, message: ChromeMessage): Promise<void> {
    return new Promise(resolve => {
        try {
            chrome.tabs.sendMessage(tabId, message, () => {
                resolve();
            });
        } catch {
            resolve();
        }
    });
}

function getCurrentUrlFromTab(tab: TabInfo): Promise<string | undefined> {
    if (!tab.id) return Promise.resolve(undefined);

    return new Promise(resolve => {
        try {
            chrome.tabs.sendMessage(tab.id, { type: 'get_current_url' }, response => {
                const url = response && typeof response.url === 'string' ? response.url : tab.url;
                resolve(typeof url === 'string' ? url : undefined);
            });
        } catch {
            resolve(typeof tab.url === 'string' ? tab.url : undefined);
        }
    });
}

function getStoredUrlList(): Promise<VideoData[]> {
    return new Promise(resolve => {
        chrome.storage.local.get(['urlList'], result => {
            const list = result?.urlList;
            if (!Array.isArray(list)) {
                resolve([]);
                return;
            }

            resolve(list.filter((item: unknown) => isValidVideoData(item)) as VideoData[]);
        });
    });
}

function updateTabUrl(tabId: number, url: string): Promise<void> {
    return new Promise(resolve => {
        chrome.tabs.update(tabId, { url }, () => {
            resolve();
        });
    });
}

function findIndexByVideoId(urlList: VideoData[], currentUrl: string): number {
    const currentVideoId = extractVideoId(currentUrl);
    if (!currentVideoId) return -1;
    return urlList.findIndex(item => extractVideoId(item.url) === currentVideoId);
}

function extractVideoId(url: string): string | null {
    try {
        const parsed = new URL(url);
        if (parsed.hostname.includes('youtu.be')) {
            const id = parsed.pathname.replace('/', '').trim();
            return id || null;
        }
        if (parsed.hostname.includes('youtube.com')) {
            const id = parsed.searchParams.get('v');
            return id && id.length > 0 ? id : null;
        }
        return null;
    } catch {
        return null;
    }
}

function isYouTubeUrl(url?: string): boolean {
    if (!url) return false;
    return url.includes('youtube.com/') || url.includes('youtu.be/');
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
        // ignore
    }
}

export function handleUrlList(list: VideoData[]): void {
    chrome.storage.local.get(
        ['latestUrl', 'urlList'],
        () => {
            chrome.storage.local.set({ urlList: list }, () => {
                console.info('[socket-events] handleUrlList saving urlList', { newLength: list.length });
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

                notifyPopup({ type: 'url_list', urls: list });
                console.info('[socket-events] handleUrlList processed', { newLength: list.length });
            });
        },
    );
}
