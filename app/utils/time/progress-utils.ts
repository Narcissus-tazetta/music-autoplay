/**
 * 進捗バー関連のユーティリティ関数
 */

export type ProgressColor = "green" | "blue" | "yellow" | "pink" | "purple" | "sky";

/**
 * 進捗バーの色に応じたCSSクラス名を取得
 */
export function getProgressClass(color: ProgressColor): string {
  const progressClasses = {
    green: "progress-bright-green",
    blue: "progress-blue-500",
    yellow: "progress-yellow-400",
    pink: "progress-pink-500",
    purple: "progress-purple-500",
    sky: "progress-sky-400",
  };

  return progressClasses[color];
}

/**
 * 残り時間（ミリ秒）から進捗バーの値（0-100）を計算
 */
export function calculateProgressValue(remainingMs?: number | null): number {
  if (!remainingMs) return 0;

  // 50分を基準として進捗を計算
  const maxDurationMs = 50 * 60 * 1000;
  return Math.max(0, 100 - (remainingMs / maxDurationMs) * 100);
}
