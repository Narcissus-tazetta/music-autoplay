export interface AppNotification {
    level: 'info' | 'success' | 'warning' | 'error';
    message: string;
}

export function notify(notification: AppNotification): void {
    if (typeof window === 'undefined') {
        console.warn('ブラウザ外の通知', notification);
        return;
    }
    window.dispatchEvent(new window.CustomEvent<AppNotification>('app-notification', { detail: notification }));
}
