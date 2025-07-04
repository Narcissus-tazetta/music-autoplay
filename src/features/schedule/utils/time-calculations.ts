import type { ClassStatus, Schedule, ScheduleItem, Time } from '../types/schedule';
import { holidays } from './holidays';

// Timeオブジェクトをミリ秒に変換
export const timeToMs = (time: Time): number => {
    return (time.hours * 60 * 60 + time.minutes * 60 + time.seconds) * 1000;
};

// 現在時刻をミリ秒で取得（その日の0:00からの経過時間）
export const getCurrentTimeMs = (now: Date = new Date()): number => {
    return (
        (now.getHours() * 60 * 60 + now.getMinutes() * 60 + now.getSeconds()) * 1000
        + now.getMilliseconds()
    );
};

// 残り時間をミリ秒から文字列に変換（0.01秒単位、固定幅表示）
export const formatTimeRemaining = (remainingMs: number): string => {
    if (remainingMs <= 0) return '00:00.00';

    const totalSeconds = Math.floor(remainingMs / 1000);
    const centiseconds = Math.floor((remainingMs % 1000) / 10);

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = seconds.toString().padStart(2, '0');
    const formattedCentiseconds = centiseconds.toString().padStart(2, '0');

    return `${formattedMinutes}:${formattedSeconds}.${formattedCentiseconds}`;
};

/**
 * 現在の期間の総時間（ミリ秒）を計算
 */
export const calculateCurrentPeriodDuration = (
    currentItem: ScheduleItem,
    nextItem: ScheduleItem | undefined,
): number => {
    if (!nextItem) return 0;

    const currentStartMs = timeToMs(currentItem.startTime);
    const nextStartMs = timeToMs(nextItem.startTime);

    return nextStartMs - currentStartMs;
};

// 次のスケジュールアイテムを見つける
export const findNextItem = (
    schedule: Schedule,
    currentTimeMs: number,
): ScheduleItem | undefined => {
    return schedule.items.find(item => timeToMs(item.startTime) > currentTimeMs);
};

// 現在のスケジュール状況を判定
export const getCurrentStatus = (now: Date = new Date(), schedule: Schedule): ClassStatus => {
    const currentTimeMs = getCurrentTimeMs(now);
    const dayOfWeek = now.getDay();

    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (dayOfWeek === 0 || dayOfWeek === 6 || holidays.includes(todayStr)) return { type: 'closed' };

    let currentItem: ScheduleItem | undefined;
    let nextItem: ScheduleItem | undefined;

    for (let i = 0; i < schedule.items.length; i++) {
        const item = schedule.items[i];
        const itemStartMs = timeToMs(item.startTime);
        const nextItemStartMs = i + 1 < schedule.items.length ? timeToMs(schedule.items[i + 1].startTime) : Infinity;

        if (currentTimeMs >= itemStartMs && currentTimeMs < nextItemStartMs) {
            currentItem = item;
            nextItem = schedule.items[i + 1];
            break;
        }

        if (currentTimeMs < itemStartMs) {
            nextItem = item;
            break;
        }
    }

    if (!currentItem && nextItem) {
        const remainingMs = timeToMs(nextItem.startTime) - currentTimeMs;
        return {
            type: 'before',
            next: nextItem,
            timeRemaining: formatTimeRemaining(remainingMs),
            remainingMs,
        };
    }

    if (currentItem) {
        let remainingMs = 0;
        let totalDurationMs = 0;

        if (nextItem) {
            remainingMs = timeToMs(nextItem.startTime) - currentTimeMs;
            totalDurationMs = calculateCurrentPeriodDuration(currentItem, nextItem);
        }

        return {
            type: currentItem.type,
            current: currentItem,
            next: nextItem,
            timeRemaining: nextItem ? formatTimeRemaining(remainingMs) : undefined,
            remainingMs: nextItem ? remainingMs : undefined,
            totalDurationMs: nextItem ? totalDurationMs : undefined,
        };
    }

    return { type: 'finished' };
};
