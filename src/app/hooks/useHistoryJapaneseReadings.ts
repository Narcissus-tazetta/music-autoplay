import type { HistoryItem } from '@/shared/types/history';
import { useEffect, useMemo, useState } from 'react';

export type HistoryReadingMap = Record<string, string[]>;

const MAX_READING_TEXTS = 80;
type ReadingLookupState = Record<string, string | null>;

export function useHistoryJapaneseReadings(items: HistoryItem[], enabled: boolean): HistoryReadingMap {
    const [readings, setReadings] = useState<ReadingLookupState>({});

    const texts = useMemo(() => {
        if (!enabled) return [];
        const unique = new Set<string>();
        for (const item of items) {
            addText(unique, item.title);
            addText(unique, item.channelName);
            addText(unique, item.requesterName);
        }
        return [...unique].slice(0, MAX_READING_TEXTS);
    }, [enabled, items]);

    useEffect(() => {
        if (!enabled || texts.length === 0) return;
        const missing = texts.filter(text => readings[text] === undefined);
        if (missing.length === 0) return;

        const controller = new AbortController();
        void fetch('/api/search/furigana', {
            body: JSON.stringify({ texts: missing }),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            signal: controller.signal,
        })
            .then(async response => {
                if (!response.ok) {
                    setReadings(current => markFetched(current, missing, {}));
                    return;
                }
                const data = await response.json() as { readings?: Record<string, string> };
                setReadings(current => markFetched(current, missing, data.readings ?? {}));
            })
            .catch(error => {
                if (error instanceof DOMException && error.name === 'AbortError') return;
            });

        return () => controller.abort();
    }, [enabled, readings, texts]);

    return useMemo(() => {
        const map: HistoryReadingMap = {};
        for (const item of items) {
            const values = [readings[item.title], readings[item.channelName ?? ''], readings[item.requesterName ?? '']]
                .filter((value): value is string => typeof value === 'string' && value.length > 0);
            if (values.length > 0) map[item.id] = values;
        }
        return map;
    }, [items, readings]);
}

function addText(values: Set<string>, input: string | undefined): void {
    const value = input?.trim();
    if (!value || value.length < 2) return;
    values.add(value);
}

function markFetched(
    current: ReadingLookupState,
    requestedTexts: string[],
    responseReadings: Record<string, string>,
): ReadingLookupState {
    const next: ReadingLookupState = { ...current };
    for (const text of requestedTexts) {
        const reading = responseReadings[text]?.trim();
        next[text] = reading && reading.length > 0 ? reading : null;
    }
    return next;
}
