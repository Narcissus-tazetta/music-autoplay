import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { Music } from "~/stores/musicStore";
import { log } from "./logger";

/**
 * 音楽リクエストの永続化管理
 * JSONファイルによるデータ保存・復元・自動クリーンアップ機能
 */

interface MusicRequest {
  url: string;
  title: string;
  thumbnail: string;
  channel?: string;
  duration?: string;
  addedAt: string; // ISO 8601 文字列
}

interface MusicData {
  date: string; // YYYY-MM-DD
  requests: MusicRequest[];
  lastUpdated: string; // ISO 8601 文字列
}

const DATA_DIR = join(process.cwd(), "data");
const MUSIC_FILE = join(DATA_DIR, "musicRequests.json");

/**
 * データディレクトリが存在しない場合は作成
 */
function ensureDataDirectory(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
    log.info("📁 Created data directory: " + DATA_DIR);
  }
}

/**
 * 今日の日付を YYYY-MM-DD 形式で取得
 */
function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * JSONファイルから音楽リクエストデータを読み込み
 * 日付が古い場合は自動でクリーンアップ
 */
export function loadMusicRequests(): Music[] {
  ensureDataDirectory();

  if (!existsSync(MUSIC_FILE)) {
    log.info("📋 No existing music requests file found, starting fresh");
    return [];
  }

  try {
    const fileContent = readFileSync(MUSIC_FILE, "utf-8");
    const data: MusicData = JSON.parse(fileContent);
    const today = getTodayDate();

    // 今日のデータかチェック
    if (data.date !== today) {
      log.info(`🗓️  Date changed from ${data.date} to ${today}, clearing old requests`);
      saveMusicRequests([]); // 新しい日付で空のデータを保存
      return [];
    }

    log.info(`📋 Loaded ${data.requests.length} music requests from ${data.date}`);

    // MusicRequest[] を Music[] に変換
    return data.requests.map((request) => ({
      url: request.url,
      title: request.title,
      thumbnail: request.thumbnail,
      channel: request.channel || "",
      duration: request.duration || "",
      addedAt: request.addedAt,
    }));
  } catch (error) {
    log.error("❌ Failed to load music requests:", error as Error);
    return [];
  }
}

/**
 * 音楽リクエストデータをJSONファイルに保存
 */
export function saveMusicRequests(musics: Music[]): void {
  ensureDataDirectory();

  const data: MusicData = {
    date: getTodayDate(),
    requests: musics.map((music) => ({
      url: music.url,
      title: music.title,
      thumbnail: music.thumbnail,
      channel: music.channel || "",
      duration: music.duration || "",
      addedAt: music.addedAt || new Date().toISOString(),
    })),
    lastUpdated: new Date().toISOString(),
  };

  try {
    log.debug(`📂 Saving to: ${MUSIC_FILE}`);
    const jsonString = JSON.stringify(data, null, 2);
    writeFileSync(MUSIC_FILE, jsonString, "utf-8");
    log.info(`💾 Saved ${data.requests.length} music requests to file (${data.date})`);
    log.debug(`📄 JSON content preview: ${jsonString.substring(0, 150)}...`);
  } catch (error) {
    log.error("❌ Failed to save music requests:", error as Error);
  }
}

/**
 * 特定のURLの音楽リクエストを削除（再生完了時）
 */
export function removeMusicRequest(musics: Music[], url: string): Music[] {
  const updatedMusics = musics.filter((music) => music.url !== url);

  if (updatedMusics.length !== musics.length) {
    log.info(`🎵 Removed played music request: ${url}`);
    saveMusicRequests(updatedMusics);
  }

  return updatedMusics;
}

/**
 * 音楽リクエストを追加
 */
export function addMusicRequest(musics: Music[], newMusic: Music): Music[] {
  const updatedMusics = [...musics, newMusic];
  saveMusicRequests(updatedMusics);
  log.info(`🎵 Added music request: "${newMusic.title}"`);
  return updatedMusics;
}

/**
 * 古いリクエストファイルをクリーンアップ（オプション機能）
 * 7日以上古いファイルを削除
 */
export function cleanupOldRequests(): void {
  // 将来的に日付別ファイル（musicRequests-2025-06-23.json）を使う場合の実装例
  // 現在はシンプルに1つのファイルを使用
  log.info("🧹 Cleanup completed (using single file strategy)");
}
