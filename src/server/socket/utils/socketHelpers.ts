import type { Socket } from 'socket.io';

export function extractSocketOn(
    socket: Socket,
): ((...args: unknown[]) => void) | undefined {
    try {
        const rec = socket as unknown as Record<string, unknown>;
        const onVal = rec['on'];
        if (typeof onVal === 'function') return (onVal as (...a: unknown[]) => void).bind(socket);
        return undefined;
    } catch {
        return undefined;
    }
}

export function extractTransportName(socket: Socket): string {
    try {
        const rec = socket as unknown as Record<string, unknown>;
        const conn = rec['conn'];
        if (!conn || typeof conn !== 'object') return 'unknown';

        const connObj = conn as Record<string, unknown>;
        const transport = connObj.transport;
        if (!transport || typeof transport !== 'object') return 'unknown';

        const transportObj = transport as Record<string, unknown>;
        const name = transportObj.name;
        return typeof name === 'string' ? name : 'unknown';
    } catch {
        return 'unknown';
    }
}
