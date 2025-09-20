import { create } from "zustand";

export interface AdminStore {
  isAdmin: boolean;
  setIsAdmin: (v: boolean) => void;
  logout: () => void;
}

export const useAdminStore = create<AdminStore>((set) => ({
  isAdmin: false,
  setIsAdmin: (v: boolean) => {
    set({ isAdmin: v });
  },
  logout: () => {
    set({ isAdmin: false });
  },
}));

export default useAdminStore;
