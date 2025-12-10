import type { SocketInstance, TabInfo } from './types';

const YOUTUBE_WATCH_PATTERN = 'youtube.com/watch';

const tabUrlMap = new Map<number, string>();
const extensionOpenedTabs = new Set<number>();

export function isExtensionOpenedTab(tabId: number): boolean {
    return extensionOpenedTabs.has(tabId);
}

export function addExtensionTab(tabId: number): void {
    extensionOpenedTabs.add(tabId);
}

export function removeExtensionTab(tabId: number): void {
    extensionOpenedTabs.delete(tabId);
}

export function getTabUrl(tabId: number): string | undefined {
    return tabUrlMap.get(tabId);
}

export function setTabUrl(tabId: number, url: string): void {
    tabUrlMap.set(tabId, url);
}

export function deleteTabUrl(tabId: number): void {
    tabUrlMap.delete(tabId);
}

export function handleTabUpdated(
    tabId: number,
    changeInfo: unknown,
    tab: TabInfo,
    socket: SocketInstance | null,
): void {
    if (!tab?.url) return;

    if (tab.url.includes(YOUTUBE_WATCH_PATTERN)) addExtensionTab(tabId);
    else if (isExtensionOpenedTab(tabId)) {
        const previousUrl = getTabUrl(tabId);
        if (socket?.connected && previousUrl)
            socket.emit('youtube_video_state', { state: 'window_close', url: previousUrl });
        removeExtensionTab(tabId);
    }

    setTabUrl(tabId, tab.url);
}

export function handleTabRemoved(
    tabId: number,
    _removeInfo: unknown,
    socket: SocketInstance,
): void {
    if (extensionOpenedTabs.has(tabId)) {
        const previousUrl = getTabUrl(tabId);
        extensionOpenedTabs.delete(tabId);
        if (socket.connected) {
            if (previousUrl) socket.emit('youtube_video_state', { state: 'window_close', url: previousUrl });
            socket.emit('tab_closed', { tabId });
        }
    }

    deleteTabUrl(tabId);
}

export function handleTabCreated(tab: TabInfo): void {
    if (!tab?.url || tab.id === undefined) return;

    setTabUrl(tab.id, tab.url);

    if (tab.url.includes(YOUTUBE_WATCH_PATTERN)) addExtensionTab(tab.id);
}

export { extensionOpenedTabs };
