import { SERVER_ENV } from '@/server/env.server';
import logger from '@/server/logger.server';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { z } from 'zod';

const MAX_TEXTS = 80;
const MAX_TEXT_LENGTH = 200;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 5_000;

const FuriganaRequestSchema = z.object({
    texts: z.array(z.string().min(1).max(MAX_TEXT_LENGTH)).max(MAX_TEXTS),
});

const FuriganaResponseSchema = z.object({
    furigana: z.string().optional(),
});

/**
 * Keyed by caller-supplied text, so it needs a ceiling: entries only expire when the same
 * text is looked up again, and a caller can mint 80 new keys per request.
 */
const memoryCache = new Map<string, { furigana: string; ts: number }>();

const rememberFurigana = (text: string, furigana: string): void => {
    memoryCache.set(text, { furigana, ts: Date.now() });
    if (memoryCache.size <= CACHE_MAX_ENTRIES) return;

    const now = Date.now();
    for (const [key, entry] of memoryCache) if (now - entry.ts > CACHE_TTL_MS) memoryCache.delete(key);
    // Still over budget once the expired entries are gone: drop the oldest insertions.
    for (const key of memoryCache.keys()) {
        if (memoryCache.size <= CACHE_MAX_ENTRIES) break;
        memoryCache.delete(key);
    }
};

export const loader = async (_args: LoaderFunctionArgs) => {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
};

export const action = async ({ request }: ActionFunctionArgs) => {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = FuriganaRequestSchema.safeParse(body);
    if (!parsed.success)
        return Response.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 });

    const uniqueTexts = [...new Set(parsed.data.texts.map(text => text.trim()).filter(Boolean))];
    const lookups = await Promise.all(
        uniqueTexts.map(async text => [text, await getFurigana(text)] as const),
    );

    return Response.json({
        readings: Object.fromEntries(
            lookups.filter(([, lookup]) => lookup.furigana.length > 0).map(([text, lookup]) => [text, lookup.furigana]),
        ),
        unavailable: lookups.filter(([, lookup]) => lookup.failed).map(([text]) => text),
    });
};

/**
 * `failed` separates a lookup that could not be made from one that succeeded without a
 * reading. Texts with no kana to add legitimately come back empty, so the client needs this
 * to tell them apart from an outage.
 */
async function getFurigana(text: string): Promise<{ furigana: string; failed: boolean }> {
    const cached = memoryCache.get(text);
    if (cached && Date.now() - cached.ts <= CACHE_TTL_MS) return { furigana: cached.furigana, failed: false };

    try {
        const url = new URL(SERVER_ENV.YAHOO_FURIGANA_ENDPOINT);
        url.searchParams.set('q', text);
        const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
        if (!response.ok) return { furigana: '', failed: true };

        const parsed = FuriganaResponseSchema.safeParse(await response.json());
        if (!parsed.success) return { furigana: '', failed: true };

        const furigana = parsed.data.furigana?.trim() ?? '';
        if (furigana) rememberFurigana(text, furigana);
        return { furigana, failed: false };
    } catch (error) {
        logger.debug('furigana lookup failed', { error });
        return { furigana: '', failed: true };
    }
}
