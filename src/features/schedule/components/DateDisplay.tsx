import {
  type DateFormatSettings,
  formatCurrentDate,
} from "../../../shared/utils/time/date-formatter";

interface DateDisplayProps extends DateFormatSettings {
  show: boolean;
}

/**
 * 現在の日付を表示するコンポーネント
 */
export function DateDisplay({ show, ...formatSettings }: DateDisplayProps) {
  if (!show) return null;

  const currentDate = formatCurrentDate(formatSettings);

  return (
    <div className="text-lg font-medium text-base-content opacity-70">
      {currentDate}
    </div>
  );
}
