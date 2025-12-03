import { beforeEach, describe, expect, test } from 'bun:test';
import { useAdminStore } from '../../src/shared/stores/adminStore';

describe('adminStore', () => {
    test('initial state is not admin', () => {
        useAdminStore.getState().logout();
        const state = useAdminStore.getState();
        expect(state.isAdmin).toBe(false);
    });

    test('setIsAdmin changes admin state', () => {
        useAdminStore.getState().logout();
        const store = useAdminStore.getState();
        expect(store.isAdmin).toBe(false);

        store.setIsAdmin(true);
        expect(useAdminStore.getState().isAdmin).toBe(true);

        store.setIsAdmin(false);
        expect(useAdminStore.getState().isAdmin).toBe(false);
    });

    test('logout resets admin state to false', () => {
        useAdminStore.getState().logout();
        const store = useAdminStore.getState();

        store.setIsAdmin(true);
        expect(useAdminStore.getState().isAdmin).toBe(true);

        store.logout();
        expect(useAdminStore.getState().isAdmin).toBe(false);
    });

    test('state changes are reflected across instances', () => {
        useAdminStore.getState().logout();
        useAdminStore.getState().setIsAdmin(true);

        const state1 = useAdminStore.getState();
        const state2 = useAdminStore.getState();

        expect(state1.isAdmin).toBe(true);
        expect(state2.isAdmin).toBe(true);

        useAdminStore.getState().logout();
    });
});
