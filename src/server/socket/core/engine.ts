import logger from '@/server/logger.server';
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Server as IOServer } from 'socket.io';

/**
 * The extension is pinned to whichever socket path it shipped with, so an upgrade aimed at a
 * legacy prefix is rewritten onto the configured one instead of being refused.
 */
export function attachUpgradeRewrite(
    server: HttpServer,
    socketPath: string,
    candidatePrefixes: string[],
): void {
    const legacyPrefixes = candidatePrefixes.filter(prefix => prefix && prefix !== socketPath);
    if (legacyPrefixes.length === 0) return;

    server.on('upgrade', (req: IncomingMessage) => {
        const url = req.url;
        if (!url) return;

        const matched = legacyPrefixes.find(prefix => url.startsWith(prefix));
        if (!matched) return;

        req.url = socketPath + url.slice(matched.length);
        logger.info('upgrade: rewrote socket upgrade url for legacy path', {
            original: url,
            rewritten: req.url,
        });
    });
}

/** Handshakes rejected by `allowRequest`/CORS surface here and nowhere else. */
export function logEngineConnectionErrors(io: IOServer): void {
    io.engine.on('connection_error', (error: { code: number; message: string; req?: IncomingMessage }) => {
        logger.warn('engine connection error', {
            code: error.code,
            message: error.message,
            origin: error.req?.headers.origin,
            url: error.req?.url,
        });
    });
}
