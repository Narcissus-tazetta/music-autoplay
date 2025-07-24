import type { SocketServerInstance } from '@/server/socket';

export interface ServerContext {
    io: SocketServerInstance;
}
