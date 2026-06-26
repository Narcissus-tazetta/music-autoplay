import { SERVER_ENV } from '@/app/env.server';
import logger from '@/server/logger';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { z } from 'zod';

const MAX_TEXTS = 80;
const MAX_TEXT_LENGTH = 200;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const FuriganaRequestSchema = z.object({
    texts: z.array(z.string().min(1).max(MAX_TEXT_LENGTH)).max(MAX_TEXTS),
});

const FuriganaResponseSchema = z.object({
    furigana: z.string().optional(),
});

const memoryCache = new Map<string, { furigana: string; ts: number }>();

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
    const entries = await Promise.all(
        uniqueTexts.map(async text => [text, await getFurigana(text)] as const),
    );

    return Response.json({
        readings: Object.fromEntries(entries.filter(([, furigana]) => furigana.length > 0)),
    });
};

async function getFurigana(text: string): Promise<string> {
    const cached = memoryCache.get(text);
    if (cached && Date.now() - cached.ts <= CACHE_TTL_MS) return cached.furigana;

    try {
        const url = new URL(SERVER_ENV.YAHOO_FURIGANA_ENDPOINT);
        url.searchParams.set('q', text);
        const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
        if (!response.ok) return '';

        const raw = await response.json();
        const parsed = FuriganaResponseSchema.safeParse(raw);
        const furigana = parsed.success ? (parsed.data.furigana?.trim() ?? '') : '';
        if (furigana) memoryCache.set(text, { furigana, ts: Date.now() });
        return furigana;
    } catch (error) {
        logger.debug('furigana lookup failed', { error });
        return '';
    }
}

export default function SearchFuriganaRoute() {
    return null;
}
