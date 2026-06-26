import type { HistoryItem } from '@/shared/types/history';
import * as wanakana from 'wanakana';

export type HistorySearchReadings = Record<string, readonly string[] | undefined>;

export function getHistorySearchSuggestions(
    items: HistoryItem[],
    query: string,
    readings: HistorySearchReadings = {},
): string[] {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return [];

    const values = new Map<string, string>();
    for (const item of items) {
        for (const value of getHistorySearchValues(item, readings)) {
            addSuggestionValue(values, value);
            addSuggestionTokens(values, value);
        }
    }

    const queryPatterns = getSearchPatterns(query);
    const candidates = Array.from(values.values()).filter(value => {
        const targets = getSearchPatterns(value);
        return queryPatterns.some(pattern => targets.some(target => target.includes(pattern)));
    });
    candidates.sort((a, b) => compareSuggestion(a, b, q));
    return candidates.slice(0, 12);
}

export function historyItemMatchesSearch(
    item: HistoryItem,
    query: string,
    readings: HistorySearchReadings = {},
): boolean {
    const queryPatterns = getSearchPatterns(query);
    if (queryPatterns.length === 0) return true;

    const targets = getHistorySearchValues(item, readings).flatMap(value => getSearchPatterns(value));
    return queryPatterns.some(pattern => targets.some(target => target.includes(pattern)));
}

function getHistorySearchValues(item: HistoryItem, readings: HistorySearchReadings): string[] {
    const requesterName = item.requesterName && isSearchableRequesterName(item.requesterName)
        ? item.requesterName
        : undefined;
    return [
        item.title,
        item.channelName,
        item.id,
        requesterName,
        item.requesterHashPrefix,
        ...(readings[item.id] ?? []),
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function isSearchableRequesterName(name: string): boolean {
    const value = name.trim();
    return value !== 'guest' && !/^[0-9a-f-]{8}\.\.\.$/i.test(value);
}

function getSearchPatterns(input: string): string[] {
    const normalized = input.normalize('NFKC').trim().toLowerCase();
    if (!normalized) return [];

    const hiragana = wanakana.toHiragana(normalized);
    const katakana = wanakana.toKatakana(normalized);
    const romaji = wanakana.toRomaji(hiragana).toLowerCase();

    return [...new Set([normalized, hiragana, katakana, romaji])].filter(Boolean);
}

function compareSuggestion(a: string, b: string, query: string): number {
    const aTargets = getSearchPatterns(a);
    const bTargets = getSearchPatterns(b);
    const aStarts = aTargets.some(target => target.startsWith(query));
    const bStarts = bTargets.some(target => target.startsWith(query));
    if (aStarts !== bStarts) return aStarts ? -1 : 1;
    return a.localeCompare(b, 'ja');
}

function addSuggestionValue(values: Map<string, string>, input: string | undefined): void {
    const value = input?.trim();
    if (!value || value.length < 2) return;
    const key = value.toLowerCase();
    if (!values.has(key)) values.set(key, value);
}

function addSuggestionTokens(values: Map<string, string>, input: string | undefined): void {
    if (!input) return;
    const tokens = input.split(' ');
    for (const token of tokens) addSuggestionValue(values, token);
}
