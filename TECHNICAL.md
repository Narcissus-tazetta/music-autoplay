# 技術仕様書

## システム概要

Music Auto Playは、YouTubeの音楽動画をリアルタイムで管理できる機能と、学校の授業スケジュールを自動で表示・管理できる機能をひとつにまとめたWebアプリです。WebSocketによるリアルタイムな同期や、YouTube Data APIを使った動画情報の取得、授業時間の自動計算・進捗表示など、日常的に便利に使える仕組みです。

### 主な機能

- **音楽管理（/home）**: YouTube動画の追加・削除・リアルタイム同期
- **スケジュール管理（/time）**: 授業時間の自動表示・進捗バー・日付表示のカスタマイズ

## アーキテクチャ

### システム構成

```
┌───────────────────────────────────────────────────────────────────────────┐
│                              ユーザー                                     │
└──────────────────────────┬────────────────────────────────────────────────┘
                           │ ブラウザ (HTTP/WebSocket)
┌──────────────────────────┴────────────────────────────────────────────────┐
│                      フロントエンド (React SPA)                            │
│ ┌──────────────────────┬──────────────────────┬───────────────────────────┐ │
│ │       /home          │        /time         │      共通コンポーネント      │ │
│ │    音楽管理ページ       │   スケジュール管理     │  Settings, UI Library   │ │
│ │                      │                      │  Footer, Themes など     │ │
│ └──────────────────────┴──────────────────────┴───────────────────────────┘ │
│                                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │          フロントエンド技術スタック                                        │ │
│ │  React Router v7 | TypeScript | Tailwind CSS v4 | Socket.IO Client    │ │
│ │  Zustand | shadcn/ui | date-fns | React Hook Form                     │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────┬────────────────────────────────────────────────┘
                           │ Socket.IO + REST API
┌──────────────────────────┴────────────────────────────────────────────────┐
│                     バックエンド (Node.js)                                │
│                                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │                        API Layer                                       │ │
│ │  ┌─────────────────┐              ┌─────────────────────────────────┐   │ │
│ │  │   REST API      │              │       Socket.IO Server          │   │ │
│ │  │  (/api/assets)  │              │   (リアルタイム音楽管理)          │   │ │
│ │  └─────────────────┘              └─────────────────────────────────┘   │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │                      Business Logic                                    │ │
│ │  ┌─────────────────┐              ┌─────────────────────────────────┐   │ │
│ │  │   音楽管理       │              │      スケジュール処理             │   │ │
│ │  │   Handler       │              │      Processor                 │   │ │
│ │  │ ・楽曲追加/削除   │              │ ・時間計算(0.01秒間隔)           │   │ │
│ │  │ ・YouTube連携   │              │ ・進捗バー表示                   │   │ │
│ │  └─────────────────┘              └─────────────────────────────────┘   │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │                      Utilities & Services                             │ │
│ │  ┌─────────────────┐  ┌──────────────┐  ┌────────────────────────────┐  │ │
│ │  │    Logger       │  │    Cache     │  │      API Counter           │  │ │
│ │  │   (Winston)     │  │ (In-Memory)  │  │   (YouTube API使用量)      │  │ │
│ │  └─────────────────┘  └──────────────┘  └────────────────────────────┘  │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────┬────────────────────────────────────────────────┘
                           │ HTTPS API Calls
┌──────────────────────────┴────────────────────────────────────────────────┐
│                        外部サービス                                        │
│                                                                            │
│  ┌─────────────────────────────────┐  ┌──────────────────────────────────┐  │
│  │        YouTube Data API v3       │  │         Chrome拡張機能           │  │
│  │  ・動画情報取得 (1 quota/req)     │  │   (YouTube再生状態監視)          │  │
│  │  ・24時間キャッシュ               │  │                                  │  │
│  └─────────────────────────────────┘  └──────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘

                           ┌──────────────────┐
                           │  ファイルシステム   │
                           ├──────────────────┤
                           │  logs/app.log    │
                           │  api-usage.json  │
                           │  build/          │
                           │  node_modules/   │
                           └──────────────────┘
```

### データフロー図

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                ユーザー操作                                   │
└──────────────┬────────────┬────────────┬────────────┬─────────────────────────┘
               │            │            │            │
            音楽追加       音楽削除      設定変更      ページ遷移
               │            │            │            │
               ▼            ▼            ▼            ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         フロントエンド State                                  │
│                                                                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌──────────────┐ │
│  │   musicStore    │ │  settingsStore  │ │  socketConnection│ │  routeState  │ │
│  │   (Zustand)     │ │   (Zustand)     │ │   (Socket.IO)    │ │  (Router)    │ │
│  │                 │ │                 │ │                  │ │              │ │
│  │ ・楽曲リスト      │ │ ・音量設定       │ │ ・接続状態        │ │ ・現在ページ  │ │
│  │ ・再生状態       │ │ ・テーマ設定     │ │ ・エラー状態      │ │ ・履歴管理   │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ └──────────────┘ │
└────────────────┬─────────────────────────────────────────────────────────────┘
                 │ Socket.IO Events / HTTP Requests
                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          サーバーサイド処理                                     │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         Event Handlers                                  │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │ │
│  │  │  musicHandlers  │  │connectionHandlers│  │  videoControlHandlers  │  │ │
│  │  │                 │  │                 │  │                         │  │ │
│  │  │ ・addMusic      │  │ ・connect        │  │ ・play/pause/skip      │  │ │
│  │  │ ・deleteMusic   │  │ ・disconnect     │  │ ・volume control       │  │ │
│  │  │ ・updateOrder   │  │ ・error handling │  │ ・shuffle              │  │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                   │                                          │
│                                   ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                       Business Logic                                    │ │
│  │  ┌─────────────────┐  ┌────────────────┐  ┌─────────────────────────── │ │
│  │  │  YouTube API    │  │  Music State   │  │    Cache Management       │ │
│  │  │  Integration    │  │  Management    │  │                           │ │
│  │  │                 │  │                │  │ ・video metadata cache    │ │
│  │  │ ・video info    │  │ ・playlist     │  │ ・24時間有効期限           │ │
│  │  │ ・quota tracking│  │ ・current song │  │ ・API使用量節約            │ │
│  │  └─────────────────┘  └────────────────┘  └───────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                   │                                          │
│                                   ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                          Data Layer                                     │ │
│  │  ┌─────────────────┐  ┌────────────────┐  ┌─────────────────────────── │ │
│  │  │    Memory       │  │   File System  │  │    External APIs           │ │
│  │  │    Storage      │  │    Storage     │  │                           │ │
│  │  │                 │  │                │  │ ・YouTube Data API v3     │ │
│  │  │ ・runtime state │  │ ・logs/app.log │  │ ・Chrome Extension API    │ │
│  │  │ ・cache data    │  │ ・api-usage.json│  │ ・Spotify API (将来)      │ │
│  │  └─────────────────┘  └────────────────┘  └───────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└────────────────┬─────────────────────────────────────────────────────────────┘
                 │ Real-time Updates
                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                      クライアントへの応答                                       │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │   Socket.IO     │  │   HTTP Response │  │       UI Updates             │  │
│  │   Events        │  │                 │  │                             │  │
│  │                 │  │ ・API responses │  │ ・楽曲リスト更新             │  │
│  │ ・music-added   │  │ ・error messages│  │ ・再生状態表示               │  │
│  │ ・music-deleted │  │ ・status codes  │  │ ・エラーメッセージ           │  │
│  │ ・state-updated │  │                 │  │ ・ローディング状態           │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 技術スタック

#### フロントエンド

- React Router v7（SPA）
- TypeScript
- Tailwind CSS v4, DaisyUI
- Zustand, ReactのuseState/useEffect
- shadcn/ui, Radix UI
- Socket.IO Client
- date-fns（日付・時間処理）
- React Hook Form, Zod（フォーム）

#### バックエンド

- Node.js
- Express
- TypeScript
- Socket.IO Server
- Winston（ログ）
- YouTube Data API v3

#### 開発ツール

- Vite（バンドラ）
- ESLint, TypeScript ESLint（静的解析）
- Prettier（コード整形）
- TypeScript（型チェック）
- Watchexec（プロセスマネージャ）
- bun（推奨パッケージ管理）
- Lucide React, React Icons

## ディレクトリ構成

```
app/
├── components/          # UIコンポーネント
│   ├── footer/         # フッターコンポーネント
│   ├── home/           # ホーム画面（音楽管理）コンポーネント
│   ├── settings/       # 設定関連コンポーネント
│   ├── time/           # 時間表示（スケジュール管理）コンポーネント
│   └── ui/            # 共通UIコンポーネント (shadcn/ui)
├── hooks/              # カスタムフック
│   ├── time/          # 時間表示関連フック
│   ├── use-color-mode.ts    # ダークモード管理
│   ├── use-gaming-toggle.ts # ゲーミングモード管理
│   ├── use-mobile.ts        # モバイル判定
│   ├── use-progress-settings.ts # 進捗バー設定管理
│   └── use-youtube-status.ts    # YouTube状態管理
├── libs/               # ユーティリティ関数
├── routes/             # ルーティング定義
│   ├── api/           # API エンドポイント
│   ├── home/          # ホーム画面関連
│   ├── home.tsx       # 音楽管理ページ
│   └── time.tsx       # スケジュール管理ページ
├── server/             # サーバーサイドコード
│   ├── handlers/      # Socket.IOハンドラー
│   ├── middleware/    # Expressミドルウェア
│   ├── apiCounter.ts  # API使用量カウンター
│   ├── logger.ts      # ログ設定
│   ├── server.ts      # メインサーバー
│   ├── youtubeApi.ts  # YouTube API統合
│   └── youtubeState.ts # YouTube状態管理
├── stores/             # 状態管理 (Zustand)
├── utils/              # ユーティリティ関数
│   └── time/          # 時間計算・フォーマット関連
├── types/              # 型定義
├── *.css              # スタイルシート
└── socket.ts          # Socket.IO型定義

time/                   # スケジュール管理専用モジュール
├── components/         # 時間表示コンポーネント
├── hooks/             # 時間計算フック
├── types/             # スケジュール型定義
└── utils/             # 時間計算ユーティリティ
```

## API仕様・データモデル

### 主なルート

- `/home`: 音楽管理（YouTube動画の追加・削除・同期）
- `/time`: スケジュール管理（授業時間・進捗バー・設定）

### Socket.IOイベント（音楽管理）

#### サーバー → クライアント（S2C）

```typescript
interface ServerToClientEvents {
  // 楽曲管理イベント
  addMusic: (music: Music) => void;
  initMusics: (musics: Music[]) => void;
  deleteMusic: (url: string) => void;

  // URLリスト管理
  url_list: (musics: Music[]) => void;
  new_url: (music: Music | null) => void;
  delete_url: (url: string) => void;

  // YouTube状態同期
  current_youtube_status: (data: {
    state: string; // 'playing' | 'paused' | 'stopped'
    url: string; // 現在再生中のURL
    match: boolean; // プレイリストとの一致状況
    music: Music | null; // マッチした楽曲情報
  }) => void;

  // エラー・通知
  error: (message: string) => void;
  notification: (message: string) => void;
}
```

#### クライアント → サーバー（C2S）

```typescript
interface ClientToServerEvents {
  // 楽曲操作
  addMusic: (url: string) => void;
  deleteMusic: (url: string) => void;
  updateMusicOrder: (musics: Music[]) => void;

  // YouTube連携
  updateYoutubeStatus: (status: { state: string; url: string }) => void;

  // 接続管理
  disconnect: () => void;
}
```

```

}
```

### REST API エンドポイント

#### アセット情報取得

```http
GET /api/assets
```

**レスポンス例:**

```json
{
  "api_usage": {
    "daily_quota": 10000,
    "used_today": 150,
    "remaining": 9850,
    "reset_time": "2024-01-02T00:00:00Z"
  },
  "cache_status": {
    "total_entries": 45,
    "cache_hit_rate": 0.87,
    "last_cleanup": "2024-01-01T12:00:00Z"
  },
  "server_status": {
    "uptime": "2 days, 4 hours",
    "active_connections": 3,
    "memory_usage": "128MB"
  }
}
```

#### YouTube動画情報取得（内部API）

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

#### GET /api/assets

- **説明**: アプリケーション設定と統計情報を取得
- **レスポンス**: JSON形式の設定データ

### YouTube Data API連携

#### 利用エンドポイント

```
GET https://www.googleapis.com/youtube/v3/videos
```

**パラメータ:**

- `part`: snippet,contentDetails
- `id`: 動画ID
- `key`: API キー

**使用quota:** 1 unit per request

#### キャッシュ戦略

```typescript
interface CacheEntry {
  data: VideoInfo;
  timestamp: number;
  expires: number;
}

interface CacheConfig {
  ttl: number; // 24時間 (86400秒)
  maxEntries: number; // 最大1000エントリ
  cleanupInterval: number; // 1時間毎のクリーンアップ
}
```

**実装詳細:**

- **ストレージ**: In-memory Map + 定期的なファイル書き込み
- **キャッシュキー**: `youtube:video:{videoId}`
- **ヒット率**: 約87%（通常運用時）
- **クリーンアップ**: 期限切れエントリを1時間毎に削除

## データモデル

### 楽曲データ（Music型）

```typescript
interface Music {
  url: string; // YouTube URL (一意識別子)
  title: string; // 動画タイトル
  duration: string; // 再生時間 (MM:SS形式)
  thumbnail: string; // サムネイル画像URL
  channel: string; // チャンネル名
  addedAt: string; // 追加日時 (ISO 8601文字列)
  order?: number; // 表示順序 (オプション)
}
```

### YouTube状態管理

```typescript
interface YouTubeState {
  state: "playing" | "paused" | "stopped" | "buffering";
  url: string; // 現在のYouTube URL
  match: boolean; // プレイリスト内の楽曲かどうか
  music: Music | null; // マッチした楽曲データ
  currentTime?: number; // 再生位置（秒）
  totalTime?: number; // 総再生時間（秒）
}
```

### API使用量追跡

```typescript
interface ApiUsage {
  date: string; // YYYY-MM-DD形式
  quotaUsed: number; // 使用済みquota
  dailyLimit: number; // 日次制限値
  requests: number; // リクエスト回数
  cacheHits: number; // キャッシュヒット数
  lastUpdated: string; // 最終更新時刻
}
```

### スケジュール管理データ

```typescript
interface ClassSchedule {
  period: number; // 時限数
  startTime: string; // 開始時刻 (HH:MM)
  endTime: string; // 終了時刻 (HH:MM)
  duration: number; // 授業時間（分）
  breakTime: number; // 休憩時間（分）
}

interface ProgressSettings {
  showProgressBar: boolean; // 進捗バー表示
  showTimeRemaining: boolean; // 残り時間表示
  updateInterval: number; // 更新間隔（ミリ秒）
  theme: "light" | "dark" | "auto";
}
```

```typescript
interface Time {
  hours: number;
  minutes: number;
  seconds: number;
}

interface ScheduleItem {
  label: string;
  type: "class" | "rest";
  startTime: Time;
}

interface ClassStatus {
  type: "class" | "rest" | "finished" | "before" | "closed";
  current?: ScheduleItem;
  next?: ScheduleItem;
  timeRemaining?: string; // "1時間23分45.67秒"
  remainingMs?: number; // ミリ秒での残り時間
}

interface Schedule {
  items: ScheduleItem[];
}
```

### 設定データ

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

## 機能詳細・実装方針

### 音楽管理システム（/home）

#### 主要機能

**🎵 楽曲管理**

- YouTube URLからの楽曲追加・削除
- リアルタイムプレイリスト同期（Socket.IO）
- ドラッグ&ドロップによる楽曲順序変更
- 楽曲情報の自動取得（タイトル・時間・サムネイル）

**🔄 YouTube連携**

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

## セキュリティ

### APIキー管理

- 環境変数 `YOUTUBE_API_KEY` での管理
- サーバーサイドでのみ使用、クライアントには非公開

### 管理者権限の付与方法

#### 環境変数による管理者認証

- 環境変数 `ADMIN_SECRET` に管理者用の秘密コードを設定
- 音楽リクエストフォームのURL入力欄に管理者コードを入力することで認証
- 認証成功時にセッション内で管理者権限を一時的に付与
- 管理者コードは32文字以上の英数字記号で構成（推奨）

#### 認証フロー

1. 管理者がURL入力欄に管理者コード（32文字以上）を入力
2. サーバー側で `process.env.ADMIN_SECRET` と照合
3. 一致した場合、フロントエンドの管理者ストア（Zustand）で権限フラグを有効化
4. 管理者権限でのUI表示・機能アクセスが可能になる
5. ログアウトボタンで権限を無効化

#### セキュリティ考慮事項

- 管理者コードは定期的に更新・変更することを推奨
- コードは管理者に直接伝達（口頭・物理的手段）
- セッション・ページリロード時は再認証が必要
- ログの監視により不正アクセス試行を検出

### 入力チェック

- YouTube URL形式の検証
- 動画時間制限 (10分以内)
- 音楽動画キーワードフィルタリング

### レート制限

- YouTube API: 1日10,000 quota
- 実際の使用量監視とログ記録

## ログ設定

### ログレベル

- **ERROR**: エラー情報
- **WARN**: 警告情報
- **INFO**: 一般情報
- **DEBUG**: デバッグ情報

### ログ出力先

- **Console**: 開発環境
- **File**: `logs/app.log` (本番環境)
- **Rotation**: 日次ローテーション

## パフォーマンス

### 最適化ポイント

- **Bundle Splitting**: React Routerの自動コード分割
- **Tree Shaking**: 未使用コードの除去
- **CSS Optimization**: Tailwind CSS v4のPurge機能
- **Image Optimization**: YouTube サムネイル遅延読み込み
- **タブ管理**: 非アクティブタブでの計算停止
- **リアルタイム更新**: 必要最小限の再レンダリング

### モニタリング

- API使用量の追跡 (`api-usage.json`)
- WebSocket接続数の監視
- エラー率の測定
- スケジュール計算のパフォーマンス監視

## デプロイ・運用

### 環境変数

```bash
NODE_ENV=production                    # 実行環境 (development/production)
YOUTUBE_API_KEY=your_api_key_here     # YouTube Data API v3キー (必須)
ADMIN_SECRET=your_admin_secret_here   # 管理者認証コード (必須、32文字以上推奨)
PORT=3000                             # サーバーポート番号 (デフォルト: 3000)
```

**環境変数の説明：**

- `YOUTUBE_API_KEY`: YouTube Data API v3のAPIキー
  - Google Cloud Consoleで取得
  - サーバー起動時に読み込み状況をログ出力
- `ADMIN_SECRET`: 管理者認証用の秘密コード
  - 32文字以上の英数字記号で構成（推奨）
  - サーバー起動時に設定状況と文字数をログ出力
  - 未設定の場合は管理者機能が無効化される

### ビルド・起動方法

```bash
# 本番ビルド
bun run build
# サーバー起動
bun run start
```

### 本番ファイル構成

```
build/           # ビルド成果物
├── client/      # クライアントサイドバンドル
├── server/      # サーバーサイドバンドル
logs/           # ログファイル
api-usage.json  # API使用量記録
```

## 開発ワークフロー

### コード品質チェック

```bash
bun run typecheck   # TypeScriptの型チェック
bun run lint        # ESLintで静的解析
bun run format      # Prettierでコード整形
bun run quality     # 型・Lint・フォーマット一括チェック
```

### 推奨Gitフック

- **pre-commit**: lintとformatを自動で実行
- **pre-push**: typecheckとテストを自動で実行

## トラブルシューティング

### よくあるトラブルと対処法

1. **YouTube APIの利用上限に達した場合**

   - `api-usage.json`でAPI使用量を確認しましょう。
   - 必要に応じてキャッシュ期間を延ばすことでリクエスト数を抑えられます。

2. **WebSocketが接続できない場合**

   - ネットワーク環境やCORSの設定を見直してください。

3. **ビルドエラーが発生した場合**
   - `node_modules`ディレクトリを削除し、`bun install`で依存関係を再インストールしましょう。
   - TypeScriptの型エラーがないかも確認してください。

### ログの確認方法

```bash
# ログをリアルタイムで確認
tail -f logs/app.log

# エラーのみ抽出
grep "ERROR" logs/app.log
```

## 今後の拡張予定

- [ ] 音楽管理システムのUI改善 (DaisyUI統合)
- [ ] セキュリティ脆弱性の修正
- [ ] 管理者権限の機能拡張（楽曲削除・設定変更等）
- [ ] スケジュール設定のUI改善
- [ ] 複数スケジュールプロファイル対応
- [ ] 通知機能の追加
- [ ] モバイルアプリ版の検討

---

最終更新: 2025年6月23日
