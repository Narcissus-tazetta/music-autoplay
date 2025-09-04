import { getTodaysApiUsage } from "./apiCounter";
import { log } from "./logger";

/**
 * サーバー起動時にAPI使用量を表示
 */
export function displayApiUsageStats(): void {
  const apiUsage = getTodaysApiUsage();
  log.apiUsage(
    `📊 YouTube API Usage Today (${apiUsage.date}): ${apiUsage.count} calls`,
  );
}
