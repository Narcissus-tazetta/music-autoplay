import 'socket.io';

declare module 'socket.io' {
    interface SocketData {
        requesterHash?: string;
        requesterName?: string;
        clientSource?: 'extension' | 'browser' | 'unknown';
    }
}
