import type { ChromeMessage, ChromeMessageResponse, ChromeStorageData } from '../types';

interface ChromeTabResult {
    id?: number;
    url?: string;
    title?: string;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}

export function sendChromeMessage(message: ChromeMessage): Promise<ChromeMessageResponse> {
    return new Promise(resolve => {
        try {
            chrome.runtime.sendMessage(message, (response: ChromeMessageResponse) => {
                if (chrome.runtime.lastError) {
                    resolve({ status: 'error', error: chrome.runtime.lastError.message });
                    return;
                }
                resolve(response || { status: 'ok' });
            });
        } catch (error) {
            resolve({ status: 'error', error: getErrorMessage(error) });
        }
    });
}

export function getChromeStorage<K extends keyof ChromeStorageData>(
    keys: K[],
): Promise<Pick<ChromeStorageData, K>> {
    return new Promise(resolve => {
        chrome.storage.local.get(keys, result => {
            resolve(result as Pick<ChromeStorageData, K>);
        });
    });
}

export function setChromeStorage(data: Partial<ChromeStorageData>): Promise<void> {
    return new Promise(resolve => {
        chrome.storage.local.set(data, () => {
            resolve();
        });
    });
}

export function sendTabMessage(
    tabId: number,
    message: ChromeMessage,
): Promise<ChromeMessageResponse> {
    return new Promise(resolve => {
        try {
            chrome.tabs.sendMessage(tabId, message, (response: ChromeMessageResponse) => {
                if (chrome.runtime.lastError) {
                    resolve({ status: 'error', error: chrome.runtime.lastError.message });
                    return;
                }
                resolve(response || { status: 'ok' });
            });
        } catch (error) {
            resolve({ status: 'error', error: getErrorMessage(error) });
        }
    });
}

export async function findYouTubeTabs(): Promise<number[]> {
    const response = await sendChromeMessage({ type: 'find_youtube_tabs' });
    return (response as unknown as { tabIds?: number[] }).tabIds || [];
}

export function queryYouTubeTabs(urlPattern: string): Promise<ChromeTabResult[]> {
    return new Promise(resolve => {
        chrome.tabs.query({ url: urlPattern }, tabs => {
            resolve(tabs);
        });
    });
}

export function createTab(url: string): Promise<ChromeTabResult> {
    return new Promise((resolve, reject) => {
        chrome.tabs.create({ url }, tab => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            resolve(tab);
        });
    });
}

export function updateTab(tabId: number, url: string): Promise<ChromeTabResult> {
    return new Promise((resolve, reject) => {
        chrome.tabs.update(tabId, { url }, tab => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            resolve(tab || {});
        });
    });
}

export function removeTabs(tabIds: number[]): Promise<void> {
    return new Promise((resolve, reject) => {
        chrome.tabs.remove(tabIds, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            resolve();
        });
    });
}

export async function getAdStateFromTab(tabId: number): Promise<boolean> {
    try {
        const response = await sendTabMessage(tabId, { type: 'get_ad_state' });
        return (response as { isAd?: boolean }).isAd || false;
    } catch {
        return false;
    }
}
