import { useCallback, useEffect, useState } from 'react';
import type { SocketDisconnectedMessage, SocketErrorMessage, UrlItem, UrlListMessage } from '../types';
import { getChromeStorage, sendChromeMessage } from '../utils/chrome';

interface UseUrlListReturn {
    urls: UrlItem[];
    error: string | null;
    removeUrl: (index: number) => Promise<void>;
}

export function useUrlList(): UseUrlListReturn {
    const [urls, setUrls] = useState<UrlItem[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadUrls = async () => {
            const result = await getChromeStorage(['urlList']);
            if (Array.isArray(result.urlList)) setUrls(result.urlList);
        };

        const messageListener = (message: unknown) => {
            const msg = message as UrlListMessage | SocketErrorMessage | SocketDisconnectedMessage;
            if (msg.type === 'url_list' && 'urls' in msg && Array.isArray(msg.urls)) {
                setUrls(msg.urls);
                setError(null);
                return;
            }

            if (msg.type === 'socket_error' && 'error' in msg) {
                setError(`サーバー接続エラー: ${msg.error || ''}`);
                return;
            }

            if (msg.type === 'socket_disconnected' && 'reason' in msg) setError(`サーバー切断: ${msg.reason || ''}`);
        };

        loadUrls();
        chrome.runtime.onMessage.addListener(messageListener);
        sendChromeMessage({ type: 'reconnect_socket' });

        return () => {
            chrome.runtime.onMessage.removeListener(messageListener);
        };
    }, []);

    const removeUrl = useCallback(
        async (index: number) => {
            const urlToRemove = urls[index]?.url;
            if (!urlToRemove) {
                console.warn(`[useUrlList] Invalid index for removal: ${index}`);
                return;
            }

            try {
                await sendChromeMessage({ type: 'delete_url', url: urlToRemove });
                setUrls(prev => prev.filter((_, i) => i !== index));
            } catch (error) {
                console.error('[useUrlList] Failed to remove URL:', error);
                setError(`URLの削除に失敗しました`);
            }
        },
        [urls],
    );

    return { urls, error, removeUrl };
}
