import { create } from 'zustand';

export interface AdminStore {
    isAdmin: boolean;
    setIsAdmin: (v: boolean) => void;
    logout: () => void;
}

export const useAdminStore = create<AdminStore>(set => ({
    isAdmin: false,
    logout: () => {
        set({ isAdmin: false });
    },
    setIsAdmin: (v: boolean) => {
        set({ isAdmin: v });
    },
}));

export default useAdminStore;
