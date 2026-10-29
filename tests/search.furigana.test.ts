import { action } from '@/app/routes/api/search.furigana';
import { afterEach, describe, expect, test } from 'bun:test';

const originalFetch = globalThis.fetch;

const post = (texts: string[]) =>
    action(
        {
            request: new Request('http://localhost/api/search/furigana', {
                body: JSON.stringify({ texts }),
                headers: { 'Content-Type': 'application/json' },
                method: 'POST',
            }),
        } as Parameters<typeof action>[0],
    );

const stubFetch = (handler: (q: string) => Response | Promise<Response>) => {
    globalThis.fetch = ((input: string | URL | Request) => {
        const q = new URL(String(input)).searchParams.get('q') ?? '';
        return Promise.resolve(handler(q));
    }) as typeof fetch;
};

describe('/api/search/furigana', () => {
    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    test('a text with no reading is not reported as unavailable', async () => {
        stubFetch(q => Response.json(q === '漢字テスト' ? { furigana: 'かんじてすと' } : { furigana: '' }));

        const data = await (await post(['漢字テスト', 'plain-latin-title'])).json();

        expect(data.readings).toEqual({ 漢字テスト: 'かんじてすと' });
        expect(data.unavailable).toEqual([]);
    });

    test('a failed lookup is reported as unavailable', async () => {
        stubFetch(q => {
            if (q === 'network-down-title') throw new Error('socket hang up');
            return new Response('boom', { status: 503 });
        });

        const data = await (await post(['network-down-title', 'upstream-error-title'])).json();

        expect(data.readings).toEqual({});
        expect(data.unavailable.toSorted()).toEqual(['network-down-title', 'upstream-error-title']);
    });
});
