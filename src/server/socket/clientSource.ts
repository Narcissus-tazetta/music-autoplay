export type ClientSource = 'extension' | 'browser' | 'unknown';

/**
 * What kind of client is on the other end, from the handshake Origin.
 *
 * This is a classification for logging and for skipping requester identity on extension
 * connections — not an authentication check. A non-browser client can send any Origin it
 * likes; what actually gates a connection is the allowed-origin list in `core/cors.ts`.
 */
export const classifyClientSource = (origin: string | undefined): ClientSource => {
    if (typeof origin !== 'string' || origin.length === 0) return 'unknown';
    if (origin.startsWith('chrome-extension://')) return 'extension';
    return 'browser';
};
