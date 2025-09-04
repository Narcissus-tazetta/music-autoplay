import TimePageLayout from "../../features/schedule/components/TimePageLayout";
import { useClassSchedule } from "../../features/schedule/hooks/use-class-schedule";

export function meta() {
  return [
    { title: "残り時間" },
    { name: "description", content: "授業までの残り時間を表示します。" },
  ];
}

export default function Time() {
  const status = useClassSchedule();

  return <TimePageLayout status={status} />;
}
