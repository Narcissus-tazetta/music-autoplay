import { useEffect } from 'react';
export function useWindowAppApi(): void {
    useEffect(() => {
        try {
            const win = window as unknown as {
                __app__?: {
                    showToast?: (opts: { level: string; message: string }) => void;
                    navigate?: (to: string) => void;
                };
            };

            const g = win.__app__ || {};

            if (!g.showToast) {
                g.showToast = ({
                    level,
                    message,
                }: {
                    level: string;
                    message: string;
                }) => {
                    if (import.meta.env.DEV) console.warn(`TOAST[${level}]: ${message}`);
                };
            }
            if (!g.navigate) {
                g.navigate = (to: string) => {
                    try {
                        window.history.pushState({}, '', to);
                        window.dispatchEvent(new PopStateEvent('popstate'));
                    } catch {
                        window.location.href = to;
                    }
                };
            }
            win.__app__ = g;
        } catch (error) {
            if (import.meta.env.DEV) console.error('window.__app__ init failed', error);
        }
    }, []);
}
