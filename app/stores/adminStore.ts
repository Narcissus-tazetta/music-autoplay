import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * 管理者権限の状態管理
 */
interface AdminState {
  isAdmin: boolean;
  setAdminStatus: (status: boolean) => void;
  logout: () => void;
}

/**
 * 管理者権限用のZustandストア
 * 環境変数による認証システムで管理者権限を制御
 * localStorageで状態を永続化し、次回アクセス時にも適用
 */
export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      isAdmin: false,
      setAdminStatus: (status: boolean) => set({ isAdmin: status }),
      logout: () => set({ isAdmin: false }),
    }),
    {
      name: "admin-storage",
      partialize: (state) => ({ isAdmin: state.isAdmin }),
    }
  )
);
