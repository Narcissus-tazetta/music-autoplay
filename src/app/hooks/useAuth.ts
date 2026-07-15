import type { SessionRole } from '@/shared/stores/adminStore';
import { useAdminStore } from '@/shared/stores/adminStore';

interface UseAuthResult {
    isAdmin: boolean;
    roles: SessionRole[];
    hasPathfinderAccess: boolean;
    userName?: string;
    showLogout: boolean;
    handleLogout: () => void;
}

const handleLogout = (): void => {
    try {
        if (useAdminStore.getState().roles.length > 0) useAdminStore.getState().logout();
    } catch (error) {
        if (import.meta.env.DEV) console.error(error);
    }
};

export function useAuth(userName?: string): UseAuthResult {
    const isAdmin = useAdminStore(s => s.isAdmin);
    const roles = useAdminStore(s => s.roles);
    const hasPathfinderAccess = useAdminStore(s => s.hasPathfinderAccess);
    const showLogout = !!userName || roles.length > 0;

    return {
        handleLogout,
        hasPathfinderAccess,
        isAdmin,
        roles,
        showLogout,
        userName,
    };
}
