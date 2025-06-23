import type { Schedule, ScheduleItem, Time } from "../types/schedule";

const createTime = (hours: number, minutes: number, seconds: number = 0): Time => ({
  hours,
  minutes,
  seconds,
});
const createScheduleItem = (label: string, type: "class" | "rest", time: Time): ScheduleItem => ({
  label,
  type,
  startTime: time,
});

export const DEFAULT_SCHEDULE: Schedule = {
  items: [
    createScheduleItem("始業前", "rest", createTime(8, 30, 0)),
    createScheduleItem("キャンパスが開く", "rest", createTime(9, 0, 0)),
    createScheduleItem("朝礼開始", "rest", createTime(9, 30, 0)),
    createScheduleItem("1時間目", "class", createTime(9, 45, 0)),
    createScheduleItem("1時間目休憩", "rest", createTime(10, 35, 0)),
    createScheduleItem("2時間目", "class", createTime(10, 45, 0)),
    createScheduleItem("2時間目休憩", "rest", createTime(11, 35, 0)),
    createScheduleItem("3時間目", "class", createTime(11, 45, 0)),
    createScheduleItem("昼休み", "rest", createTime(12, 35, 0)),
    createScheduleItem("4時間目", "class", createTime(13, 15, 0)),
    createScheduleItem("4時間目休憩", "rest", createTime(14, 5, 0)),
    createScheduleItem("5時間目", "class", createTime(14, 15, 0)),
    createScheduleItem("5時間目休憩", "rest", createTime(15, 5, 0)),
    createScheduleItem("6時間目", "class", createTime(15, 15, 0)),
    createScheduleItem("終礼", "rest", createTime(16, 5, 0)),
    createScheduleItem("終礼後", "rest", createTime(16, 20, 0)),
    createScheduleItem("放課後", "rest", createTime(16, 30, 0)),
    createScheduleItem("最終下校時間", "rest", createTime(17, 30, 0)),
  ],
};
