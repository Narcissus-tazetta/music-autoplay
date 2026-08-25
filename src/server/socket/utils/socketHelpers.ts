import type { Socket } from 'socket.io';

export function extractTransportName(socket: Socket): string {
    return socket.conn?.transport?.name ?? 'unknown';
}
