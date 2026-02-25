import { useSettingsStore } from '@/shared/stores/settingsStore';
import type { YtStatusMode } from '@/shared/stores/settingsStore';
import { useEffect, useRef } from 'react';

export function useSettingsSync() {
    const settings = useSettingsStore();
    const ytStatusVisible = settings.ytStatusVisible;
    const setYtStatusVisible = settings.setYtStatusVisible;
    const ytStatusMode: YtStatusMode = settings.ytStatusMode;
    const setYtStatusMode = settings.setYtStatusMode;
    const ytAdminControlsEnabled = settings.ytAdminControlsEnabled;
    const setYtAdminControlsEnabled = settings.setYtAdminControlsEnabled;
    const loadFromServer = settings.loadFromServer;
    const syncToServer = settings.syncToServer;

    const hasLoadedRef = useRef(false);
    const prevValueRef = useRef(ytStatusVisible);
    const prevModeRef = useRef<YtStatusMode>(ytStatusMode);
    const prevAdminControlsEnabledRef = useRef(ytAdminControlsEnabled);

    useEffect(() => {
        if (!hasLoadedRef.current) {
            hasLoadedRef.current = true;
            prevValueRef.current = ytStatusVisible;
            prevAdminControlsEnabledRef.current = ytAdminControlsEnabled;
            if (typeof loadFromServer === 'function') loadFromServer();
            return;
        }

        if (prevValueRef.current !== ytStatusVisible) {
            prevValueRef.current = ytStatusVisible;
            if (typeof syncToServer === 'function') syncToServer();
        }

        if (prevModeRef.current !== ytStatusMode) {
            prevModeRef.current = ytStatusMode;
            if (typeof syncToServer === 'function') syncToServer();
        }

        if (prevAdminControlsEnabledRef.current !== ytAdminControlsEnabled) {
            prevAdminControlsEnabledRef.current = ytAdminControlsEnabled;
            if (typeof syncToServer === 'function') syncToServer();
        }
    }, [loadFromServer, syncToServer, ytAdminControlsEnabled, ytStatusVisible, ytStatusMode]);

    return {
        setYtAdminControlsEnabled,
        setYtStatusMode,
        setYtStatusVisible,
        ytAdminControlsEnabled,
        ytStatusMode,
        ytStatusVisible,
    };
}
