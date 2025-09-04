import type { ClassStatus } from "../types/schedule";
import { Card, CardContent, CardTitle } from "../../../components/card";
import { Badge } from "../../../components/badge";

interface CountdownDisplayProps {
  status: ClassStatus;
}

export const CountdownDisplay = ({ status }: CountdownDisplayProps) => {
  const getStatusBadgeVariant = () => {
    switch (status.type) {
      case "class":
        return "default" as const;
      case "rest":
        return "secondary" as const;
      case "before":
        return "outline" as const;
      case "finished":
        return "outline" as const;
      default:
        return "outline" as const;
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
    if (status.current) return status.current.label;
    if (status.next) return `次: ${status.next.label}`;
    return "今日の授業は終了しました";
  };

  return (
    <Card className="shadow-xl">
      <CardContent className="items-center text-center">
        {/* ステータスバッジ */}
        <Badge variant={getStatusBadgeVariant()}>{getStatusText()}</Badge>

        {/* メインテキスト */}
        <CardTitle className="text-3xl font-bold mt-4">
          {getMainText()}
        </CardTitle>

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
            <div className="w-full bg-muted/30 rounded-md h-2 overflow-hidden">
              <div
                className="h-2 bg-primary"
                style={{
                  width: `${Math.max(0, 100 - (status.remainingMs / (60 * 60 * 1000)) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
