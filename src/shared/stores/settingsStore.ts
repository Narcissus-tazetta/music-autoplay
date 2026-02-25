import normalizeApiResponse from '@/shared/utils/api';
import { parseApiErrorForUI } from '@/shared/utils/apiUi';
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

const loadFromServerAsync = async (): Promise<void> => {
    try {
        const resp = await fetch('/api/settings');
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
                try {
                    const mod = await import('@/shared/utils/uiActionExecutor');
                    mod.executeParsedApiError(parsed, { conformFields: undefined });
                } catch (error) {
                    if (import.meta.env.DEV) console.warn('loadFromServer server error', parsed, error);
                }
            } catch {
                if (import.meta.env.DEV) console.warn('loadFromServer server error', norm.error);
            }
            return;
        }
        const server = norm.data;
        if (server && typeof server.ytStatusVisible === 'boolean')
            useSettingsStore.getState().setYtStatusVisible(server.ytStatusVisible);
        if (server && typeof server.ytStatusMode === 'string')
            useSettingsStore.getState().setYtStatusMode(server.ytStatusMode);
        if (server && typeof server.ytAdminControlsEnabled === 'boolean')
            useSettingsStore.getState().setYtAdminControlsEnabled(server.ytAdminControlsEnabled);
    } catch (error) {
        if (import.meta.env.DEV) console.warn('loadFromServer error', error);
    }
};

const _syncToServerAsync = async (): Promise<void> => {
    try {
        const payload = {
            ytAdminControlsEnabled: useSettingsStore.getState().ytAdminControlsEnabled,
            ytStatusMode: useSettingsStore.getState().ytStatusMode,
            ytStatusVisible: useSettingsStore.getState().ytStatusVisible,
        };
        const resp = await fetch('/api/settings', {
            body: JSON.stringify(payload),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
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
                try {
                    const mod = await import('@/shared/utils/uiActionExecutor');
                    mod.executeParsedApiError(parsed, { conformFields: undefined });
                } catch (error) {
                    if (import.meta.env.DEV) console.warn('syncToServer error', parsed, error);
                }
            } catch {
                if (import.meta.env.DEV) console.warn('syncToServer error', norm.error);
            }
        }
    } catch (error) {
        if (import.meta.env.DEV) console.warn('syncToServer error', error);
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
                if (typeof data.ytStatusVisible === 'boolean') set({ ytStatusVisible: data.ytStatusVisible });
                const d = data as Partial<{
                    ytStatusVisible: boolean;
                    ytStatusMode: YtStatusMode;
                    ytAdminControlsEnabled: boolean;
                }>;
                if (d.ytStatusMode === 'compact' || d.ytStatusMode === 'player') set({ ytStatusMode: d.ytStatusMode });
                if (typeof d.ytAdminControlsEnabled === 'boolean')
                    set({ ytAdminControlsEnabled: d.ytAdminControlsEnabled });
            },
            reset: () => set({ ytAdminControlsEnabled: false, ytStatusMode: 'player', ytStatusVisible: true }),
            setYtAdminControlsEnabled: (v: boolean) => set({ ytAdminControlsEnabled: v }),
            setYtStatusMode: (v: YtStatusMode) => set({ ytStatusMode: v }),
            setYtStatusVisible: (v: boolean) => set({ ytStatusVisible: v }),
            syncToServer: () => {
                void _syncToServerAsync();
                return {
                    ytAdminControlsEnabled: get().ytAdminControlsEnabled,
                    ytStatusMode: get().ytStatusMode,
                    ytStatusVisible: get().ytStatusVisible,
                };
            },
            ytAdminControlsEnabled: false,
            ytStatusMode: 'player',
            ytStatusVisible: true,
        }),
        { name: 'settings-storage' },
    ),
);

export default useSettingsStore;
