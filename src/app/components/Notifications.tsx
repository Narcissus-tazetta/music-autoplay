import { useNotifications } from '@/app/hooks/useNotifications';

export function Notifications() {
    const { notification, dismissNotification } = useNotifications();
    return (
        <div
            className='fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-100'
            aria-live='polite'
            aria-atomic='true'
        >
            {notification && (
                <div
                    role={notification.level === 'error' ? 'alert' : 'status'}
                    className='flex items-start gap-3 rounded-xl border border-border bg-background p-4 text-foreground shadow-lg'
                >
                    <p className='min-w-0 flex-1 break-words text-sm'>{notification.message}</p>
                    <button
                        type='button'
                        aria-label='通知を閉じる'
                        onClick={dismissNotification}
                        className='shrink-0 rounded px-2 text-muted-foreground hover:text-foreground'
                    >
                        ×
                    </button>
                </div>
            )}
        </div>
    );
}
