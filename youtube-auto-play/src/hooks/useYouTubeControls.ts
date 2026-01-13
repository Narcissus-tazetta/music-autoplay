import { useCallback } from 'react';
import { YOUTUBE_URL_PATTERN } from '../constants';
import type { ControlName, UrlItem } from '../types';
import { findYouTubeTabs, sendChromeMessage, sendTabMessage } from '../utils/chrome';
import { extractYouTubeId } from '../utils/youtube';

interface UseYouTubeControlsReturn {
    handleControl: (name: ControlName) => Promise<void>;
    openFirstUrl: (urls: UrlItem[]) => void;
    openUrl: (url: string) => void;
}

export function useYouTubeControls(urls: UrlItem[]): UseYouTubeControlsReturn {
    const handleControl = useCallback(
        async (name: ControlName) => {
            try {
                const tabIds = await findYouTubeTabs();
                if (tabIds.length === 0) return;

                const tabId = tabIds[0];
                const response = await sendTabMessage(tabId, { type: 'get_current_url' });
                if (!response?.url) return;

                const currentUrl = response.url;
                const currentIdx = urls.findIndex(
                    u => extractYouTubeId(u.url) === extractYouTubeId(currentUrl),
                );

                switch (name) {
                    case 'skip': {
                        const nextIdx = currentIdx + 1;
                        if (currentIdx >= 0 && nextIdx < urls.length) {
                            chrome.tabs.update(tabId, { url: urls[nextIdx].url });
                            await sendChromeMessage({ type: 'delete_url', url: currentUrl });
                        }
                        break;
                    }
                    case 'prev':
                    case 'next': {
                        const targetIdx = name === 'prev' ? currentIdx - 1 : currentIdx + 1;
                        if (targetIdx >= 0 && targetIdx < urls.length) {
                            chrome.tabs.update(tabId, { url: urls[targetIdx].url }, () => {
                                if (chrome.runtime.lastError)
                                    console.error('Failed to update tab:', chrome.runtime.lastError);
                            });
                        }
                        break;
                    }
                    case 'play':
                        await sendTabMessage(tabId, { type: 'yt_play' });
                        break;
                    case 'pause':
                        await sendTabMessage(tabId, { type: 'yt_pause' });
                        break;
                }
            } catch {
                return;
            }
        },
        [urls],
    );

    const openFirstUrl = useCallback((urlList: UrlItem[]) => {
        if (urlList.length === 0) return;

        const firstUrl = urlList[0].url;
        chrome.tabs.query({ url: YOUTUBE_URL_PATTERN }, ytabs => {
            const ytIds = ytabs.map(t => t.id).filter((id): id is number => id !== undefined);
            const createTab = () => chrome.tabs.create({ url: firstUrl });

            if (ytIds.length > 0) chrome.tabs.remove(ytIds, createTab);
            else createTab();
        });
    }, []);

    const openUrl = useCallback((url: string) => {
        chrome.tabs.query({ url: YOUTUBE_URL_PATTERN }, tabs => {
            const ytIds = tabs.map(t => t.id).filter((id): id is number => id !== undefined);
            const createTab = () => chrome.tabs.create({ url });

            if (ytIds.length > 0) chrome.tabs.remove(ytIds, createTab);
            else createTab();
        });
    }, []);

    return { handleControl, openFirstUrl, openUrl };
}
