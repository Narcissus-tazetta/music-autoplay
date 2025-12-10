import type { TabInfo } from './types';
import { isPlaylistUrl } from '../shared/utils';
export function extractYouTubeId(url: string | { url: string }): string | null {
    try {
        const urlString = typeof url === 'object' && url !== null && 'url' in url ? url.url : String(url);

        const shortMatch = urlString.match(/^https?:\/\/youtu\.be\/([\w-]{11})/);
        if (shortMatch?.[1]) return shortMatch[1];
        const urlObj = new URL(urlString);
        return urlObj.searchParams.get('v');
    } catch {
        return null;
    }
}

export async function isTabValid(tabId: number): Promise<boolean> {
    return new Promise(resolve => {
        chrome.tabs.query({}, tabs => {
            if (chrome.runtime.lastError) {
                resolve(false);
                return;
            }
            const tab = tabs.find(t => t.id === tabId);
            resolve(Boolean(tab && !tab.discarded));
        });
    });
}

export async function sendTabMessage<T = unknown>(
    tabId: number,
    message: Record<string, unknown>,
): Promise<T | null> {
    if (!(await isTabValid(tabId))) return null;

    return new Promise<T | null>(resolve => {
        try {
            chrome.tabs.sendMessage(tabId, message as never, (response: unknown) => {
                if (chrome.runtime.lastError) {
                    resolve(null);
                    return;
                }
                resolve(response as T);
            });
        } catch {
            resolve(null);
        }
    });
}

type VideoStateResponse = {
    state: string;
};

export async function findPlayingTab(tabs: TabInfo[]): Promise<TabInfo | null> {
    const responses = await Promise.allSettled(
        tabs.map(tab =>
            tab.id !== undefined
                ? sendTabMessage<VideoStateResponse>(tab.id, { type: 'get_video_state' })
                : Promise.resolve(null)
        ),
    );

    for (let i = 0; i < responses.length; i++) {
        const result = responses[i];
        if (result.status === 'fulfilled' && result.value?.state === 'playing') return tabs[i];
    }

    return null;
}

function findVideoElement(root: Document | ShadowRoot = document): HTMLVideoElement | null {
    const video = root.querySelector('video');
    if (video) return video;

    const elements = Array.from(root.querySelectorAll('*'));
    for (const el of elements) {
        const shadowRoot = (el as HTMLElement & { shadowRoot?: ShadowRoot }).shadowRoot;
        if (shadowRoot) {
            const shadowVideo = findVideoElement(shadowRoot);
            if (shadowVideo) return shadowVideo;
        }
    }

    const iframes = Array.from(root.querySelectorAll('iframe'));
    for (const iframe of iframes) {
        try {
            if (iframe.contentDocument) {
                const iframeVideo = findVideoElement(iframe.contentDocument);
                if (iframeVideo) return iframeVideo;
            }
        } catch {
            continue;
        }
    }

    return null;
}

export function playVideoInPage(): boolean {
    const video = findVideoElement();
    if (video) {
        video.play();
        return true;
    }
    return false;
}

export function pauseVideoInPage(): boolean {
    const video = findVideoElement();
    if (video) {
        video.pause();
        return true;
    }
    return false;
}
