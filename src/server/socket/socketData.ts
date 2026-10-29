import 'socket.io';
import type { ClientSource } from './clientSource';

declare module 'socket.io' {
    interface SocketData {
        requesterHash?: string;
        requesterName?: string;
        clientSource?: ClientSource;
    }
}
