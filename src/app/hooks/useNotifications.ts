import type { AppNotification } from '@/app/utils/notifications';
import { useEffect, useState } from 'react';

export function useNotifications() {
    const [notification, setNotification] = useState<AppNotification | null>(null);

    useEffect(() => {
        const receive = (event: Event) => setNotification((event as CustomEvent<AppNotification>).detail);
        window.addEventListener('app-notification', receive);
        return () => window.removeEventListener('app-notification', receive);
    }, []);

    useEffect(() => {
        if (!notification) return;
        const timer = setTimeout(() => setNotification(null), 6000);
        return () => clearTimeout(timer);
    }, [notification]);

    return { notification, dismissNotification: () => setNotification(null) };
}
