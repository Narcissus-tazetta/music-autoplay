import { SERVER_ENV } from '@/server/env.server';

/**
 * The client address as seen by the closest trusted proxy.
 *
 * `X-Forwarded-For` grows left to right, and only the entries appended by our own proxies can
 * be trusted — anything further left is whatever the caller chose to send. Counting
 * `TRUSTED_PROXY_HOPS` back from the right therefore picks the first address we did not let
 * the client write. Reading `ips[0]` instead would let anyone forge their own address, and
 * with it their rate-limit bucket and every IP recorded in the security log.
 */
export function getClientIP(request: Request, trustedProxyHops = SERVER_ENV.TRUSTED_PROXY_HOPS): string {
    if (trustedProxyHops === 0) return 'unknown';

    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
        const ips = forwardedFor.split(',').map(ip => ip.trim()).filter(Boolean);
        const trusted = ips[Math.max(0, ips.length - trustedProxyHops)];
        if (trusted) return trusted;
    }

    const realIP = request.headers.get('x-real-ip');
    if (realIP) return realIP.trim();

    return 'unknown';
}
