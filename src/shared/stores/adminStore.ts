import { create } from 'zustand';

export type SessionRole = 'admin' | 'pathfinder';

export interface AdminStore {
    /** Single source of truth; the capability flags below are derived from it. */
    roles: SessionRole[];
    isAdmin: boolean;
    /** Pathfinder features (insert position, reorder, request logs) — granted to admin and pathfinder roles. */
    hasPathfinderAccess: boolean;
    setRoles: (roles: SessionRole[]) => void;
    setIsAdmin: (v: boolean) => void;
    logout: () => void;
}

const deriveRoleState = (roles: SessionRole[]) => {
    const unique = [...new Set(roles)];
    return {
        hasPathfinderAccess: unique.includes('admin') || unique.includes('pathfinder'),
        isAdmin: unique.includes('admin'),
        roles: unique,
    };
};

export const useAdminStore = create<AdminStore>(set => ({
    ...deriveRoleState([]),
    logout: () => {
        set(deriveRoleState([]));
    },
    setIsAdmin: (v: boolean) => {
        set(state => deriveRoleState(v ? [...state.roles, 'admin'] : state.roles.filter(r => r !== 'admin')));
    },
    setRoles: (roles: SessionRole[]) => {
        set(deriveRoleState(roles));
    },
}));

export default useAdminStore;
