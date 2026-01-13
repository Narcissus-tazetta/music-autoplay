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

function getStorageLocal(): any | null {
    try {
        const local = (globalThis as any)?.chrome?.storage?.local;
        if (local && typeof local.get === 'function' && typeof local.set === 'function') return local;
        return null;
    } catch {
        return null;
    }
}

function isWeekend(): boolean {
    const now = new Date();
    const dayOfWeek = now.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
}

function initMasterToggleState(): void {
    const local = getStorageLocal();
    if (!local) {
        extensionMasterEnabled = !isWeekend();
        return;
    }

    local.get(['extensionMasterEnabled'], (result: any) => {
        try {
            if ((globalThis as any)?.chrome?.runtime?.lastError) {
                console.error(
                    '[init] Failed to get extensionMasterEnabled',
                    (globalThis as any).chrome.runtime.lastError,
                );
                extensionMasterEnabled = !isWeekend();
                return;
            }

            extensionMasterEnabled = result?.extensionMasterEnabled !== undefined
                ? Boolean(result.extensionMasterEnabled)
                : !isWeekend();

            if (result?.extensionMasterEnabled === undefined) {
                local.set({ extensionMasterEnabled }, () => {
                    if ((globalThis as any)?.chrome?.runtime?.lastError) {
                        console.error(
                            '[init] Failed to save initial extensionMasterEnabled',
                            (globalThis as any).chrome.runtime.lastError,
                        );
                    }
                });
            }
        } catch {
            extensionMasterEnabled = !isWeekend();
        }
    });
}

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
        const local = getStorageLocal();
        local?.set?.({ manuallyDisabled: !enabled }, () => {
            if ((globalThis as any)?.chrome?.runtime?.lastError) {
                console.error(
                    '[handleMasterToggle] Failed to save manuallyDisabled',
                    (globalThis as any).chrome.runtime.lastError,
                );
            }
        });
    }
    const local = getStorageLocal();
    local?.set?.({ extensionMasterEnabled: enabled }, () => {
        if ((globalThis as any)?.chrome?.runtime?.lastError) {
            console.error(
                '[handleMasterToggle] Failed to save extensionMasterEnabled',
                (globalThis as any).chrome.runtime.lastError,
            );
        }
    });
}

alarms?.clear?.(WEEKEND_ALARM, () => {
    alarms.create?.(WEEKEND_ALARM, {
        periodInMinutes: TIMING.WEEKEND_CHECK_INTERVAL / 60000,
    });
});

alarms?.onAlarm?.addListener((alarm: AlarmLike) => {
    if (alarm.name !== WEEKEND_ALARM) return;

    if (isWeekend() && extensionMasterEnabled) {
        extensionMasterEnabled = false;
        const local = getStorageLocal();
        local?.set?.({ extensionMasterEnabled: false }, () => {
            if ((globalThis as any)?.chrome?.runtime?.lastError) {
                console.error(
                    '[weekendCheck] Failed to disable extension',
                    (globalThis as any).chrome.runtime.lastError,
                );
            }
        });
    } else if (!isWeekend() && !extensionMasterEnabled) {
        const local = getStorageLocal();
        if (!local) return;
        local.get(['manuallyDisabled'], (result: any) => {
            if ((globalThis as any)?.chrome?.runtime?.lastError) {
                console.error(
                    '[weekendCheck] Failed to get manuallyDisabled',
                    (globalThis as any).chrome.runtime.lastError,
                );
                return;
            }
            if (!result?.manuallyDisabled) {
                extensionMasterEnabled = true;
                local.set({ extensionMasterEnabled: true }, () => {
                    if ((globalThis as any)?.chrome?.runtime?.lastError) {
                        console.error(
                            '[weekendCheck] Failed to enable extension',
                            (globalThis as any).chrome.runtime.lastError,
                        );
                    }
                });
            }
        });
    }
});
export function setupMasterToggleHandler(): void {
    initMasterToggleState();
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
