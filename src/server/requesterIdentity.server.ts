import {
    anonymousIdCookie,
    type LoginSession,
    loginSession,
    requesterDisplayNameCookie,
    type UserSessionData,
} from '@/server/sessions.server';
import { getClientIP } from '@/server/utils/getClientIP';
import { createHash, randomUUID } from 'node:crypto';

export interface RequesterIdentity {
    requesterHash?: string;
    requesterName: string;
}

export function hashRequesterId(id: string): string {
    return createHash('sha256').update(id).digest('hex');
}

export function formatAnonymousDisplayName(anonId: string): string {
    return `${anonId.slice(0, 8)}...`;
}

export function maskRequesterHash(hash: string): string {
    return `${hash.slice(0, 8)}...`;
}

export function normalizeRequesterDisplayName(input: unknown): string | null {
    if (typeof input !== 'string') return null;
    const withoutControlChars = [...input].filter(char => {
        const code = char.charCodeAt(0);
        return code > 0x1F && code !== 0x7F;
    }).join('');
    const normalized = withoutControlChars
        .normalize('NFKC')
        .replace(/\s+/g, ' ')
        .trim();
    if (normalized.length === 0) return null;
    return normalized.slice(0, 24);
}

async function parseAnonymousId(cookieHeader: string | null | undefined): Promise<string | null> {
    const parsed = await anonymousIdCookie.parse(cookieHeader ?? null);
    return typeof parsed === 'string' && parsed.length > 0 ? parsed : null;
}

async function parseRequesterDisplayName(cookieHeader: string | null | undefined): Promise<string | null> {
    const parsed = await requesterDisplayNameCookie.parse(cookieHeader ?? null);
    return normalizeRequesterDisplayName(parsed);
}

function resolveOAuthIdentity(user: UserSessionData, displayName: string | null): RequesterIdentity {
    return {
        requesterHash: hashRequesterId(user.id),
        requesterName: displayName ?? user.name,
    };
}

function resolveAnonymousIdentity(anonId: string, displayName: string | null): RequesterIdentity {
    return {
        requesterHash: hashRequesterId(anonId),
        requesterName: displayName ?? formatAnonymousDisplayName(anonId),
    };
}

export async function resolveRequesterIdentity(
    cookieHeader: string | null | undefined,
    preloadedSession?: LoginSession,
): Promise<RequesterIdentity> {
    // Callers that already parsed the session cookie pass it in to avoid a second HMAC verify.
    const session = preloadedSession ?? await loginSession.getSession(cookieHeader);
    const user = session.get('user');
    const displayName = await parseRequesterDisplayName(cookieHeader);
    if (user) return resolveOAuthIdentity(user, displayName);

    const anonId = await parseAnonymousId(cookieHeader);
    if (anonId) return resolveAnonymousIdentity(anonId, displayName);

    return { requesterName: displayName ?? 'guest' };
}

export async function ensureAnonymousIdCookie(
    cookieHeader: string | null | undefined,
): Promise<{ anonId: string | null; setCookieHeader?: string }> {
    const session = await loginSession.getSession(cookieHeader);
    if (session.get('user')) return { anonId: null };

    const existing = await parseAnonymousId(cookieHeader);
    if (existing) return { anonId: existing };

    const anonId = randomUUID();
    const setCookieHeader = await anonymousIdCookie.serialize(anonId);
    return { anonId, setCookieHeader };
}

/**
 * The bucket a rate limiter counts against.
 *
 * Only signed-in identities are keyed by identity. An anonymous id is minted for every
 * cookie-less request and costs nothing to repeat, so keying on it would let a client reset
 * its allowance by discarding the cookie; anonymous callers share the bucket of the address
 * the trusted proxy observed instead.
 */
export async function getRateLimitKey(
    request: Request,
    cookieHeader: string | null | undefined,
    preloadedSession?: LoginSession,
): Promise<string> {
    const session = preloadedSession ?? await loginSession.getSession(cookieHeader);
    if (session.get('user')) {
        const { requesterHash } = await resolveRequesterIdentity(cookieHeader, session);
        if (requesterHash) return `id:${requesterHash.slice(0, 16)}`;
    }

    return `ip:${createHash('sha256').update(getClientIP(request)).digest('hex').slice(0, 16)}`;
}
