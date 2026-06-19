import '../socketData';
import { resolveRequesterIdentity } from '@/app/requesterIdentity.server';
import type { Socket } from 'socket.io';
import type { ExtendedError, Server as IOServer } from 'socket.io';

const classifyClientSource = (origin: string | undefined): 'extension' | 'browser' | 'unknown' => {
    if (typeof origin !== 'string' || origin.length === 0) return 'unknown';
    if (origin.startsWith('chrome-extension://')) return 'extension';
    return 'browser';
};

export function registerSocketIdentityMiddleware(io: IOServer): void {
    io.use((socket: Socket, next: (err?: ExtendedError) => void) => {
        const origin = typeof socket.handshake.headers.origin === 'string'
            ? socket.handshake.headers.origin
            : undefined;
        const clientSource = classifyClientSource(origin);
        socket.data.clientSource = clientSource;

        if (clientSource === 'extension') {
            next();
            return;
        }

        void resolveRequesterIdentity(socket.handshake.headers.cookie)
            .then(identity => {
                socket.data.requesterHash = identity.requesterHash;
                socket.data.requesterName = identity.requesterName;
                next();
            })
            .catch((error: unknown) => {
                next(error instanceof Error ? error : new Error(String(error)));
            });
    });
}
