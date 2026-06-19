import type { RateLimiter } from '@/server/services/rateLimiter';
import type { SocketServerInstance } from '@/server/socket';
import { createContext } from 'react-router';
import type { RouterContext } from 'react-router';

export interface ServerContext {
    io: SocketServerInstance;
    httpRateLimiter: RateLimiter;
}

const SERVER_CONTEXT_KEY = Symbol.for('music-auto-play.serverContext');

const globalServerContext = globalThis as typeof globalThis & {
    [SERVER_CONTEXT_KEY]?: RouterContext<ServerContext>;
};

export const serverContext = globalServerContext[SERVER_CONTEXT_KEY]
    ?? (globalServerContext[SERVER_CONTEXT_KEY] = createContext<ServerContext>());
