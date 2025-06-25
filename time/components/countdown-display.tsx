import type { ClassStatus } from "../types/schedule";

interface CountdownDisplayProps {
  status: ClassStatus;
}

export const CountdownDisplay = ({ status }: CountdownDisplayProps) => {
  const getStatusBadgeClass = () => {
    switch (status.type) {
      case "class":
        return "badge badge-primary badge-lg";
      case "rest":
        return "badge badge-secondary badge-lg";
      case "before":
        return "badge badge-info badge-lg";
      case "finished":
        return "badge badge-neutral badge-lg";
      default:
        return "badge badge-outline badge-lg";
    }
  };

  const getStatusText = () => {
    switch (status.type) {
      case "class":
        return "授業中";
      case "rest":
        return "休憩中";
      case "before":
        return "授業前";
      case "finished":
        return "終了";
      default:
        return "不明";
    }
  };

  const getMainText = () => {
    if (status.current) {
      return status.current.label;
    }
    if (status.next) {
      return `次: ${status.next.label}`;
    }
    return "今日の授業は終了しました";
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body items-center text-center">
        {/* ステータスバッジ */}
        <div className={getStatusBadgeClass()}>{getStatusText()}</div>

        {/* メインテキスト */}
        <h2 className="card-title text-3xl font-bold mt-4">{getMainText()}</h2>

        {/* カウントダウン */}
        {status.timeRemaining && (
          <div className="mt-6">
            <div className="text-sm opacity-70 mb-2">
              {status.next ? `${status.next.label}まで` : "終了まで"}
            </div>
            <div className="countdown font-mono text-6xl">
              <span className="text-primary">{status.timeRemaining}</span>
            </div>
          </div>
        )}

        {/* 進捗バー */}
        {status.remainingMs && status.next && (
          <div className="w-full mt-6">
            <div className="text-xs opacity-60 mb-1">進捗</div>
            <progress
              className="progress progress-primary w-full"
              value={Math.max(0, 100 - (status.remainingMs / (60 * 60 * 1000)) * 100)}
              max="100"
            ></progress>
          </div>
        )}
      </div>
    </div>
  );
};
