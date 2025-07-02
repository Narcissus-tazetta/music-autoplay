# TECHNICAL.md - 技術仕様書

---

## 技術スタック

| レイヤー           | 技術・ライブラリ                                                                          |
| :----------------- | :---------------------------------------------------------------------------------------- |
| **フロントエンド** | React, TypeScript, Tailwind CSS v4, Zustand, shadcn/ui, React Router v7, Socket.IO Client |
| **バックエンド**   | Node.js, Express, TypeScript, Socket.IO, Winston, YouTube Data API v3                     |
| **開発ツール**     | Vite, bun, ESLint, Prettier, Lucide React, React Icons                                    |

---

## ドメイン駆動型ディレクトリ構成

```
src/
├── features/              # ドメイン別機能
│   ├── music/             # 音楽管理（/home）
│   │   ├── components/    # HomeForm, YouTubeStatus, etc.
│   │   ├── hooks/         # use-youtube-status
│   │   ├── stores/        # musicStore
│   │   ├── api/           # YouTube API関連
│   │   └── utils/         # 音楽固有ユーティリティ
│   ├── schedule/          # 時間割（/time）
│   │   ├── components/    # TimeDisplay, ProgressBar, etc.
│   │   ├── hooks/         # use-class-schedule, time/*
│   │   ├── stores/        # classScheduleStore
│   │   ├── api/           # スケジュールAPI
│   │   └── utils/         # 時間計算・祝日処理
│   └── settings/          # 共通設定・テーマ
│       ├── components/    # SettingsPanel, DarkModeToggle, etc.
│       ├── hooks/         # use-progress-settings
│       ├── stores/        # progressSettingsStore, colorModeStore
│       └── utils/         # 設定関連ユーティリティ
├── shared/                # 共通リソース
│   ├── components/        # UI共通コンポーネント（shadcn/ui, Footer）
│   ├── hooks/             # use-gaming-toggle, use-mobile
│   ├── stores/            # adminStore
│   ├── libs/              # indexedDB, utils
│   ├── types/             # 型定義, socket.ts
│   └── utils/             # 汎用関数
├── server/                # サーバーサイド
│   ├── api/               # APIハンドラー
│   ├── middleware/        # レート制限・バリデーション
│   ├── utils/             # サーバーユーティリティ
│   └── types/             # サーバー型定義
└── app/                   # アプリケーション層
    ├── routes/            # React Router設定
    ├── root.tsx           # ルートコンポーネント
    └── routes.ts          # ルート定義
```

---

## 状態管理・データフロー

```
ユーザー操作
  ↓
フロントエンド（React, Zustand, WebSocket/HTTP）
  ↓
バックエンド（Node.js, Express, Socket.IO）
  ↓
YouTube Data API
```

### 状態管理のポイント

- **Zustand**で全UI状態を一元管理（カラーモード・進捗設定・スケジュール等）
- **IndexedDB**は背景画像のみ（大容量対応）
- **localStorage**はZustand persist経由のみ利用

---

## API・データ仕様

### WebSocket (Socket.IO)

- 楽曲追加・削除・初期化・エラー通知（サーバー→クライアント）
- 楽曲追加・削除・再生状態更新（クライアント→サーバー）

### REST API

- `/api/assets` : システム情報取得
- `/internal/youtube/video-info?url=...` : YouTube動画情報取得

### データ型例

```typescript
interface Music {
  id: string;
  url: string;
  title: string;
  channel: string;
  duration: string;
  addedAt: Date;
}
```

---

## セキュリティ・認証

- 管理者権限はURLパラメータと環境変数で認証
- 権限はlocalStorageで永続化
- APIキー・管理者コードはサーバー環境変数で管理
- 入力検証・動画時間制限・レート制限・操作ログ記録

---

## データ永続化

- 楽曲リクエストは `data/musicRequests.json` で日次リセット・型安全保存
- UI設定は Zustand persist/IndexedDB で管理

---

## 運用・パフォーマンス

- ログはWinstonで管理（本番: ファイル, 開発: コンソール）
- フロント: コード分割・PurgeCSS・遅延ローディング
- バック: APIキャッシュ・クォータ追跡・Socket.IO接続管理

---

## 開発・デプロイ

### セットアップ

```bash
bun install
cp .env.example .env
bun run dev
```

### ビルド・本番起動

```bash
bun run typecheck
bun run build
bun run start
```

### 必須環境変数

- `YOUTUBE_API_KEY`
- `ADMIN_SECRET`
- `PORT`（任意）

---

## 今後の改善計画

- モバイルUI最適化
- エラーハンドリング強化
- Spotify API連携
- PWA対応
- データベース移行

---

**最終更新:** 2025年7月2日  
**バージョン:** v2.1.0
