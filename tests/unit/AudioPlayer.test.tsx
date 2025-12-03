import type { RemoteStatus } from '@/shared/stores/musicStore';
import { formatSecondsToTime } from '@/shared/utils/format';
import { describe, expect, test } from 'bun:test';

describe('AudioPlayer utilities', () => {
    test('formatSecondsToTime: 秒数を M:SS 形式に変換', () => {
        expect(formatSecondsToTime(0)).toBe('0:00');
        expect(formatSecondsToTime(30)).toBe('0:30');
        expect(formatSecondsToTime(90)).toBe('1:30');
        expect(formatSecondsToTime(150)).toBe('2:30');
    });

    test('formatSecondsToTime: 1時間以上の場合 H:MM:SS 形式に変換', () => {
        expect(formatSecondsToTime(3600)).toBe('1:00:00');
        expect(formatSecondsToTime(3661)).toBe('1:01:01');
        expect(formatSecondsToTime(7200)).toBe('2:00:00');
        expect(formatSecondsToTime(7384)).toBe('2:03:04');
    });

    test('formatSecondsToTime: 負の値は 0:00 を返す', () => {
        expect(formatSecondsToTime(-10)).toBe('0:00');
        expect(formatSecondsToTime(-100)).toBe('0:00');
    });

    test('formatSecondsToTime: 無限大や NaN は 0:00 を返す', () => {
        expect(formatSecondsToTime(Infinity)).toBe('0:00');
        expect(formatSecondsToTime(NaN)).toBe('0:00');
    });

    test('進捗率計算: currentTime / duration * 100', () => {
        const calculateProgress = (currentTime: number, duration: number) => {
            if (duration <= 0) return 0;
            return Math.min((currentTime / duration) * 100, 100);
        };

        expect(calculateProgress(0, 100)).toBe(0);
        expect(calculateProgress(50, 100)).toBe(50);
        expect(calculateProgress(100, 100)).toBe(100);
        expect(calculateProgress(150, 100)).toBe(100); // クランプ
    });

    test('進捗バーの色決定ロジック', () => {
        const getProgressBarColor = (status: RemoteStatus | null) => {
            if (!status) return null;

            const isAdvertisement = status.type === 'playing' && status.isAdvertisement === true;
            const isExternalVideo = status.type === 'playing' && status.isExternalVideo === true;
            const isPaused = status.type === 'paused';

            if (isAdvertisement) return 'bg-yellow-500';
            if (isExternalVideo) return 'bg-purple-500';
            if (isPaused) return 'bg-orange-600';
            return 'bg-emerald-600';
        };

        // 通常再生
        expect(
            getProgressBarColor({
                type: 'playing',
                musicTitle: 'test',
                currentTime: 10,
                duration: 100,
            }),
        ).toBe('bg-emerald-600');

        // 一時停止
        expect(
            getProgressBarColor({
                type: 'paused',
                musicTitle: 'test',
            }),
        ).toBe('bg-orange-600');

        // 広告検出
        expect(
            getProgressBarColor({
                type: 'playing',
                musicTitle: 'test',
                currentTime: 10,
                duration: 100,
                isAdvertisement: true,
            }),
        ).toBe('bg-yellow-500');

        // 外部動画
        expect(
            getProgressBarColor({
                type: 'playing',
                musicTitle: 'test',
                currentTime: 10,
                duration: 100,
                isExternalVideo: true,
            }),
        ).toBe('bg-purple-500');

        // 広告と外部両方の場合、広告が優先
        expect(
            getProgressBarColor({
                type: 'playing',
                musicTitle: 'test',
                currentTime: 10,
                duration: 100,
                isAdvertisement: true,
                isExternalVideo: true,
            }),
        ).toBe('bg-yellow-500');
    });

    test('シーク検出閾値: 5秒以上の差分', () => {
        const SEEK_THRESHOLD = 5;
        const detectSeek = (currentTime: number, localTime: number, threshold: number) => {
            return Math.abs(currentTime - localTime) >= threshold;
        };

        expect(detectSeek(10, 10, SEEK_THRESHOLD)).toBe(false); // 差なし
        expect(detectSeek(10, 11, SEEK_THRESHOLD)).toBe(false); // 1秒差
        expect(detectSeek(10, 14, SEEK_THRESHOLD)).toBe(false); // 4秒差
        expect(detectSeek(10, 15, SEEK_THRESHOLD)).toBe(true); // 5秒差
        expect(detectSeek(10, 20, SEEK_THRESHOLD)).toBe(true); // 10秒差
        expect(detectSeek(100, 50, SEEK_THRESHOLD)).toBe(true); // 50秒差（逆方向）
    });

    test('サムネイル候補URL生成', () => {
        const makeCandidates = (videoId: string, thumbnail?: string): string[] => {
            const candidates: string[] = [];
            if (thumbnail) candidates.push(thumbnail);
            candidates.push(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);
            candidates.push(`https://i.ytimg.com/vi/${videoId}/sddefault.jpg`);
            candidates.push(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
            candidates.push(`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`);
            candidates.push(`https://i.ytimg.com/vi/${videoId}/default.jpg`);
            return candidates;
        };

        const candidates1 = makeCandidates('test123');
        expect(candidates1.length).toBe(5);
        expect(candidates1[0]).toContain('maxresdefault');
        expect(candidates1[4]).toContain('default.jpg');

        const candidates2 = makeCandidates('test123', 'https://custom.com/thumb.jpg');
        expect(candidates2.length).toBe(6);
        expect(candidates2[0]).toBe('https://custom.com/thumb.jpg');
        expect(candidates2[1]).toContain('maxresdefault');
    });

    test('時間補間計算', () => {
        const calculateInterpolatedTime = (
            baseTime: number,
            lastUpdateTimestamp: number,
            currentTimestamp: number,
            playbackRate = 1.0,
        ) => {
            const elapsed = (currentTimestamp - lastUpdateTimestamp) / 1000; // 秒
            return baseTime + elapsed * playbackRate;
        };

        const now = Date.now();
        const baseTime = 100; // 100秒地点

        // 1秒後
        expect(calculateInterpolatedTime(baseTime, now, now + 1000)).toBe(101);

        // 5秒後
        expect(calculateInterpolatedTime(baseTime, now, now + 5000)).toBe(105);

        // 0.5秒後
        expect(calculateInterpolatedTime(baseTime, now, now + 500)).toBe(100.5);

        // 再生レート2.0の場合（ただし実装では使わない）
        expect(calculateInterpolatedTime(baseTime, now, now + 1000, 2.0)).toBe(102);
    });
});
