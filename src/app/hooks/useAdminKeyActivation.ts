import { useEffect } from 'react';

/**
 * URLパラメータに `?admin=secret` が含まれている場合、Admin モードを有効化する
 */
export function useAdminKeyActivation(): void {
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const adminKey = params.get('admin');
            if (adminKey === 'secret') {
                void import('@/shared/stores/adminStore')
                    .then(({ useAdminStore }) => {
                        useAdminStore.getState().setIsAdmin(true);
                    })
                    .catch(error => {
                        if (import.meta.env.DEV) console.error('adminStore import failed', error);
                    });
            }
        }
    }, []);
}
