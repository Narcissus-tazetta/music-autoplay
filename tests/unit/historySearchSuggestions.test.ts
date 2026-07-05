import {
    getHistorySearchSuggestions,
    hasHistorySearchSuggestions,
    historyItemMatchesSearch,
    shouldShowHistorySearchSuggestions,
} from '@/app/utils/historySearchSuggestions';
import type { HistoryItem } from '@/shared/types/history';
import { describe, expect, test } from 'bun:test';

describe('getHistorySearchSuggestions', () => {
    test('古い履歴データで一部フィールドが欠けていても候補を返す', () => {
        const items = [
            {
                id: 'YOUTUBE0001',
                lastPlayedAt: '2026-06-26T13:35:00.000Z',
                playCount: 1,
                title: 'YouTube Search Suggestion Test',
            },
            {
                channelName: 'Yoich Preview Channel',
                id: 'YOICH000001',
                lastPlayedAt: '2026-06-26T13:36:00.000Z',
                playCount: 1,
                requesterName: 'yoich',
                title: 'Yoich Search Prediction Demo',
            },
        ] as unknown as HistoryItem[];

        expect(getHistorySearchSuggestions(items, 'y')).toContain('YouTube Search Suggestion Test');
        expect(getHistorySearchSuggestions(items, 'y')).toContain('Yoich');
    });

    test('かな/カナ/ローマ字の表記ゆれで履歴を検索できる', () => {
        const item = {
            channelId: 'channel-1',
            channelName: 'ヨルシカ',
            duration: 'PT3M',
            firstPlayedAt: '2026-06-26T13:35:00.000Z',
            id: 'YORUSHIKA1',
            lastPlayedAt: '2026-06-26T13:35:00.000Z',
            playCount: 1,
            title: 'よるしか テスト',
        } satisfies HistoryItem;

        expect(historyItemMatchesSearch(item, 'yorushika')).toBe(true);
        expect(historyItemMatchesSearch(item, 'ヨルシカ')).toBe(true);
        expect(getHistorySearchSuggestions([item], 'yoru')).toContain('ヨルシカ');
    });

    test('Yahooふりがな相当の読みで漢字タイトルを検索できる', () => {
        const item = {
            channelId: 'channel-1',
            channelName: '米津玄師',
            duration: 'PT3M',
            firstPlayedAt: '2026-06-26T13:35:00.000Z',
            id: 'YONEZU0001',
            lastPlayedAt: '2026-06-26T13:35:00.000Z',
            playCount: 1,
            title: '感電',
        } satisfies HistoryItem;

        const readings = { [item.id]: ['よねづけんし', 'かんでん'] };

        expect(historyItemMatchesSearch(item, 'yonezu', readings)).toBe(true);
        expect(historyItemMatchesSearch(item, 'kanden', readings)).toBe(true);
        expect(getHistorySearchSuggestions([item], 'kan', readings)).toContain('かんでん');
    });

    test('候補表示条件: クエリと候補件数', () => {
        expect(hasHistorySearchSuggestions('yor', 3)).toBe(true);
        expect(hasHistorySearchSuggestions('yor', 0)).toBe(false);
        expect(hasHistorySearchSuggestions('   ', 3)).toBe(false);
    });

    test('検索欄にフォーカスがある間だけ候補を表示する', () => {
        expect(shouldShowHistorySearchSuggestions('yor', 3, true)).toBe(true);
        expect(shouldShowHistorySearchSuggestions('yor', 3, false)).toBe(false);
        expect(shouldShowHistorySearchSuggestions('yor', 0, true)).toBe(false);
        expect(shouldShowHistorySearchSuggestions('   ', 3, true)).toBe(false);
    });

    test('匿名自動名は検索候補に出さずhash prefixで検索できる', () => {
        const item = {
            channelId: 'channel-1',
            channelName: 'channel',
            duration: 'PT3M',
            firstPlayedAt: '2026-06-26T13:35:00.000Z',
            id: 'REQUESTER01',
            lastPlayedAt: '2026-06-26T13:35:00.000Z',
            playCount: 1,
            requesterHashPrefix: 'c19f2a44',
            requesterName: 'abc12345...',
            title: 'requester test',
        } satisfies HistoryItem;

        expect(getHistorySearchSuggestions([item], 'abc')).not.toContain('abc12345...');
        expect(historyItemMatchesSearch(item, 'c19f2a44')).toBe(true);
    });
});
