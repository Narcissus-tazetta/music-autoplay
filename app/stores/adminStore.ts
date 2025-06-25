import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AdminState {
  isAdmin: boolean;
  setIsAdmin: (status: boolean) => void;
  logout: () => void;
  updateSettings: (values: Partial<Omit<AdminState, "updateSettings" | "logout">>) => void;
}

// デフォルト値を一元管理
export const DEFAULT_ADMIN_STATE: Omit<AdminState, "setIsAdmin" | "logout" | "updateSettings"> = {
  isAdmin: false,
};

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => {
      const base = { ...DEFAULT_ADMIN_STATE };
      // setter自動生成
      const setters: Partial<AdminState> = {};
      (Object.keys(base) as (keyof typeof base)[]).forEach((key) => {
        const setterName = "set" + key.charAt(0).toUpperCase() + key.slice(1);
        // @ts-expect-error 型安全性はinterfaceで担保
        setters[setterName] = (value: any) => set({ [key]: value });
      });
      return {
        ...base,
        ...setters,
        logout: () => set({ isAdmin: false }),
        updateSettings: (values) => set(values),
      } as AdminState;
    },
    {
      name: "admin-storage",
      version: 1,
      partialize: (state) => ({ isAdmin: state.isAdmin }),
      migrate: (persistedState, _version) => {
        return persistedState;
      },
    }
  )
);
