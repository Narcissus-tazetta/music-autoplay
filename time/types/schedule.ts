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
  timeRemaining?: string; // "1時間23分45.67秒"
  remainingMs?: number; // ミリ秒での残り時間
}

export interface Schedule {
  items: ScheduleItem[];
}
