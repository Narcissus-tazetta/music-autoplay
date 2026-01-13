import type { SocketInstance, TabInfo, VideoData } from './types';
import { handleNoNextVideo, navigateToNextVideo } from './youtube-state';

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
