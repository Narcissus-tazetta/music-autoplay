import type { ChromeMessage, ChromeMessageResponse, ChromeStorageData } from './index';

declare global {
    const chrome: {
        runtime: {
            sendMessage: (
                message: ChromeMessage,
                callback?: (response: ChromeMessageResponse) => void,
            ) => void;
            onMessage: {
                addListener: (
                    callback: (
                        message: ChromeMessage,
                        sender: chrome.runtime.MessageSender,
                        sendResponse: (response?: ChromeMessageResponse) => void,
                    ) => boolean | void,
                ) => void;
                removeListener: (
                    callback: (
                        message: ChromeMessage,
                        sender: chrome.runtime.MessageSender,
                        sendResponse: (response?: ChromeMessageResponse) => void,
                    ) => boolean | void,
                ) => void;
            };
            lastError?: { message: string };
        };
        storage: {
            local: {
                get: <K extends keyof ChromeStorageData>(
                    keys: K[] | K,
                    callback: (result: Pick<ChromeStorageData, K>) => void,
                ) => void;
                set: (data: Partial<ChromeStorageData>, callback?: () => void) => void;
            };
        };
        tabs: {
            query: (
                queryInfo: chrome.tabs.QueryInfo,
                callback: (tabs: chrome.tabs.Tab[]) => void,
            ) => void;
            create: (
                createProperties: chrome.tabs.CreateProperties,
                callback?: (tab: chrome.tabs.Tab) => void,
            ) => void;
            update: (
                tabId: number,
                updateProperties: chrome.tabs.UpdateProperties,
                callback?: (tab: chrome.tabs.Tab) => void,
            ) => void;
            remove: (tabIds: number | number[], callback?: () => void) => void;
            sendMessage: (
                tabId: number,
                message: ChromeMessage,
                callback?: (response: ChromeMessageResponse) => void,
            ) => void;
            onRemoved: {
                addListener: (
                    callback: (tabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => void,
                ) => void;
                removeListener: (
                    callback: (tabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => void,
                ) => void;
            };
            onUpdated: {
                addListener: (
                    callback: (
                        tabId: number,
                        changeInfo: chrome.tabs.TabChangeInfo,
                        tab: chrome.tabs.Tab,
                    ) => void,
                ) => void;
            };
            onCreated: {
                addListener: (callback: (tab: chrome.tabs.Tab) => void) => void;
            };
        };
        commands: {
            onCommand: {
                addListener: (callback: (command: string) => void) => void;
            };
        };
    };
}
