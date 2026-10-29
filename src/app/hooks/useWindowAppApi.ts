import type { UiToastLevel } from '@/shared/utils/apiUi';
import { useEffect, useState } from 'react';

interface Notification {
    level: UiToastLevel;
    message: string;
}

export function useWindowAppApi() {
    const [notification, setNotification] = useState<Notification | null>(null);

    useEffect(() => {
        const win = window as typeof window & {
            __app__?: {
                showToast?: (opts: Notification) => void;
                navigate?: (to: string) => void;
            };
        };
        const previous = win.__app__;
        win.__app__ = {
            ...previous,
            showToast: setNotification,
            navigate: to => {
                window.location.href = to;
            },
        };
        return () => {
            win.__app__ = previous;
        };
    }, []);

    useEffect(() => {
        if (!notification) return;
        const timer = setTimeout(() => setNotification(null), 6000);
        return () => clearTimeout(timer);
    }, [notification]);

    return { notification, dismissNotification: () => setNotification(null) };
}
