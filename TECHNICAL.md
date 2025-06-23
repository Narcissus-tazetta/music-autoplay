# 技術仕様書

## システム概要

音楽自動再生システムは、YouTube動画の再生管理と学校の時間割表示を統合したWebアプリです。

### 🎵 主な機能

- **音楽管理** (`/home`) - YouTube動画の追加・削除・リアルタイム同期
- **時間割表示** (`/time`) - 授業時間のカウントダウン・進捗表示

### 🏗️ 技術スタック

```
┌─────────────────────────────────────────────────────────────┐
│                        フロントエンド                        │
├─────────────────────────────────────────────────────────────┤
│ React Router v7  │ TypeScript    │ Tailwind CSS v4          │
│ Socket.IO Client │ Zustand       │ shadcn/ui                │
│ React Hook Form  │ date-fns      │ IndexedDB                │
└─────────────────────────────────────────────────────────────┘
                                │
                      WebSocket + REST API
                                │
┌─────────────────────────────────────────────────────────────┐
│                        バックエンド                         │
├─────────────────────────────────────────────────────────────┤
│ Node.js          │ Socket.IO     │ Express                  │
│ Winston Logger   │ YouTube API   │ File System             │
└─────────────────────────────────────────────────────────────┘
```

## アーキテクチャ

### 🔄 データフロー

```
ユーザー操作
    │
    ▼
フロントエンド (React)
    │ WebSocket/HTTP
    ▼
バックエンド (Node.js)
    │ HTTPS
    ▼
YouTube Data API
```

### 📁 ディレクトリ構成

```
app/
├── components/         # UIコンポーネント
│   ├── footer/         # フッターコンポーネント
│   ├── home/           # 音楽管理コンポーネント
│   ├── settings/       # 設定関連コンポーネント
│   ├── time/           # 時間表示コンポーネント
│   └── ui/             # 共通UIコンポーネント (shadcn/ui)
├── hooks/              # カスタムフック
│   ├── time/           # 時間表示関連フック
│   ├── use-color-mode.ts        # ダークモード管理
│   ├── use-gaming-toggle.ts     # ゲーミングモード管理
│   ├── use-mobile.ts            # モバイル判定
│   ├── use-progress-settings.ts # 進捗バー設定管理
│   └── use-youtube-status.ts    # YouTube状態管理
├── libs/               # ユーティリティ関数
├── routes/             # ルーティング定義
│   ├── api/            # API エンドポイント
│   ├── home/           # ホーム画面関連
│   ├── home.tsx        # 音楽管理ページ
│   └── time.tsx        # スケジュール管理ページ
├── server/             # サーバーサイドコード
│   ├── handlers/       # Socket.IOハンドラー
│   ├── middleware/     # Expressミドルウェア
│   ├── apiCounter.ts   # API使用量カウンター
│   ├── logger.ts       # ログ設定
│   ├── server.ts       # メインサーバー
│   ├── youtubeApi.ts   # YouTube API統合
│   └── youtubeState.ts # YouTube状態管理
├── stores/             # 状態管理 (Zustand)
│   ├── musicStore.tsx  # 音楽リスト
│   └── adminStore.ts   # 管理者権限
├── utils/              # ユーティリティ関数
│   └── time/           # 時間計算・フォーマット関連
├── types/              # 型定義
├── *.css               # スタイルシート
└── socket.ts           # Socket.IO型定義

time/                   # スケジュール管理専用モジュール
├── components/         # 時間表示コンポーネント
├── hooks/              # 時間計算フック
├── types/              # スケジュール型定義
└── utils/              # 時間計算ユーティリティ
```

### 技術スタック詳細

**フロントエンド**

- React Router v7（SPA）
- TypeScript
- Tailwind CSS v4, DaisyUI
- Zustand, React hooks
- shadcn/ui, Radix UI
- Socket.IO Client
- date-fns（日付・時間処理）
- React Hook Form, Zod（フォーム）

**バックエンド**

- Node.js, Express
- TypeScript
- Socket.IO Server
- Winston（ログ）
- YouTube Data API v3

**開発ツール**

- Vite（バンドラ）
- ESLint, TypeScript ESLint（静的解析）
- Prettier（コード整形）
- bun（推奨パッケージ管理）
- Lucide React, React Icons

## 🔧 API・データ仕様

### WebSocket通信 (Socket.IO)

**音楽管理のリアルタイム同期**

```typescript
// サーバー → クライアント
interface S2C {
  addMusic: (music: Music) => void; // 楽曲追加
  deleteMusic: (url: string) => void; // 楽曲削除
  initMusics: (musics: Music[]) => void; // 初期データ
  error: (message: string) => void; // エラー通知
}

// クライアント → サーバー
interface C2S {
  addMusic: (url: string) => void; // YouTube URL追加
  deleteMusic: (url: string) => void; // 楽曲削除
  updateYoutubeStatus: (status) => void; // 再生状態更新
}
```

### REST API

**システム情報取得**

```http
GET /api/assets
→ APIクォータ、キャッシュ状況、サーバー状態
```

**YouTube動画情報取得**

```http
GET /internal/youtube/video-info?url={youtube_url}
```

**パラメータ:**

- `url`: YouTube動画URL

**レスポンス:**

```json
{
  "title": "楽曲タイトル",
  "duration": "3:45",
  "thumbnail": "https://i.ytimg.com/vi/VIDEO_ID/maxresdefault.jpg",
  "channel": "アーティスト名",
  "view_count": 1000000,
  "cached": true,
  "cache_expires": "2024-01-02T12:00:00Z"
}
```

### データ型定義

**音楽データ**

```typescript
interface Music {
  id: string; // 一意識別子
  url: string; // YouTube URL
  title: string; // 動画タイトル
  channel: string; // チャンネル名
  duration: string; // 再生時間 (例: "3:45")
  addedAt: Date; // 追加日時
}
```

**スケジュール設定**

```typescript
interface ScheduleItem {
  label: string; // "1時間目", "昼休み" など
  type: "class" | "rest"; // 授業 or 休憩
  startTime: Time; // 開始時刻
}

interface ClassStatus {
  type: "class" | "rest" | "finished" | "before" | "closed";
  current?: ScheduleItem;
  next?: ScheduleItem;
  timeRemaining?: string; // "1時間23分45.67秒"
  remainingMs?: number; // ミリ秒での残り時間
}
```

**設定データ**

```typescript
interface ProgressSettings {
  showProgress: boolean;
  showLabel: boolean;
  animationSpeed: "slow" | "normal" | "fast";
  colorTheme: "default" | "rainbow" | "minimal";
}

interface DateSettings {
  showYear: boolean;
  showMonth: boolean;
  showDay: boolean;
  showWeekday: boolean;
  yearFormat: "full" | "short" | "none";
  monthFormat: "full" | "short" | "numeric" | "none";
  dayFormat: "numeric" | "padded" | "none";
  weekdayFormat: "full" | "short" | "none";
  separator: " " | "/" | "-" | ".";
}
```

### YouTube Data API連携

**利用エンドポイント**

```
GET https://www.googleapis.com/youtube/v3/videos
```

**パラメータ:** `part=snippet,contentDetails`

## 🔐 セキュリティ・認証

### 管理者権限システム

**認証方法**

```
URL: /home?admin={ADMIN_SECRET}
→ 管理者権限を付与（楽曲削除可能）
→ localStorage に永続化
```

**実装**

```typescript
// サーバーサイド認証
if (query.admin === process.env.ADMIN_SECRET) {
  socket.emit("admin-authenticated", true);
}

// クライアントサイド永続化
localStorage.setItem("isAdmin", "true");
```

**認証フロー**

1. 管理者がURL入力欄に管理者コード（32文字以上）を入力
2. サーバー側で `process.env.ADMIN_SECRET` と照合
3. 一致した場合、フロントエンドの管理者ストア（Zustand）で権限フラグを有効化
4. 管理者権限でのUI表示・機能アクセスが可能になる
5. ログアウトボタンで権限を無効化

**セキュリティ対策**

- ✅ 環境変数でシークレット管理
- ✅ クライアント・サーバー両側で権限チェック
- ✅ URLパラメータは表示後にクリア
- ✅ 管理者操作のログ記録
- ✅ 管理者コードの定期的な更新・変更を推奨
- ✅ 不正アクセス試行の監視・検出

### APIキー管理

- 環境変数 `YOUTUBE_API_KEY` での管理
- サーバーサイドでのみ使用、クライアントには非公開

### 入力検証

- YouTube URL形式の検証
- 動画時間制限 (10分以内)
- 音楽動画キーワードフィルタリング

### レート制限

- YouTube API: 1日10,000 quota
- 実際の使用量監視とログ記録

## 💾 データ永続化

### 音楽リクエスト (JSON)

**ファイル:** `data/musicRequests.json`

```json
{
  "date": "2025-06-23",
  "requests": [
    {
      "url": "https://youtube.com/watch?v=...",
      "title": "楽曲タイトル",
      "addedAt": "2025-06-23T10:30:00Z"
    }
  ]
}
```

**特徴**

- 📅 毎日午前0時に自動リセット
- 🔄 楽曲追加・削除時に即座に更新
- 🛡️ 型安全な読み書き
- 📁 `.gitignore`で本番環境から除外

### 設定データ (localStorage)

**UI設定**

```typescript
// 進捗バー設定
showProgress: boolean;
progressColor: string;
showRemainingText: boolean;
showCurrentSchedule: boolean;

// 日付表示設定
showDate: boolean;
yearFormat: "western" | "reiwa";
monthFormat: "japanese" | "english";

// 背景画像 (IndexedDB)
backgroundImage: Blob;
showBackgroundImage: boolean;
```

## 機能詳細・実装方針

### 音楽管理システム（/home）

#### 主要機能

**🎵 楽曲管理**

- YouTube URLからの楽曲追加・削除
- リアルタイムプレイリスト同期（Socket.IO）
- ドラッグ&ドロップによる楽曲順序変更
- 楽曲情報の自動取得（タイトル・時間・サムネイル）

**� データ永続化**

- JSONファイルによるリクエストデータの保存・復元（`data/musicRequests.json`）
- サーバー再起動後もリクエストが維持される仕組み
- 1日ごとの自動リセット機能（深夜0時に前日データをクリア）
- 音楽再生完了時の自動削除機能

**�🔄 YouTube連携**

- Chrome拡張機能との連携による再生状態監視
- プレイリストとの自動マッチング
- 再生・一時停止・スキップの制御
- 音量・シャッフル機能の提供

**📊 API管理**

- YouTube Data API v3のquota使用量追跡
- 24時間キャッシュによるAPI制限対策
- エラーハンドリング・再試行機能
- 使用量統計の可視化

#### 技術実装

```typescript
// 楽曲追加のフロー例
const addMusic = async (url: string) => {
  // 1. URL検証
  if (!isValidYouTubeUrl(url)) {
    throw new Error("無効なYouTube URLです");
  }

  // 2. キャッシュチェック
  const cached = await cache.get(extractVideoId(url));
  if (cached) {
    return cached;
  }

  // 3. YouTube API呼び出し
  const videoInfo = await youtubeApi.getVideoInfo(url);

  // 4. 制限チェック（10分以内、音楽系カテゴリ）
  if (videoInfo.duration > 600) {
    throw new Error("10分以内の動画のみ追加可能です");
  }

  // 5. データベース保存 & Socket.IO配信
  const music = await musicStore.add(videoInfo);
  io.emit("addMusic", music);

  return music;
};
```

### スケジュール管理システム（/time）

#### 主要機能

**⏰ 時間管理**

- 0.01秒間隔でのリアルタイム時間更新
- 授業・休憩時間の自動判定・進捗計算
- タブ非アクティブ時の更新停止（パフォーマンス最適化）
- 複数タイムゾーン対応

**📅 スケジュール機能**

- カスタマイズ可能な授業時間割
- 期間・休憩時間の柔軟な設定
- 祝日・特別スケジュールの対応
- 長期休暇期間の自動検出

**🎨 UI/UX**

- 高度にカスタマイズ可能な日付表示
- アニメーション付き進捗バー
- ダークモード・テーマ切り替え
- レスポンシブデザイン

#### 技術実装

```typescript
// 時間計算の最適化例
const useTimeCalculation = () => {
  const [timeState, setTimeState] = useState<TimeState>();

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const schedule = getCurrentSchedule(now);
      const progress = calculateProgress(now, schedule);

      setTimeState({
        currentTime: now,
        schedule,
        progress,
        remainingTime: schedule.endTime - now.getTime(),
      });
    };

    // 非アクティブタブでは更新停止
    const interval = setInterval(
      updateTime,
      document.hidden ? 0 : 10 // 0.01秒
    );

    return () => clearInterval(interval);
  }, []);

  return timeState;
};
```

## 🚀 運用・パフォーマンス

### ログ管理

**ログレベル**

```
ERROR → システムエラー、API失敗
WARN  → 制限値超過、予期しない状況
INFO  → 接続・操作・状態変更
DEBUG → 詳細な動作ログ
```

**出力先**

- 開発環境: コンソール出力
- 本番環境: `logs/app.log` (日次ローテーション)

### パフォーマンス最適化

**フロントエンド**

- ✅ React Router v7の自動コード分割
- ✅ Tailwind CSS v4のPurge機能
- ✅ 非アクティブタブでの更新停止
- ✅ 遅延ローディング (YouTube サムネイル)

**バックエンド**

- ✅ YouTube API 24時間キャッシュ
- ✅ APIクォータ使用量追跡
- ✅ Socket.IO接続プール管理
- ✅ メモリリーク防止

### 監視・保守

**API使用量**

```
日次制限: 10,000 quota
通常使用: ~150 quota/日
キャッシュヒット率: 87%
```

**ファイル管理**

```
logs/app.log          → 日次ローテーション
data/musicRequests.json → 毎日0時リセット
api-usage.json        → クォータ追跡
```

## 🔧 開発・デプロイ

### 開発環境構築

```bash
# 1. 依存関係インストール
bun install

# 2. 環境変数設定
cp .env.example .env
# YOUTUBE_API_KEY=your_api_key
# ADMIN_SECRET=your_secret_key

# 3. 開発サーバー起動
bun run dev
```

### ビルド・デプロイ

```bash
# 型チェック
bun run typecheck

# 本番ビルド
bun run build

# 本番サーバー起動
bun run start
```

### 環境設定

**必須環境変数**

```bash
YOUTUBE_API_KEY=AIzaSy...    # YouTube Data API v3
ADMIN_SECRET=ADM1N_AUTH...   # 管理者認証キー (32文字以上推奨)
```

**オプション設定**

```bash
PORT=3000                    # サーバーポート
NODE_ENV=production          # 環境設定
LOG_LEVEL=info              # ログレベル
```

### トラブルシューティング

**よくある問題**

```bash
# API制限超過
tail -f logs/app.log | grep "quota"

# TypeScript型エラー
bun run typecheck

# 依存関係の問題
rm -rf node_modules && bun install
```

---

## 📋 今後の改善計画

### ✅ 完了済み

- 音楽リクエストの永続化 (JSON)
- 管理者権限システム
- 進捗バー正確計算
- 型安全性の確保

### 🚧 短期 (1-2週間)

- [ ] モバイルUI改善
- [ ] エラーハンドリング強化
- [ ] ログ出力最適化

### 🔮 中長期 (1-3ヶ月)

- [ ] Spotify API連携
- [ ] PWA対応
- [ ] 楽曲推薦機能
- [ ] データベース移行

---

**最終更新:** 2025年6月23日  
**バージョン:** v2.0.0
