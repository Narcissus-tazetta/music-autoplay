import { getRateLimitKey } from '@/server/requesterIdentity.server';
import { anonymousIdCookie, loginSession } from '@/server/sessions.server';
import { describe, expect, test } from 'bun:test';

const request = (headers: Record<string, string> = {}) =>
    new Request('http://localhost/api/music/add', { headers: { 'x-forwarded-for': '203.0.113.7', ...headers } });

const anonCookie = async (id: string) => (await anonymousIdCookie.serialize(id)).split(';')[0];

const userCookie = async (id: string) => {
    const session = await loginSession.getSession(null);
    session.set('user', { email: 'test@example.com', id, name: 'Test User' });
    return loginSession.commitSession(session);
};

describe('getRateLimitKey', () => {
    test('a rotated anonymous cookie from the same address keeps the same bucket', async () => {
        const first = await getRateLimitKey(request(), await anonCookie('11111111-1111-4111-8111-111111111111'));
        const rotated = await getRateLimitKey(request(), await anonCookie('22222222-2222-4222-8222-222222222222'));

        expect(first).toBe(rotated);
        expect(first.startsWith('ip:')).toBe(true);
    });

    test('a request without any cookie uses the address bucket', async () => {
        expect((await getRateLimitKey(request(), null)).startsWith('ip:')).toBe(true);
    });

    test('signed-in identities are keyed per user', async () => {
        const a = await getRateLimitKey(request(), await userCookie('google-user-a'));
        const b = await getRateLimitKey(request(), await userCookie('google-user-b'));

        expect(a.startsWith('id:')).toBe(true);
        expect(a).not.toBe(b);
    });

    test('an unsigned session cookie cannot mint a fresh bucket', async () => {
        // A caller rotating cookie values it made up must keep landing in the same bucket
        // instead of resetting its allowance every request.
        const first = await getRateLimitKey(request(), '__session=forged-value-one');
        const second = await getRateLimitKey(request(), '__session=forged-value-two');
        const third = await getRateLimitKey(request(), 'theme=forged-value-three');

        expect(first).toBe(second);
        expect(second).toBe(third);
    });
});
