import { useClassSchedule } from "../../time/hooks/use-class-schedule";

export function meta() {
  return [
    { title: "残り時間" },
    { name: "description", content: "授業までの残り時間を表示します。" },
  ];
}

export default function Time() {
  const status = useClassSchedule();

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="text-center select-none">
        {status.timeRemaining && (
          <div className="text-6xl font-mono font-bold text-primary">{status.timeRemaining}</div>
        )}
        {!status.timeRemaining && <div className="text-4xl font-bold text-base-content">終了</div>}
      </div>
    </div>
  );
}
