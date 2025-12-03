import type { C2S, S2C } from '@/shared/types/socket';
import { io, type Socket } from 'socket.io-client';

let socket: Socket<S2C, C2S> | null = null;

function attachDebugListeners(s: Socket<S2C, C2S>): void {
    const safeLog = (...args: unknown[]): void => {
        if (import.meta.env.DEV) console.info(...args);
    };

    s.on('connect', () => {
        safeLog('[socket] connect', s.id);
    });
    s.on('connect_error', (err: unknown) => {
        if (import.meta.env.DEV) {
            if (err instanceof Error) console.error('[socket] connect_error', err.message);
            else console.error('[socket] connect_error', String(err));
        }
    });
    s.on('disconnect', reason => {
        safeLog('[socket] disconnect', reason);
    });
}

export function getSocket(): Socket<S2C, C2S> {
    if (!socket) {
        const socketPath = '/api/socket.io';
        const options = {
            autoConnect: false,
            path: socketPath,
            transports: ['websocket', 'polling'],
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
        };
        socket = io(options) as Socket<S2C, C2S>;
        try {
            attachDebugListeners(socket);
        } catch (e: unknown) {
            if (import.meta.env.DEV) console.warn('[socket] failed to attach debug listeners', e);
        }
    }
    return socket;
}
