import type { SocketInstance, TabInfo } from './types';

const tabUrlMap = new Map<number, string>();
const extensionOpenedTabs = new Set<number>();
let activeExtensionTabId: number | null = null;
let activePlaybackTabId: number | null = null;
let activePlaybackUpdatedAt = 0;
const ACTIVE_PLAYBACK_TTL_MS = 60_000;
let lastOpenedByExtensionTabId: number | null = null;

export function isExtensionOpenedTab(tabId: number): boolean {
    return extensionOpenedTabs.has(tabId);
}

export function addExtensionTab(tabId: number): void {
    extensionOpenedTabs.add(tabId);
    if (activeExtensionTabId === null) activeExtensionTabId = tabId;
    try {
        console.info('[tab-manager] addExtensionTab', { tabId });
    } catch {}
}

export function removeExtensionTab(tabId: number): void {
    extensionOpenedTabs.delete(tabId);
    if (activeExtensionTabId === tabId) activeExtensionTabId = null;
    try {
        console.info('[tab-manager] removeExtensionTab', { tabId });
    } catch {}
}

export function setActiveExtensionTab(tabId: number): void {
    if (!extensionOpenedTabs.has(tabId)) return;
    activeExtensionTabId = tabId;
}

export function getActiveExtensionTabId(): number | null {
    return activeExtensionTabId;
}

export function setLastOpenedByExtensionTabId(tabId: number): void {
    lastOpenedByExtensionTabId = tabId;
}

export function getLastOpenedByExtensionTabId(): number | null {
    return lastOpenedByExtensionTabId;
}

export function setActivePlaybackTab(tabId: number): void {
    activePlaybackTabId = tabId;
    activePlaybackUpdatedAt = Date.now();
}

export function isActivePlaybackTab(tabId: number): boolean {
    if (activePlaybackTabId !== tabId) return false;
    return Date.now() - activePlaybackUpdatedAt <= ACTIVE_PLAYBACK_TTL_MS;
}

export function getActivePlaybackTabId(): number | null {
    if (activePlaybackTabId === null) return null;
    if (Date.now() - activePlaybackUpdatedAt > ACTIVE_PLAYBACK_TTL_MS) return null;
    return activePlaybackTabId;
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

    if (isExtensionOpenedTab(tabId) && !tab.url.includes('youtube.com/watch')) {
        const previousUrl = getTabUrl(tabId);
        try {
            console.info('[tab-manager] handleTabUpdated removing tracked tab', { tabId, previousUrl });
        } catch {}
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
        if (activeExtensionTabId === tabId) activeExtensionTabId = null;
        try {
            console.info('[tab-manager] handleTabRemoved for tracked tab', { tabId, previousUrl });
        } catch {}
        if (socket.connected) {
            if (previousUrl) socket.emit('youtube_video_state', { state: 'window_close', url: previousUrl });
            socket.emit('tab_closed', { tabId });
        }
    }

    if (activePlaybackTabId === tabId) {
        activePlaybackTabId = null;
        activePlaybackUpdatedAt = 0;
    }

    if (lastOpenedByExtensionTabId === tabId) lastOpenedByExtensionTabId = null;

    deleteTabUrl(tabId);
}

export function handleTabCreated(tab: TabInfo): void {
    if (!tab?.url || tab.id === undefined) return;

    setTabUrl(tab.id, tab.url);
}

export { extensionOpenedTabs };
