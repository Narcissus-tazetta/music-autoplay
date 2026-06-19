import {
    ensureAnonymousIdCookie,
    formatAnonymousDisplayName,
    hashRequesterId,
    maskRequesterHash,
    normalizeRequesterDisplayName,
    resolveRequesterIdentity,
} from '@/app/requesterIdentity.server';
import { anonymousIdCookie, loginSession, requesterDisplayNameCookie } from '@/app/sessions.server';
import { afterEach, describe, expect, test } from 'bun:test';

const TEST_ANON_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('requesterIdentity.server', () => {
    afterEach(async () => {
        await anonymousIdCookie.serialize('', { maxAge: 0 });
    });

    test('hashRequesterId は同じ入力で同じ hash を返す', () => {
        const a = hashRequesterId('user-123');
        const b = hashRequesterId('user-123');
        expect(a).toBe(b);
        expect(a).toHaveLength(64);
    });

    test('formatAnonymousDisplayName は先頭8文字 + ... を返す', () => {
        expect(formatAnonymousDisplayName(TEST_ANON_ID)).toBe('550e8400...');
    });

    test('maskRequesterHash は hash をマスクする', () => {
        const hash = hashRequesterId(TEST_ANON_ID);
        expect(maskRequesterHash(hash)).toBe(`${hash.slice(0, 8)}...`);
    });

    test('ensureAnonymousIdCookie は未ログイン時に新しい Cookie を発行する', async () => {
        const result = await ensureAnonymousIdCookie(null);
        expect(result.anonId).toBeString();
        expect(result.setCookieHeader).toBeString();
        expect(result.setCookieHeader).toContain('_anonId=');
    });

    test('ensureAnonymousIdCookie は既存 Cookie を再利用する', async () => {
        const setCookie = await anonymousIdCookie.serialize(TEST_ANON_ID);
        const cookieHeader = setCookie.split(';')[0];
        const result = await ensureAnonymousIdCookie(cookieHeader);
        expect(result.anonId).toBe(TEST_ANON_ID);
        expect(result.setCookieHeader).toBeUndefined();
    });

    test('ensureAnonymousIdCookie は OAuth ログイン時に Cookie を発行しない', async () => {
        const session = await loginSession.getSession(null);
        session.set('user', {
            email: 'test@example.com',
            id: 'google-user-id',
            name: 'Test User',
        });
        const sessionCookie = await loginSession.commitSession(session);
        const result = await ensureAnonymousIdCookie(sessionCookie);
        expect(result.anonId).toBeNull();
        expect(result.setCookieHeader).toBeUndefined();
    });

    test('resolveRequesterIdentity は OAuth ユーザーを優先する', async () => {
        const anonCookie = await anonymousIdCookie.serialize(TEST_ANON_ID);
        const session = await loginSession.getSession(null);
        session.set('user', {
            email: 'test@example.com',
            id: 'google-user-id',
            name: 'Test User',
        });
        const sessionCookie = await loginSession.commitSession(session);
        const cookieHeader = `${sessionCookie}; ${anonCookie.split(';')[0]}`;

        const identity = await resolveRequesterIdentity(cookieHeader);
        expect(identity.requesterHash).toBe(hashRequesterId('google-user-id'));
        expect(identity.requesterName).toBe('Test User');
    });

    test('resolveRequesterIdentity は匿名 Cookie から hash を解決する', async () => {
        const setCookie = await anonymousIdCookie.serialize(TEST_ANON_ID);
        const cookieHeader = setCookie.split(';')[0];
        const identity = await resolveRequesterIdentity(cookieHeader);

        expect(identity.requesterHash).toBe(hashRequesterId(TEST_ANON_ID));
        expect(identity.requesterName).toBe('550e8400...');
    });

    test('resolveRequesterIdentity は表示名 Cookie を優先する', async () => {
        const anonCookie = await anonymousIdCookie.serialize(TEST_ANON_ID);
        const nameCookie = await requesterDisplayNameCookie.serialize('DJ さかな');
        const cookieHeader = `${anonCookie.split(';')[0]}; ${nameCookie.split(';')[0]}`;
        const identity = await resolveRequesterIdentity(cookieHeader);

        expect(identity.requesterHash).toBe(hashRequesterId(TEST_ANON_ID));
        expect(identity.requesterName).toBe('DJ さかな');
    });

    test('normalizeRequesterDisplayName は空白と長さを正規化する', () => {
        expect(normalizeRequesterDisplayName('  DJ　さかな\n')).toBe('DJ さかな');
        expect(normalizeRequesterDisplayName('')).toBeNull();
        expect(normalizeRequesterDisplayName('a'.repeat(30))).toHaveLength(24);
    });

    test('resolveRequesterIdentity は Cookie なしで guest を返す', async () => {
        const identity = await resolveRequesterIdentity(null);
        expect(identity.requesterHash).toBeUndefined();
        expect(identity.requesterName).toBe('guest');
    });
});
