import normalizeApiResponse from '@/shared/utils/api';
import { parseApiErrorForUI } from '@/shared/utils/apiUi';
import { runParsedApiError, runUiAction } from '@/shared/utils/runUiAction';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type YtStatusMode = 'compact' | 'player';

export interface SettingsStore {
    ytStatusVisible: boolean;
    setYtStatusVisible: (v: boolean) => void;
    ytStatusMode: YtStatusMode;
    setYtStatusMode: (v: YtStatusMode) => void;
    ytAdminControlsEnabled: boolean;
    setYtAdminControlsEnabled: (v: boolean) => void;
    loadFromServer: (
        data?: Partial<{
            ytStatusVisible: boolean;
            ytStatusMode: YtStatusMode;
            ytAdminControlsEnabled: boolean;
        }>,
    ) => void;
    syncToServer: () => {
        ytStatusVisible: boolean;
        ytStatusMode: YtStatusMode;
        ytAdminControlsEnabled: boolean;
    };
    reset: () => void;
}

let settingsRevision = 0;
let loadVersion = 0;
let saveTail = Promise.resolve();

const loadFromServerAsync = async (): Promise<void> => {
    const revision = settingsRevision;
    const version = ++loadVersion;
    try {
        await saveTail;
        const resp = await fetch('/api/settings', { signal: AbortSignal.timeout(5000) });
        const norm = await normalizeApiResponse<
            Partial<{
                ytStatusVisible: boolean;
                ytStatusMode: YtStatusMode;
                ytAdminControlsEnabled: boolean;
            }>
        >(resp);
        if (!norm.success) {
            try {
                const err = norm.error;
                const parsed = parseApiErrorForUI({
                    code: err.code ?? undefined,
                    details: err.details,
                    message: err.message,
                });
                await runParsedApiError(parsed);
            } catch {
                if (import.meta.env.DEV) console.warn('loadFromServer server error', norm.error);
            }
            return;
        }
        if (revision !== settingsRevision || version !== loadVersion) return;
        useSettingsStore.getState().loadFromServer(norm.data ?? {});
    } catch (error) {
        if (import.meta.env.DEV) console.warn('loadFromServer error', error);
    }
};

const _syncToServerAsync = async (
    payload: { ytAdminControlsEnabled: boolean; ytStatusMode: YtStatusMode; ytStatusVisible: boolean },
): Promise<void> => {
    try {
        const resp = await fetch('/api/settings', {
            body: JSON.stringify(payload),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
            signal: AbortSignal.timeout(5000),
        });
        const norm = await normalizeApiResponse(resp);
        if (!norm.success) {
            try {
                const err = norm.error;
                const parsed = parseApiErrorForUI({
                    code: err.code ?? undefined,
                    details: err.details,
                    message: err.message,
                });
                await runParsedApiError(parsed);
            } catch {
                if (import.meta.env.DEV) console.warn('syncToServer error', norm.error);
            }
        }
    } catch (error) {
        console.error('設定の保存に失敗しました', error);
        await runUiAction({
            type: 'showToast',
            level: 'warning',
            message: '設定をサーバーに保存できませんでした。この端末の設定は保持しています。',
        });
    }
};

export const useSettingsStore = create<SettingsStore>()(
    persist(
        (set, get) => ({
            loadFromServer: (
                data?: Partial<{
                    ytStatusVisible: boolean;
                    ytStatusMode: YtStatusMode;
                    ytAdminControlsEnabled: boolean;
                }>,
            ) => {
                if (!data) {
                    void loadFromServerAsync();
                    return;
                }
                set({
                    ...(typeof data.ytStatusVisible === 'boolean' ? { ytStatusVisible: data.ytStatusVisible } : {}),
                    ...(data.ytStatusMode === 'compact' || data.ytStatusMode === 'player'
                        ? { ytStatusMode: data.ytStatusMode }
                        : {}),
                    ...(typeof data.ytAdminControlsEnabled === 'boolean'
                        ? { ytAdminControlsEnabled: data.ytAdminControlsEnabled }
                        : {}),
                });
            },
            reset: () => {
                settingsRevision++;
                set({ ytAdminControlsEnabled: false, ytStatusMode: 'player', ytStatusVisible: true });
            },
            setYtAdminControlsEnabled: (v: boolean) => {
                settingsRevision++;
                set({ ytAdminControlsEnabled: v });
            },
            setYtStatusMode: (v: YtStatusMode) => {
                settingsRevision++;
                set({ ytStatusMode: v });
            },
            setYtStatusVisible: (v: boolean) => {
                settingsRevision++;
                set({ ytStatusVisible: v });
            },
            syncToServer: () => {
                const payload = {
                    ytAdminControlsEnabled: get().ytAdminControlsEnabled,
                    ytStatusMode: get().ytStatusMode,
                    ytStatusVisible: get().ytStatusVisible,
                };
                saveTail = saveTail.then(() => _syncToServerAsync(payload));
                return payload;
            },
            ytAdminControlsEnabled: false,
            ytStatusMode: 'player',
            ytStatusVisible: true,
        }),
        { name: 'settings-storage' },
    ),
);
