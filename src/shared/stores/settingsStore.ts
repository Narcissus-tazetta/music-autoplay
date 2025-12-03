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
    loadFromServer: (data?: Partial<{ ytStatusVisible: boolean; ytStatusMode: YtStatusMode }>) => void;
    syncToServer: () => { ytStatusVisible: boolean; ytStatusMode: YtStatusMode };
    reset: () => void;
}

const loadFromServerAsync = async (): Promise<void> => {
    try {
        const resp = await fetch('/api/settings');
        const norm = await normalizeApiResponse<Partial<{ ytStatusVisible: boolean; ytStatusMode: YtStatusMode }>>(
            resp,
        );
        if (!norm.success) {
            try {
                const err = norm.error;
                const parsed = parseApiErrorForUI({
                    code: err.code ?? undefined,
                    message: err.message,
                    details: err.details,
                });
                try {
                    const mod = await import('@/shared/utils/uiActionExecutor');
                    mod.executeParsedApiError(parsed, { conformFields: undefined });
                } catch (errExec: unknown) {
                    if (import.meta.env.DEV) console.warn('loadFromServer server error', parsed, errExec);
                }
            } catch {
                if (import.meta.env.DEV) console.warn('loadFromServer server error', norm.error);
            }
            return;
        }
        const server = norm.data;
        if (typeof server.ytStatusVisible === 'boolean')
            useSettingsStore.getState().setYtStatusVisible(server.ytStatusVisible);
        if (typeof server.ytStatusMode === 'string') useSettingsStore.getState().setYtStatusMode(server.ytStatusMode);
    } catch (_e: unknown) {
        if (import.meta.env.DEV) console.warn('loadFromServer error', _e);
    }
};

const _syncToServerAsync = async (): Promise<void> => {
    try {
        const payload = {
            ytStatusVisible: useSettingsStore.getState().ytStatusVisible,
            ytStatusMode: useSettingsStore.getState().ytStatusMode,
        };
        const resp = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const norm = await normalizeApiResponse(resp);
        if (!norm.success) {
            try {
                const err = norm.error;
                const parsed = parseApiErrorForUI({
                    code: err.code ?? undefined,
                    message: err.message,
                    details: err.details,
                });
                try {
                    const mod = await import('@/shared/utils/uiActionExecutor');
                    mod.executeParsedApiError(parsed, { conformFields: undefined });
                } catch (errExec: unknown) {
                    if (import.meta.env.DEV) console.warn('syncToServer error', parsed, errExec);
                }
            } catch {
                if (import.meta.env.DEV) console.warn('syncToServer error', norm.error);
            }
        }
    } catch (_e: unknown) {
        if (import.meta.env.DEV) console.warn('syncToServer error', _e);
    }
};

export const useSettingsStore = create<SettingsStore>()(
    persist(
        (set, get) => ({
            ytStatusVisible: true,
            ytStatusMode: 'player',
            setYtStatusVisible: (v: boolean) => set({ ytStatusVisible: v }),
            setYtStatusMode: (v: YtStatusMode) => set({ ytStatusMode: v }),
            loadFromServer: (data?: Partial<{ ytStatusVisible: boolean; ytStatusMode: YtStatusMode }>) => {
                if (!data) {
                    void loadFromServerAsync();
                    return;
                }
                if (typeof data.ytStatusVisible === 'boolean') set({ ytStatusVisible: data.ytStatusVisible });
                const d = data as Partial<{ ytStatusVisible: boolean; ytStatusMode: YtStatusMode }>;
                if (d.ytStatusMode === 'compact' || d.ytStatusMode === 'player') set({ ytStatusMode: d.ytStatusMode });
            },
            syncToServer: () => {
                void _syncToServerAsync();
                return { ytStatusVisible: get().ytStatusVisible, ytStatusMode: get().ytStatusMode };
            },
            reset: () => set({ ytStatusVisible: true, ytStatusMode: 'player' }),
        }),
        { name: 'settings-storage' },
    ),
);

export default useSettingsStore;
