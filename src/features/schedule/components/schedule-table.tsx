import type { Schedule, ScheduleItem } from "../types/schedule";
import { DEFAULT_SCHEDULE } from "../utils/schedule-config";
import { getCurrentTimeMs, timeToMs } from "../utils/time-calculations";

interface ScheduleTableProps {
  schedule?: Schedule;
}

export const ScheduleTable = ({
  schedule = DEFAULT_SCHEDULE,
}: ScheduleTableProps) => {
  const currentTimeMs = getCurrentTimeMs();

  const formatTime = (item: ScheduleItem) => {
    const { hours, minutes, seconds } = item.startTime;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  const isCurrentItem = (item: ScheduleItem, index: number) => {
    const itemStartMs = timeToMs(item.startTime);
    const nextItemStartMs =
      index + 1 < schedule.items.length
        ? timeToMs(schedule.items[index + 1].startTime)
        : Infinity;

    return currentTimeMs >= itemStartMs && currentTimeMs < nextItemStartMs;
  };

  const getRowClass = (item: ScheduleItem, index: number) => {
    if (isCurrentItem(item, index)) {
      return item.type === "class"
        ? "bg-primary bg-opacity-20"
        : "bg-secondary bg-opacity-20";
    }
    return "";
  };

  const getTypeIcon = (type: string) => {
    return type === "class" ? "📚" : "☕";
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title justify-center mb-4">📅 今日の時間割</h2>

        <div className="overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>時刻</th>
                <th>内容</th>
                <th>種類</th>
              </tr>
            </thead>
            <tbody>
              {schedule.items.map((item, index) => (
                <tr key={index} className={getRowClass(item, index)}>
                  <td className="font-mono">{formatTime(item)}</td>
                  <td className="font-semibold">
                    {isCurrentItem(item, index) && (
                      <span className="badge badge-xs badge-primary mr-2">
                        NOW
                      </span>
                    )}
                    {item.label}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span>{getTypeIcon(item.type)}</span>
                      <span
                        className={`badge badge-sm ${
                          item.type === "class"
                            ? "badge-primary"
                            : "badge-secondary"
                        }`}
                      >
                        {item.type === "class" ? "授業" : "休憩"}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
