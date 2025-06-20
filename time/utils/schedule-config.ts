import type { Schedule, ScheduleItem, Time } from "../types/schedule";

// 時間を作成するヘルパー関数
const createTime = (hours: number, minutes: number, seconds: number = 0): Time => ({
  hours,
  minutes,
  seconds,
});

// スケジュールアイテムを作成するヘルパー関数
const createScheduleItem = (label: string, type: "class" | "rest", time: Time): ScheduleItem => ({
  label,
  type,
  startTime: time,
});

export const DEFAULT_SCHEDULE: Schedule = {
  items: [
    createScheduleItem("朝礼前", "rest", createTime(9, 0, 0)),
    createScheduleItem("朝礼開始", "rest", createTime(9, 30, 0)),
    createScheduleItem("0", "class", createTime(9, 45, 0)),
    createScheduleItem("1時間目休憩", "rest", createTime(10, 35, 0)),
    createScheduleItem("1", "class", createTime(10, 45, 0)),
    createScheduleItem("2時間目休憩", "rest", createTime(11, 35, 0)),
    createScheduleItem("2", "class", createTime(11, 45, 0)),
    createScheduleItem("昼休み", "rest", createTime(12, 35, 0)),
    createScheduleItem("3", "class", createTime(13, 15, 0)),
    createScheduleItem("4時間目休憩", "rest", createTime(14, 5, 0)),
    createScheduleItem("4", "class", createTime(14, 15, 0)),
    createScheduleItem("5時間目休憩", "rest", createTime(15, 5, 0)),
    createScheduleItem("5", "class", createTime(15, 15, 0)),
    createScheduleItem("終礼時", "rest", createTime(16, 5, 0)),
    createScheduleItem("終礼", "rest", createTime(16, 20, 0)),
    createScheduleItem("終礼後", "rest", createTime(16, 30, 0)),
    createScheduleItem("放課後", "rest", createTime(17, 30, 0)),
  ],
};
