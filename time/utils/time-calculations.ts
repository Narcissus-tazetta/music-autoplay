import type { Time, Schedule, ScheduleItem, ClassStatus } from "../types/schedule";

// Timeオブジェクトをミリ秒に変換
export const timeToMs = (time: Time): number => {
  return (time.hours * 60 * 60 + time.minutes * 60 + time.seconds) * 1000;
};

// 現在時刻をミリ秒で取得（その日の0:00からの経過時間）
export const getCurrentTimeMs = (now: Date = new Date()): number => {
  return (
    (now.getHours() * 60 * 60 + now.getMinutes() * 60 + now.getSeconds()) * 1000 +
    now.getMilliseconds()
  );
};

// 残り時間をミリ秒から文字列に変換（0.01秒単位、固定幅表示）
export const formatTimeRemaining = (remainingMs: number): string => {
  if (remainingMs <= 0) return "00:00.00";

  const totalSeconds = Math.floor(remainingMs / 1000);
  const centiseconds = Math.floor((remainingMs % 1000) / 10); // 0.01秒単位

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  // 固定幅でフォーマット（MM:SS.CC）
  const formattedMinutes = minutes.toString().padStart(2, "0");
  const formattedSeconds = seconds.toString().padStart(2, "0");
  const formattedCentiseconds = centiseconds.toString().padStart(2, "0");

  return `${formattedMinutes}:${formattedSeconds}.${formattedCentiseconds}`;
};

// 次のスケジュールアイテムを見つける
export const findNextItem = (
  schedule: Schedule,
  currentTimeMs: number
): ScheduleItem | undefined => {
  return schedule.items.find((item) => timeToMs(item.startTime) > currentTimeMs);
};

// 現在のスケジュール状況を判定
export const getCurrentStatus = (now: Date = new Date(), schedule: Schedule): ClassStatus => {
  const currentTimeMs = getCurrentTimeMs(now);
  const dayOfWeek = now.getDay(); // 0=日曜日, 6=土曜日

  // 土日は授業なし
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { type: "finished" };
  }

  // 現在進行中のアイテムを見つける
  let currentItem: ScheduleItem | undefined;
  let nextItem: ScheduleItem | undefined;

  for (let i = 0; i < schedule.items.length; i++) {
    const item = schedule.items[i];
    const itemStartMs = timeToMs(item.startTime);
    const nextItemStartMs =
      i + 1 < schedule.items.length ? timeToMs(schedule.items[i + 1].startTime) : Infinity;

    if (currentTimeMs >= itemStartMs && currentTimeMs < nextItemStartMs) {
      currentItem = item;
      nextItem = schedule.items[i + 1];
      break;
    }

    // まだ最初のアイテムの時間前の場合
    if (currentTimeMs < itemStartMs) {
      nextItem = item;
      break;
    }
  }

  // 時間前の場合
  if (!currentItem && nextItem) {
    const remainingMs = timeToMs(nextItem.startTime) - currentTimeMs;
    return {
      type: "before",
      next: nextItem,
      timeRemaining: formatTimeRemaining(remainingMs),
      remainingMs,
    };
  }

  // 現在進行中のアイテムがある場合
  if (currentItem) {
    let remainingMs = 0;
    if (nextItem) {
      remainingMs = timeToMs(nextItem.startTime) - currentTimeMs;
    }

    return {
      type: currentItem.type,
      current: currentItem,
      next: nextItem,
      timeRemaining: nextItem ? formatTimeRemaining(remainingMs) : undefined,
      remainingMs: nextItem ? remainingMs : undefined,
    };
  }

  // 全て終了
  return { type: "finished" };
};
