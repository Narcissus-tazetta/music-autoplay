import {
  getProgressClass,
  calculateProgressValue,
  type ProgressColor,
} from "~/utils/time/progress-utils";

interface ProgressBarProps {
  show: boolean;
  color: ProgressColor;
  remainingMs?: number | null;
  isClient: boolean;
}

/**
 * 進捗バーを表示するコンポーネント
 */
export function ProgressBar({ show, color, remainingMs, isClient }: ProgressBarProps) {
  if (!isClient || !show) return null;

  const progressClass = getProgressClass(color);
  const progressValue = calculateProgressValue(remainingMs);

  return (
    <div className="w-80 max-w-full mx-auto mt-6">
      <progress
        className={`progress w-full h-3 ${progressClass}`}
        value={progressValue}
        max="100"
      />
      <div className="text-xs opacity-60 mt-1">進捗</div>
    </div>
  );
}
