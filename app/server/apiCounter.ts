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
  const jstOffset = 9 * 60; // JST = UTC+9
  const jstTime = new Date(now.getTime() + jstOffset * 60 * 1000);
  return jstTime.toISOString().split('T')[0];
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
    // 初期化時に日付チェックを実行
    this.resetIfNewDay();
    log.apiUsage(`📁 API counter: ${this.count} calls today (${this.lastResetDate})`);
    
    // 定期的な保存（開発環境では30秒、本番環境では10秒）
    const saveInterval = process.env.NODE_ENV === 'production' ? 10000 : 30000;
    this.saveInterval = setInterval(() => {
      this.saveToFile();
    }, saveInterval);
  }

  static getInstance(): DailyApiCounter {
    if (!DailyApiCounter.instance) {
      DailyApiCounter.instance = new DailyApiCounter();
    }
    return DailyApiCounter.instance;
  }

  private getTodayDateString(): string {
    return getJSTDateString();
  }

  private loadFromFile(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const fileContent = fs.readFileSync(this.filePath, 'utf8');
        const data: ApiUsageData = JSON.parse(fileContent);
        this.count = data.count || 0;
        this.lastResetDate = data.date || "";
      } else {
        this.count = 0;
        this.lastResetDate = "";
      }
    } catch (error) {
      log.warn("⚠️  Failed to load API usage data:", { 
        error: error instanceof Error ? error.message : String(error) 
      });
      this.count = 0;
      this.lastResetDate = "";
    }
  }

  private saveToFile(force: boolean = false): void {
    try {
      // 強制保存または1秒以上経過した場合のみ保存
      const now = Date.now();
      if (!force && now - this.lastSaveTime < 1000) {
        return; // 1秒以内の連続保存を防ぐ
      }
      
      const data: ApiUsageData = {
        count: this.count,
        date: this.lastResetDate
      };
      const jsonContent = JSON.stringify(data, null, 2);
      
      // メインファイルに保存
      fs.writeFileSync(this.filePath, jsonContent);
      
      // 本番環境でのみバックアップファイルを作成（開発時のViteリロードを防ぐ）
      if (process.env.NODE_ENV === 'production') {
        const backupPath = this.filePath + '.backup';
        fs.writeFileSync(backupPath, jsonContent);
      }
      
      this.lastSaveTime = now;
    } catch (error) {
      log.warn("⚠️  Failed to save API usage data:", { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  private resetIfNewDay(): void {
    const today = this.getTodayDateString();
    if (this.lastResetDate !== today) {
      log.apiUsage(`🔄 New day detected! Resetting API count from ${this.count} to 0`);
      this.count = 0;
      this.lastResetDate = today;
      this.saveToFile(true);
    }
  }

  increment(): number {
    this.resetIfNewDay();
    this.count++;
    this.saveToFile(true); // 強制保存で確実にディスクに書き込み
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
  const today = getJSTDateString(); // 共通のJST日付取得関数を使用
  
  return {
    count: counter.getCount(),
    date: today  // JST基準の今日の日付を返す
  };
}

/**
 * アプリケーション終了時のクリーンアップ
 */
export function cleanupApiCounter(): void {
  const counter = DailyApiCounter.getInstance();
  counter.cleanup();
}

// プロセス終了時の自動クリーンアップ
process.on('SIGINT', cleanupApiCounter);
process.on('SIGTERM', cleanupApiCounter);
process.on('exit', cleanupApiCounter);
