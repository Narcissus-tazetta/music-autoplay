import type { RateLimiter } from '@/server/services/rateLimiter';
import type { SocketServerInstance } from '@/server/socket/socketServer';
import { createContext } from 'react-router';
import type { RouterContext } from 'react-router';

export interface ServerContext {
    io: SocketServerInstance;
    httpRateLimiter: RateLimiter;
    /** Per-request CSP nonce; every inline script the document emits must carry it. Production only. */
    cspNonce: string | undefined;
}

const SERVER_CONTEXT_KEY = Symbol.for('music-auto-play.serverContext');

const globalServerContext = globalThis as typeof globalThis & {
    [SERVER_CONTEXT_KEY]?: RouterContext<ServerContext>;
};

export const serverContext = globalServerContext[SERVER_CONTEXT_KEY]
    ?? (globalServerContext[SERVER_CONTEXT_KEY] = createContext<ServerContext>());
