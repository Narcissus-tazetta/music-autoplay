import type { Socket } from 'socket.io';
import type { AppLogger } from '../../logger.server';

type EventHandler = (data: unknown) => void | Promise<void>;

/**
 * Registers an extension event handler that reports its own failures instead of surfacing
 * them as an unhandled rejection: nothing upstream of a socket event can act on them.
 */
export function registerSocketEventSafely(
    socket: Socket,
    eventName: string,
    handler: EventHandler,
    log: AppLogger,
    context: { socketId: string },
): void {
    socket.on(eventName, (data: unknown) => {
        const report = (error: unknown) => {
            log.warn(`failed to process ${eventName}`, { error, socketId: context.socketId });
        };

        try {
            void Promise.resolve(handler(data)).catch(report);
        } catch (error) {
            report(error);
        }
    });
}
