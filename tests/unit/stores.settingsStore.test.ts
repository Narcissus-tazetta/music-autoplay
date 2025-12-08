import { describe, expect, test } from 'bun:test';
import { useSettingsStore } from '../../src/shared/stores/settingsStore';

describe('settingsStore', () => {
    test('initial state has default values', () => {
        useSettingsStore.getState().reset();
        const state = useSettingsStore.getState();
        expect(state.ytStatusVisible).toBe(true);
        expect(state.ytStatusMode).toBe('player');
    });

    test('setYtStatusVisible updates visibility state', () => {
        useSettingsStore.getState().reset();
        const store = useSettingsStore.getState();
        expect(store.ytStatusVisible).toBe(true);

        store.setYtStatusVisible(false);
        expect(useSettingsStore.getState().ytStatusVisible).toBe(false);

        store.setYtStatusVisible(true);
        expect(useSettingsStore.getState().ytStatusVisible).toBe(true);
    });

    test('setYtStatusMode updates mode', () => {
        useSettingsStore.getState().reset();
        const store = useSettingsStore.getState();
        expect(store.ytStatusMode).toBe('player');

        store.setYtStatusMode('compact');
        expect(useSettingsStore.getState().ytStatusMode).toBe('compact');

        store.setYtStatusMode('player');
        expect(useSettingsStore.getState().ytStatusMode).toBe('player');
    });

    test('reset restores default values', () => {
        useSettingsStore.getState().reset();
        const store = useSettingsStore.getState();

        store.setYtStatusVisible(false);
        expect(useSettingsStore.getState().ytStatusVisible).toBe(false);

        store.reset();
        expect(useSettingsStore.getState().ytStatusVisible).toBe(true);
        expect(useSettingsStore.getState().ytStatusMode).toBe('player');
    });

    test('loadFromServer updates state', () => {
        useSettingsStore.getState().reset();
        const store = useSettingsStore.getState();

        store.loadFromServer({ ytStatusVisible: false });
        expect(useSettingsStore.getState().ytStatusVisible).toBe(false);
        store.loadFromServer({ ytStatusMode: 'compact' });
        expect(useSettingsStore.getState().ytStatusMode).toBe('compact');

        useSettingsStore.getState().reset();
    });

    test('loadFromServer handles partial updates', () => {
        useSettingsStore.getState().reset();
        const store = useSettingsStore.getState();
        store.setYtStatusVisible(false);

        store.loadFromServer({});
        expect(useSettingsStore.getState().ytStatusVisible).toBe(false);

        useSettingsStore.getState().reset();
    });

    test('syncToServer returns current state', () => {
        useSettingsStore.getState().reset();
        const store = useSettingsStore.getState();
        store.setYtStatusVisible(false);

        const synced = store.syncToServer();
        expect(synced.ytStatusVisible).toBe(false);

        useSettingsStore.getState().reset();
    });

    test('state changes persist across instances', () => {
        useSettingsStore.getState().reset();
        useSettingsStore.getState().setYtStatusVisible(false);

        const state1 = useSettingsStore.getState();
        const state2 = useSettingsStore.getState();

        expect(state1.ytStatusVisible).toBe(false);
        expect(state2.ytStatusVisible).toBe(false);

        useSettingsStore.getState().reset();
    });

    test('syncToServer returns current state including mode', () => {
        useSettingsStore.getState().reset();
        const store = useSettingsStore.getState();
        store.setYtStatusVisible(false);
        store.setYtStatusMode('compact');

        const synced = store.syncToServer();
        expect(synced.ytStatusVisible).toBe(false);
        expect(synced.ytStatusMode).toBe('compact');

        useSettingsStore.getState().reset();
    });
});
