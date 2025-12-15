import { EXTENSION_NAMESPACE, TIMING } from '../constants';
import type { ExtensionGlobal } from './types';

const WEEKEND_ALARM = 'weekend_check';

type AlarmLike = { name?: string };
type AlarmsApiLike = {
    clear?: (name: string, cb?: () => void) => void;
    create?: (name: string, info: { periodInMinutes?: number }) => void;
    onAlarm?: { addListener: (cb: (alarm: AlarmLike) => void) => void };
};

const alarms = (globalThis as unknown as { chrome?: { alarms?: AlarmsApiLike } }).chrome?.alarms;

let extensionMasterEnabled = true;

function isWeekend(): boolean {
    const now = new Date();
    const dayOfWeek = now.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
}

chrome.storage.local.get(['extensionMasterEnabled'], result => {
    if (chrome.runtime.lastError) {
        console.error('[init] Failed to get extensionMasterEnabled', chrome.runtime.lastError);
        extensionMasterEnabled = !isWeekend();
        return;
    }

    extensionMasterEnabled = result.extensionMasterEnabled !== undefined ? result.extensionMasterEnabled : !isWeekend();
    if (result.extensionMasterEnabled === undefined) {
        chrome.storage.local.set({ extensionMasterEnabled }, () => {
            if (chrome.runtime.lastError) {
                console.error(
                    '[init] Failed to save initial extensionMasterEnabled',
                    chrome.runtime.lastError,
                );
            }
        });
    }
});

export function isExtensionEnabled(): boolean {
    return extensionMasterEnabled;
}

(globalThis as unknown as Record<string, ExtensionGlobal>)[EXTENSION_NAMESPACE] = {
    isExtensionEnabled,
    version: '1.2.1',
};

function handleMasterToggle(enabled: boolean, isManualChange = false): void {
    extensionMasterEnabled = enabled;
    if (isManualChange) {
        chrome.storage.local.set({ manuallyDisabled: !enabled }, () => {
            if (chrome.runtime.lastError) {
                console.error(
                    '[handleMasterToggle] Failed to save manuallyDisabled',
                    chrome.runtime.lastError,
                );
            }
        });
    }
    chrome.storage.local.set({ extensionMasterEnabled: enabled }, () => {
        if (chrome.runtime.lastError) {
            console.error(
                '[handleMasterToggle] Failed to save extensionMasterEnabled',
                chrome.runtime.lastError,
            );
        }
    });
}

alarms?.clear(WEEKEND_ALARM, () => {
    alarms.create(WEEKEND_ALARM, {
        periodInMinutes: TIMING.WEEKEND_CHECK_INTERVAL / 60000,
    });
});

alarms?.onAlarm.addListener((alarm: AlarmLike) => {
    if (alarm.name !== WEEKEND_ALARM) return;

    if (isWeekend() && extensionMasterEnabled) {
        extensionMasterEnabled = false;
        chrome.storage.local.set({ extensionMasterEnabled: false }, () => {
            if (chrome.runtime.lastError)
                console.error('[weekendCheck] Failed to disable extension', chrome.runtime.lastError);
        });
    } else if (!isWeekend() && !extensionMasterEnabled) {
        chrome.storage.local.get(['manuallyDisabled'], result => {
            if (chrome.runtime.lastError) {
                console.error('[weekendCheck] Failed to get manuallyDisabled', chrome.runtime.lastError);
                return;
            }
            if (!result.manuallyDisabled) {
                extensionMasterEnabled = true;
                chrome.storage.local.set({ extensionMasterEnabled: true }, () => {
                    if (chrome.runtime.lastError)
                        console.error('[weekendCheck] Failed to enable extension', chrome.runtime.lastError);
                });
            }
        });
    }
});

export function setupMasterToggleHandler(): void {
    chrome.runtime.onMessage.addListener(
        (message: { type: string; enabled?: boolean }, _sender, sendResponse) => {
            if (message.type === 'extension_master_toggle' && typeof message.enabled === 'boolean') {
                handleMasterToggle(message.enabled, true);
                sendResponse({ status: 'ok' });
                return true;
            }
            return false;
        },
    );
}
