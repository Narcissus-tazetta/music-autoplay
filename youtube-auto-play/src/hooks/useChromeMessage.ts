import { useCallback, useEffect } from 'react';
import type { ChromeMessage } from '../types';
import { sendChromeMessage } from '../utils/chrome';

export function useChromeMessageListener(handler: (message: ChromeMessage) => void): void {
    useEffect(() => {
        chrome.runtime.onMessage.addListener(handler);
        return () => {
            chrome.runtime.onMessage.removeListener(handler);
        };
    }, [handler]);
}

export function useChromeMessage() {
    const send = useCallback(async (message: ChromeMessage) => {
        return await sendChromeMessage(message);
    }, []);

    return { send };
}
