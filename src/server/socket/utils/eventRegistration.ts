import type { AppLogger } from '../../logger';

type EventHandler = (data: unknown) => void | Promise<void>;

export function registerSocketEventSafely(
    socketOn: ((...args: unknown[]) => void) | undefined,
    eventName: string,
    handler: EventHandler,
    log: AppLogger,
    context: { socketId: string },
): void {
    if (typeof socketOn !== 'function') return;

    try {
        socketOn(eventName, (data: unknown) => {
            try {
                const result = handler(data);
                if (result && typeof result.catch === 'function') {
                    result.catch(error => {
                        log.warn(`failed to process ${eventName}`, {
                            error: error,
                            socketId: context.socketId,
                        });
                    });
                }
            } catch (error) {
                log.warn(`failed to process ${eventName}`, {
                    error: error,
                    socketId: context.socketId,
                });
            }
        });
    } catch (error) {
        log.debug(`failed to register ${eventName}`, {
            error: error,
            socketId: context.socketId,
        });
    }
}
