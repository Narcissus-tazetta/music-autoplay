import { getTodaysApiUsage } from "./apiCounter";

/**
 * サーバー起動時にAPI使用量を表示
 */
export function displayApiUsageStats(): void {
  const apiUsage = getTodaysApiUsage();
  console.log(`📊 YouTube API Usage Today (${apiUsage.date}): ${apiUsage.count} calls`);
}
