/**
 * テスト環境のセットアップ
 * 各テストファイルが実行される前に必要な環境変数を設定します
 */

// テスト実行に必要な最小限の環境変数を設定
process.env.NODE_ENV = "test";
process.env.YOUTUBE_API_KEY = "test-youtube-api-key-for-unit-tests";
process.env.SESSION_SECRET = "test-session-secret-at-least-32-chars-long";
process.env.ADMIN_SECRET =
  "test-admin-secret-must-be-at-least-32-characters-long";
process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
process.env.CLIENT_URL = "http://localhost:3000";
process.env.LOG_LEVEL = "error"; // テスト中はログを最小限に
