import { getRateLimitKey } from '@/server/requesterIdentity.server';
import { anonymousIdCookie } from '@/server/sessions.server';
import { describe, expect, test } from 'bun:test';

const request = (headers: Record<string, string> = {}) => new Request('http://localhost/api/music/add', { headers });

const anonCookie = async (id: string) => (await anonymousIdCookie.serialize(id)).split(';')[0];

describe('getRateLimitKey', () => {
    test('is stable for the same signed anonymous identity', async () => {
        const cookie = await anonCookie('11111111-1111-4111-8111-111111111111');

        const first = await getRateLimitKey(request(), cookie);
        const second = await getRateLimitKey(request(), cookie);

        expect(first).toBe(second);
        expect(first.startsWith('id:')).toBe(true);
    });

    test('separates distinct identities', async () => {
        const a = await anonCookie('11111111-1111-4111-8111-111111111111');
        const b = await anonCookie('22222222-2222-4222-8222-222222222222');

        expect(await getRateLimitKey(request(), a)).not.toBe(await getRateLimitKey(request(), b));
    });

    test('an unsigned session cookie cannot mint a fresh bucket', async () => {
        // The whole point of the key: a caller rotating cookie values it made up must keep
        // landing in the same bucket instead of resetting its allowance every request.
        const first = await getRateLimitKey(request(), '__session=forged-value-one');
        const second = await getRateLimitKey(request(), '__session=forged-value-two');
        const third = await getRateLimitKey(request(), 'theme=forged-value-three');

        expect(first).toBe(second);
        expect(second).toBe(third);
    });

    test('falls back to the address the trusted proxy reported', async () => {
        const withoutCookies = await getRateLimitKey(request(), null);

        expect(withoutCookies.startsWith('ip:')).toBe(true);
    });
});
