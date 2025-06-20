import { ProgressBar } from "./ProgressBar";
import type { ProgressColor } from "~/utils/time/progress-utils";

interface TimeDisplayProps {
  isClient: boolean;
  timeRemaining?: string;
  next?: { label: string } | null;
  current?: { label: string } | null;
  remainingMs?: number | null;
  showRemainingText: boolean;
  showProgress: boolean;
  progressColor: ProgressColor;
}

/**
 * 時間表示（カウントダウン、現在進行中、終了）を管理するコンポーネント
 */
export function TimeDisplay({
  isClient,
  timeRemaining,
  next,
  current,
  remainingMs,
  showRemainingText,
  showProgress,
  progressColor,
}: TimeDisplayProps) {
  // 次の時間割まで残り表示（クライアント側のみ）
  if (isClient && timeRemaining && next) {
    return (
      <>
        {showRemainingText && (
          <div className="text-xl font-bold text-base-content opacity-80">{next.label}まで残り</div>
        )}
        <div className="text-4xl font-mono font-bold text-primary">{timeRemaining}</div>
        <ProgressBar
          show={showProgress}
          color={progressColor}
          remainingMs={remainingMs}
          isClient={isClient}
        />
      </>
    );
  }

  // 現在進行中の場合（クライアント側のみ）
  if (isClient && timeRemaining && !next) {
    return (
      <>
        {showRemainingText && (
          <div className="text-xl font-bold text-base-content opacity-80">
            現在: {current?.label || "不明"}
          </div>
        )}
        <div className="text-4xl font-mono font-bold text-primary">{timeRemaining}</div>
        <ProgressBar
          show={showProgress}
          color={progressColor}
          remainingMs={remainingMs}
          isClient={isClient}
        />
      </>
    );
  }

  // 終了時（クライアント側のみ）
  if (isClient && !timeRemaining) {
    return <div className="text-3xl font-bold text-base-content">終了</div>;
  }

  return null;
}
