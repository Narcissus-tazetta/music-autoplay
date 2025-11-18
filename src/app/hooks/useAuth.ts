import { useAdminStore } from "@/shared/stores/adminStore";

interface UseAuthResult {
  isAdmin: boolean;
  userName?: string;
  showLogout: boolean;
  handleLogout: () => void;
}

const handleLogout = (): void => {
  try {
    const isAdmin = useAdminStore.getState().isAdmin;
    if (isAdmin) useAdminStore.getState().logout();
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
  }
};

export function useAuth(userName?: string): UseAuthResult {
  const isAdmin = useAdminStore((s) => s.isAdmin);
  const showLogout = !!userName || isAdmin;

  return {
    isAdmin,
    userName,
    showLogout,
    handleLogout,
  };
}
