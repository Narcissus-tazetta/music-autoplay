import type { YtStatusMode } from '@/app/stores/settingsStore';
import { useSettingsStore } from '@/app/stores/settingsStore';
import { useEffect, useRef } from 'react';

/**
 * Mirrors the three synced settings to the server whenever one of them changes.
 *
 * Each value is read through its own selector: subscribing to the whole store meant every
 * unrelated settings write re-rendered every consumer of this hook.
 */
export function useSettingsSync() {
    const ytStatusVisible = useSettingsStore(s => s.ytStatusVisible);
    const ytStatusMode = useSettingsStore(s => s.ytStatusMode);
    const ytAdminControlsEnabled = useSettingsStore(s => s.ytAdminControlsEnabled);
    const setYtStatusVisible = useSettingsStore(s => s.setYtStatusVisible);
    const setYtStatusMode = useSettingsStore(s => s.setYtStatusMode);
    const setYtAdminControlsEnabled = useSettingsStore(s => s.setYtAdminControlsEnabled);
    const loadFromServer = useSettingsStore(s => s.loadFromServer);
    const syncToServer = useSettingsStore(s => s.syncToServer);

    const hasLoadedRef = useRef(false);
    const previousRef = useRef({ ytAdminControlsEnabled, ytStatusMode, ytStatusVisible });

    useEffect(() => {
        const current = { ytAdminControlsEnabled, ytStatusMode, ytStatusVisible };

        // First run adopts the current values and pulls the server copy instead of pushing.
        if (!hasLoadedRef.current) {
            hasLoadedRef.current = true;
            previousRef.current = current;
            loadFromServer?.();
            return;
        }

        const previous = previousRef.current;
        const changed = (Object.keys(current) as (keyof typeof current)[])
            .some(key => previous[key] !== current[key]);

        if (changed) {
            previousRef.current = current;
            syncToServer?.();
        }
    }, [loadFromServer, syncToServer, ytAdminControlsEnabled, ytStatusMode, ytStatusVisible]);

    return {
        setYtAdminControlsEnabled,
        setYtStatusMode,
        setYtStatusVisible,
        ytAdminControlsEnabled,
        ytStatusMode: ytStatusMode as YtStatusMode,
        ytStatusVisible,
    };
}
