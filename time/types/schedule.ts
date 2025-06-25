export interface Time {
  hours: number;
  minutes: number;
  seconds: number;
}

export interface ScheduleItem {
  label: string;
  type: "class" | "rest";
  startTime: Time;
}

export interface ClassStatus {
  type: "class" | "rest" | "finished" | "before" | "closed";
  current?: ScheduleItem;
  next?: ScheduleItem;
  timeRemaining?: string;
  remainingMs?: number;
  totalDurationMs?: number;
}

export interface Schedule {
  items: ScheduleItem[];
}
