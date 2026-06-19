import { getClientIP } from '@/server/utils/getClientIP';
import { createHash, randomUUID } from 'node:crypto';
import { anonymousIdCookie, loginSession, requesterDisplayNameCookie, type UserSessionData } from '~/sessions.server';

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
): Promise<RequesterIdentity> {
    const session = await loginSession.getSession(cookieHeader);
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

export async function getRateLimitKey(
    request: Request,
    cookieHeader: string | null | undefined,
): Promise<string> {
    if (cookieHeader) {
        const sessionMatch = cookieHeader.match(/__session=([^;]+)/);
        if (sessionMatch)
            return `session:${createHash('sha256').update(sessionMatch[1]).digest('hex').substring(0, 16)}`;

        const anonId = await parseAnonymousId(cookieHeader);
        if (anonId) return `anon:${createHash('sha256').update(anonId).digest('hex').substring(0, 16)}`;

        const themeMatch = cookieHeader.match(/theme=([^;]+)/);
        if (themeMatch) return `theme:${createHash('sha256').update(themeMatch[1]).digest('hex').substring(0, 16)}`;
    }

    const userAgent = request.headers.get('user-agent');
    const accept = request.headers.get('accept');
    const acceptLang = request.headers.get('accept-language');
    const clientIP = getClientIP(request);

    const fingerprint = `${clientIP}:${userAgent}:${accept}:${acceptLang}`;
    return `fp:${createHash('sha256').update(fingerprint).digest('hex').substring(0, 16)}`;
}
