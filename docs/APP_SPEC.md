# Music Auto-Play アプリケーション詳細仕様書

---

## 概要

**Music Auto-Play** は、学校の時間割に合わせて自動的に音楽を再生する Web アプリケーションです。生徒や教師が YouTube の楽曲をリクエストでき、管理者が承認・削除を行う仕組みになっています。

### 主要機能

1. **楽曲リクエスト機能** - YouTube URL を入力して楽曲をリクエスト
2. **時間割表示機能** - 現在の授業と残り時間をリアルタイム表示
3. **管理者機能** - 楽曲の承認・削除・再生制御
4. **カスタマイズ機能** - ダークモード、進捗バー、日付表示の詳細設定

---

## ページ構成・UI詳細

### 1. ホームページ (`/home`)

#### 楽曲リクエストフォーム

- **YouTube URL 入力**
  - プレースホルダー: "YouTube の URL を入力してください"
  - バリデーション: YouTube URL 形式チェック
  - 対応形式: `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/live/`
- **管理者コード入力** (オプション)
  - 32文字以上の入力で管理者モードに切り替え
  - 正しいコードで管理者権限を取得
  - 権限は localStorage で永続化

#### 楽曲リスト表示

- **リアルタイム更新**: Socket.IO でサーバーと同期
- **楽曲情報表示**:
  - タイトル
  - チャンネル名
  - 動画時間
  - 追加日時
- **管理者専用機能** (権限がある場合):
  - 楽曲削除ボタン
  - 全削除ボタン
  - 再生状態表示

#### レスポンシブデザイン

- モバイル: 縦並びレイアウト
- デスクトップ: 横並びレイアウト
- タブレット: 適応的レイアウト

### 2. 時間表示ページ (`/time`)

#### 時刻表示

- **現在時刻**: リアルタイム更新 (10ms 間隔)
- **ミリ秒表示**: 固定幅フォーマット (HH:MM:SS.ff)
- **カスタムフォント**: ゲーミング風モノスペース

#### 日付表示 (カスタマイズ可能)

- **年表示**: 西暦/令和/数字のみ/非表示

#### 時間割・進捗表示

- **現在の授業**: 授業名と残り時間
- **次の授業**: 開始時間と授業名

---

## 機能詳細仕様

### 楽曲管理システム

#### リクエスト処理フロー

1. **URL入力**: YouTube URL の貼り付け
2. **バリデーション**: URL形式・動画存在チェック
3. **情報取得**: YouTube Data API で動画情報取得
4. **制限チェック**: 動画時間制限 (設定可能)
5. **リスト追加**: メモリ + JSON ファイル保存
6. **リアルタイム更新**: 全クライアントに Socket.IO 送信

#### 管理者権限システム

- **認証方式**: 環境変数 `ADMIN_SECRET` との照合
- **権限保持**: localStorage での永続化
- **セッション管理**: ページリロード後も権限維持
- **権限機能**:
  - 楽曲個別削除
  - 楽曲全削除
  - 再生状態確認

#### データ永続化

- **日次リセット**: 毎日 00:00 に楽曲リスト初期化
- **ファイル形式**: JSON (型安全な保存)
- **バックアップ**: サーバー再起動時の自動復元

### 時間割システム

#### スケジュール定義

```typescript
interface ClassPeriod {
  name: string; // 授業名
  startTime: string; // 開始時刻 "HH:MM"
  endTime: string; // 終了時刻 "HH:MM"
}
```

#### 標準時間割

- **1限**: 08:40-09:30
- **2限**: 09:40-10:30
- **3限**: 10:40-11:30
- **4限**: 11:40-12:30
- **昼休み**: 12:30-13:20
- **5限**: 13:20-14:10
- **6限**: 14:20-15:10
- **7限**: 15:20-16:10

#### 特別日程対応

- **祝日検出**: 自動的に「祝日」表示
- **土日対応**: 「休日」表示
- **長期休暇**: カスタム設定対応

#### 進捗計算

- **リアルタイム**: 10ms 間隔での進捗更新
- **精密計算**: ミリ秒単位での残り時間計算
- **パーセンテージ**: 授業時間内での進捗率表示

### 設定・カスタマイズ

#### テーマシステム

- **ダークモード**: システム設定連動 + 手動切り替え
- **ちらつき防止**: SSR時のインラインスクリプト
- **トランジション**: 滑らかな色変更アニメーション
- **永続化**: Zustand persist での設定保存

#### 進捗バー設定

- **表示切り替え**: ON/OFF 切り替え
- **色選択**: 6色のカラーパレット
- **アニメーション**: CSS トランジション
- **レスポンシブ**: 画面サイズ対応

#### 日付表示設定

- **項目別設定**: 年/月/日/曜日の個別切り替え
- **フォーマット選択**: 各項目の表示形式選択
- **プレビュー**: 設定画面でのリアルタイム確認
- **組み合わせ**: 自由な表示組み合わせ

### WebSocket (Socket.IO) 仕様

#### イベント定義

**サーバー → クライアント:**

```typescript
// 楽曲リスト初期化
'music-list-update': Music[]

// 楽曲追加通知
'music-added': Music

// 楽曲削除通知
'music-removed': { id: string }

// エラー通知
'error': { message: string }
```

**クライアント → サーバー:**

```typescript
// 楽曲追加リクエスト
'add-music': { url: string, isAdmin: boolean }

// 楽曲削除リクエスト (管理者のみ)
'remove-music': { id: string }

// 楽曲全削除リクエスト (管理者のみ)
'clear-all-music': {}

// 再生状態更新 (管理者のみ)
'update-playback-status': { videoId: string, status: string }
```

#### 接続管理

- **自動再接続**: 接続断時の自動復旧
- **CORS設定**: 本番・開発環境の適切な設定
- **エラーハンドリング**: 接続エラーの適切な処理

---

## データ構造・型定義

### Music (楽曲データ)

```typescript
interface Music {
  id: string; // ユニークID (UUID)
  url: string; // YouTube URL
  title: string; // 動画タイトル
  channel: string; // チャンネル名
  duration: string; // 動画時間 "MM:SS"
  addedAt: Date; // 追加日時
}
```

### ProgressSettings (進捗設定)

```typescript
interface ProgressSettings {
  // 表示切り替え
  showProgress: boolean; // 進捗バー表示
  showRemainingText: boolean; // 残り時間テキスト表示
  showCurrentSchedule: boolean; // 現在の授業表示
  showDate: boolean; // 日付表示

  // 日付詳細設定
  showYear: boolean; // 年表示
  showMonth: boolean; // 月表示
  showDay: boolean; // 日表示
  showWeekday: boolean; // 曜日表示

  // フォーマット設定
  yearFormat: "western" | "reiwa" | "2025" | "none";
  monthFormat: "japanese" | "english" | "number" | "none";
  dayFormat: "japanese" | "number" | "english" | "none";
  weekdayFormat: "short" | "long" | "japanese" | "none";

  // 進捗バー設定
  progressColor: "blue" | "yellow" | "green" | "pink" | "purple" | "sky";

  // 背景画像設定
  showBackgroundImage: boolean;
}
```

### ColorMode (テーマ設定)

```typescript
interface ColorModeState {
  mode: "dark" | "light"; // 現在のモード
  hasHydrated: boolean; // ハイドレーション完了フラグ
  darkClass: string; // CSS クラス名
  setMode: (mode: "dark" | "light") => void;
}
```

### AdminState (管理者状態)

```typescript
interface AdminState {
  isAdmin: boolean; // 管理者権限フラグ
  setIsAdmin: (isAdmin: boolean) => void;
}
```

---

## API仕様

### REST API

#### GET `/api/assets`

システム情報とAPI使用状況を取得

**レスポンス:**

```typescript
{
  api: {
    dailyQuota: number;           // 日次クォータ
    usedToday: number;            // 本日使用量
    remainingToday: number;       // 本日残量
    resetTime: string;            // リセット時刻
  },
  server: {
    uptime: string;               // サーバー稼働時間
    environment: string;          // 環境 (development/production)
    version: string;              // アプリバージョン
  }
}
```

#### GET `/internal/youtube/video-info`

YouTube動画情報を取得

**クエリパラメータ:**

- `url`: YouTube URL (必須)

**レスポンス:**

```typescript
{
  id: string; // 動画ID
  title: string; // タイトル
  channel: string; // チャンネル名
  duration: string; // 動画時間 "MM:SS"
  thumbnail: string; // サムネイルURL
}
```

### YouTube Data API v3 統合

#### 使用エンドポイント

- `videos`: 動画詳細情報取得
- `channels`: チャンネル情報取得

#### クォータ管理

- **日次制限**: 10,000 ユニット/日
- **使用量追跡**: リアルタイム使用量監視
- **コスト最適化**: 必要最小限のフィールド取得

#### キャッシュ戦略

- **動画情報**: メモリキャッシュ (24時間)
- **エラー結果**: 短期キャッシュ (1時間)
- **キャッシュ無効化**: 手動クリア機能

---

## セキュリティ・認証

### 管理者認証

- **認証方式**: 共有シークレット方式
- **環境変数**: `ADMIN_SECRET` で管理
- **セッション**: localStorage での永続化
- **権限チェック**: サーバーサイド検証

### 入力検証・サニタイズ

- **URL検証**: YouTube URL 形式チェック
- **長さ制限**: URL最大長制限
- **文字エスケープ**: XSS対策
- **レート制限**: API呼び出し頻度制限

### CORS設定

```typescript
const corsOptions = {
  origin: [
    "https://music-autoplay.onrender.com", // 本番環境
    "http://localhost:3000", // 開発環境
    "http://localhost:5173", // Vite開発サーバー
  ],
  credentials: true,
};
```

### エラーハンドリング

- **API エラー**: 適切なHTTPステータスコード
- **動画制限**: 時間制限超過の検出
- **ネットワークエラー**: 自動リトライ機能
- **ユーザー通知**: わかりやすいエラーメッセージ

---

## パフォーマンス最適化

### フロントエンド最適化

#### コード分割

- **ページ単位**: React Router による lazy loading
- **コンポーネント単位**: 動的 import での遅延読み込み
- **ライブラリ分割**: vendor bundle の最適化

#### CSS最適化

- **Tailwind CSS**: PurgeCSS による未使用スタイル削除
- **Critical CSS**: インライン重要スタイル
- **CSS-in-JS**: 動的スタイルの最適化

#### 画像最適化

- **IndexedDB**: 大容量画像のブラウザ内保存
- **形式対応**: WebP/AVIF 対応 (将来)
- **遅延読み込み**: 画像の lazy loading

### バックエンド最適化

#### メモリ管理

- **楽曲リスト**: メモリ内キャッシュ
- **API レスポンス**: メモリキャッシュ
- **ガベージコレクション**: 定期的なメモリクリーンアップ

#### データベース最適化

- **JSON ファイル**: 軽量データ永続化
- **IndexedDB**: クライアントサイドストレージ
- **メモリ同期**: ファイル ↔ メモリ同期

#### ネットワーク最適化

- **gzip圧縮**: レスポンス圧縮
- **HTTP/2**: 多重化通信
- **WebSocket**: リアルタイム通信

---

## 運用・監視

### ログシステム

#### ログレベル

- **error**: エラー・例外
- **warn**: 警告・注意事項
- **info**: 一般情報・動作状況
- **debug**: デバッグ情報 (開発時のみ)

#### ログ出力先

- **開発環境**: コンソール出力
- **本番環境**: ファイル出力 (`logs/` ディレクトリ)
- **エラーログ**: 別ファイル分離
- **アクセスログ**: HTTP リクエスト記録

#### 監視項目

- **API使用量**: YouTube API クォータ使用状況
- **接続数**: WebSocket 接続数
- **エラー率**: エラー発生頻度
- **レスポンス時間**: API応答時間

### デプロイ・CI/CD

#### ビルドプロセス

```bash
# 型チェック
bun run typecheck

# 本番ビルド
bun run build

# 本番起動
bun run start
```

#### 環境設定

- **開発環境**: `NODE_ENV=development`
- **本番環境**: `NODE_ENV=production`
- **ポート設定**: `PORT` 環境変数
- **API設定**: `YOUTUBE_API_KEY`, `ADMIN_SECRET`

#### ヘルスチェック

- **エンドポイント**: `/health` (将来実装)
- **項目**: API接続・ファイルアクセス・メモリ使用量
- **自動復旧**: 異常検出時の自動再起動

---

## 開発者向け情報

### セットアップ手順

```bash
# リポジトリクローン
git clone https://github.com/Narcissus-tazetta/music-autoplay.git
cd music-autoplay

# 依存関係インストール
bun install

# 環境変数設定
cp .env.example .env
# .env ファイルを編集

# 開発サーバー起動
bun run dev
```

### コーディング規約

- **TypeScript**: 厳格な型チェック
- **ESLint**: コード品質管理
- **Prettier**: コードフォーマット
- **命名規則**: camelCase (変数), PascalCase (コンポーネント)

### テスト戦略

- **単体テスト**: Jest + React Testing Library
- **統合テスト**: Playwright E2E テスト
- **型テスト**: TypeScript 型チェック
- **手動テスト**: 機能確認・ユーザビリティテスト

---

**作成日:** 2025年7月3日\
**バージョン:** v2.1.0\
**作成者:** Narcissus-tazetta
