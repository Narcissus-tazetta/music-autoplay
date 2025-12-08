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
    loadFromServer: (
        data?: Partial<{ ytStatusVisible: boolean; ytStatusMode: YtStatusMode }>,
    ) => void;
    syncToServer: () => { ytStatusVisible: boolean; ytStatusMode: YtStatusMode };
    reset: () => void;
}

const loadFromServerAsync = async (): Promise<void> => {
    try {
        const resp = await fetch('/api/settings');
        const norm = await normalizeApiResponse<
            Partial<{ ytStatusVisible: boolean; ytStatusMode: YtStatusMode }>
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
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (server && typeof server.ytStatusVisible === 'boolean')
            useSettingsStore.getState().setYtStatusVisible(server.ytStatusVisible);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (server && typeof server.ytStatusMode === 'string')
            useSettingsStore.getState().setYtStatusMode(server.ytStatusMode);
    } catch (error) {
        if (import.meta.env.DEV) console.warn('loadFromServer error', error);
    }
};

const _syncToServerAsync = async (): Promise<void> => {
    try {
        const payload = {
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
                }>;
                if (d.ytStatusMode === 'compact' || d.ytStatusMode === 'player') set({ ytStatusMode: d.ytStatusMode });
            },
            reset: () => set({ ytStatusMode: 'player', ytStatusVisible: true }),
            setYtStatusMode: (v: YtStatusMode) => set({ ytStatusMode: v }),
            setYtStatusVisible: (v: boolean) => set({ ytStatusVisible: v }),
            syncToServer: () => {
                void _syncToServerAsync();
                return {
                    ytStatusMode: get().ytStatusMode,
                    ytStatusVisible: get().ytStatusVisible,
                };
            },
            ytStatusMode: 'player',
            ytStatusVisible: true,
        }),
        { name: 'settings-storage' },
    ),
);

export default useSettingsStore;
