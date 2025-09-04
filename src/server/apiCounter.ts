import fs from "fs";
import path from "path";
import { log } from "./logger";

interface ApiUsageData {
  count: number;
  date: string;
}

/**
 * JST基準で今日の日付を取得（共通関数）
 */
function getJSTDateString(): string {
  const now = new Date();
  const jstOffset = 9 * 60;
  const jstTime = new Date(now.getTime() + jstOffset * 60 * 1000);
  return jstTime.toISOString().split("T")[0];
}

/**
 * YouTube Data API使用量トラッキング（1日ごとにリセット、永続化）
 */
export class DailyApiCounter {
  private static instance: DailyApiCounter | null = null;
  private count = 0;
  private lastResetDate = "";
  private readonly filePath = path.join(process.cwd(), "api-usage.json");
  private saveInterval: NodeJS.Timeout | null = null;
  private lastSaveTime = 0;

  private constructor() {
    this.loadFromFile();
    this.resetIfNewDay();
    log.apiUsage(
      `📁 API counter: ${this.count} calls today (${this.lastResetDate})`,
    );

    const saveInterval = process.env.NODE_ENV === "production" ? 10000 : 30000;
    this.saveInterval = setInterval(() => {
      this.saveToFile();
    }, saveInterval);
  }

  static getInstance(): DailyApiCounter {
    if (!DailyApiCounter.instance)
      DailyApiCounter.instance = new DailyApiCounter();
    return DailyApiCounter.instance;
  }

  private getTodayDateString(): string {
    return getJSTDateString();
  }

  private loadFromFile(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const fileContent = fs.readFileSync(this.filePath, "utf8");
        const data = JSON.parse(fileContent) as ApiUsageData;
        this.count = data.count || 0;
        this.lastResetDate = data.date || "";
      } else {
        this.count = 0;
        this.lastResetDate = "";
      }
    } catch (error) {
      log.warn("⚠️  Failed to load API usage data:", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.count = 0;
      this.lastResetDate = "";
    }
  }

  private saveToFile(force: boolean = false): void {
    try {
      const now = Date.now();
      if (!force && now - this.lastSaveTime < 1000) return;

      const data: ApiUsageData = {
        count: this.count,
        date: this.lastResetDate,
      };
      const jsonContent = JSON.stringify(data, null, 2);

      fs.writeFileSync(this.filePath, jsonContent);

      if (process.env.NODE_ENV === "production") {
        const backupPath = this.filePath + ".backup";
        fs.writeFileSync(backupPath, jsonContent);
      }

      this.lastSaveTime = now;
    } catch (error) {
      log.warn("⚠️  Failed to save API usage data:", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private resetIfNewDay(): void {
    const today = this.getTodayDateString();
    if (this.lastResetDate !== today) {
      log.apiUsage(
        `🔄 New day detected! Resetting API count from ${this.count} to 0`,
      );
      this.count = 0;
      this.lastResetDate = today;
      this.saveToFile(true);
    }
  }

  increment(): number {
    this.resetIfNewDay();
    this.count++;
    this.saveToFile(true);
    return this.count;
  }

  getCount(): number {
    this.resetIfNewDay();
    return this.count;
  }

  getResetDate(): string {
    return this.lastResetDate;
  }

  /**
   * プロセス終了時のクリーンアップ
   */
  cleanup(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
    this.saveToFile();
    log.apiUsage(`🧹 API counter cleanup completed`);
  }
}

/**
 * 今日のAPI使用量を取得
 */
export function getTodaysApiUsage(): { count: number; date: string } {
  const counter = DailyApiCounter.getInstance();
  const today = getJSTDateString();

  return {
    count: counter.getCount(),
    date: today,
  };
}

/**
 * アプリケーション終了時のクリーンアップ
 */
export function cleanupApiCounter(): void {
  const counter = DailyApiCounter.getInstance();
  counter.cleanup();
}

process.on("SIGINT", cleanupApiCounter);
process.on("SIGTERM", cleanupApiCounter);
process.on("exit", cleanupApiCounter);
