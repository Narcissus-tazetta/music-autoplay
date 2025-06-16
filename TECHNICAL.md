# 技術仕様書 (Technical Specification)

## システム概要

Music Auto Playは、YouTube音楽動画のリアルタイム管理システムです。WebSocketを使用してリアルタイム同期を実現し、YouTube Data APIを活用した高度な動画検証機能を提供します。

## アーキテクチャ

### システム構成

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   External      │
│   (React)       │◄──►│   (Express)     │◄──►│   (YouTube API) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         │                        │                        │
    ┌─────────┐              ┌─────────┐              ┌─────────┐
    │WebSocket│              │Socket.IO│              │  Cache  │
    │ Client  │◄────────────►│ Server  │              │  Layer  │
    └─────────┘              └─────────┘              └─────────┘
```

### 技術スタック

#### Frontend

- **Framework**: React Router v7 (Remix)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand
- **UI Library**: shadcn/ui + Radix UI
- **Real-time**: Socket.IO Client

#### Backend

- **Runtime**: Node.js
- **Framework**: Express
- **Language**: TypeScript
- **Real-time**: Socket.IO Server
- **Logging**: Winston
- **External API**: YouTube Data API v3

#### Development Tools

- **Bundler**: Vite
- **Linting**: ESLint + TypeScript ESLint
- **Formatting**: Prettier
- **Type Checking**: TypeScript
- **Process Manager**: Watchexec

## ディレクトリ構造

```
app/
├── components/          # UIコンポーネント
│   ├── home/           # ホーム画面コンポーネント
│   ├── settings/       # 設定関連コンポーネント
│   └── ui/            # 共通UIコンポーネント (shadcn/ui)
├── hooks/              # カスタムフック
├── libs/               # ユーティリティ関数
├── routes/             # ルーティング定義
│   └── api/           # API エンドポイント
├── server/             # サーバーサイドコード
│   └── handlers/      # Socket.IOハンドラー
├── stores/             # 状態管理 (Zustand)
├── types/              # 型定義
├── *.css              # スタイルシート
└── socket.ts          # Socket.IO型定義
```

## API仕様

### Socket.IO Events

#### Server → Client (S2C)

```typescript
interface S2C {
  // 音楽管理
  addMusic(music: Music): void;
  initMusics(musics: Music[]): void;
  deleteMusic(url: string): void;

  // URLリスト管理
  url_list(musics: Music[]): void;
  new_url(music: Music | null): void;
  delete_url(url: string): void;

  // YouTube状態同期
  current_youtube_status(data: {
    state: string;
    url: string;
    match: boolean;
    music: Music | null;
  }): void;
}
```

#### Client → Server (C2S)

```typescript
interface C2S {
  // 音楽管理
  addMusic(music: Music, callback: (error?: string) => void): void;
  deleteMusic(url: string): void;

  // URLリスト管理
  get_urls(): void;
  submit_url(url: string): void;
  delete_url(url: string | { url: string }): void;

  // YouTube拡張連携
  youtube_video_state(data: { state: string; url: string }): void;
  youtube_tab_closed(data: { url: string }): void;
  move_prev_video(data: { url: string }): void;
  move_next_video(data: { url: string }): void;
}
```

### REST API

#### GET /api/assets

- **説明**: アプリケーション設定と統計情報を取得
- **レスポンス**: JSON形式の設定データ

### YouTube Data API統合

#### 使用エンドポイント

- `videos` - 動画詳細情報取得
- 使用quota: 1 unit per request

#### キャッシュ戦略

- **TTL**: 24時間
- **キャッシュキー**: `youtube:video:{videoId}`
- **実装**: In-memory Map + ファイル永続化

## データモデル

### Music型

```typescript
interface Music {
  url: string; // YouTube URL
  title: string; // 動画タイトル
  duration: string; // 再生時間 (ISO 8601)
  thumbnail: string; // サムネイル URL
  addedAt: string; // 追加日時 (ISO string)
}
```

### YouTube状態

```typescript
interface YouTubeState {
  state: "playing" | "paused" | "closed";
  url: string;
  match: boolean; // リスト内動画かどうか
  music: Music | null; // マッチした音楽データ
}
```

## セキュリティ

### API Key管理

- 環境変数 `YOUTUBE_API_KEY` での管理
- サーバーサイドでのみ使用、クライアントには非公開

### 入力検証

- YouTube URL形式の検証
- 動画時間制限 (10分以内)
- 音楽動画キーワードフィルタリング

### Rate Limiting

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

### 最適化項目

- **Bundle Splitting**: React Routerの自動コード分割
- **Tree Shaking**: 未使用コードの除去
- **CSS Optimization**: Tailwind CSSのPurge
- **Image Optimization**: YouTube サムネイル遅延読み込み

### モニタリング

- API使用量の追跡
- WebSocket接続数の監視
- エラー率の測定

## デプロイメント

### 環境変数

```bash
NODE_ENV=production
YOUTUBE_API_KEY=your_api_key_here
PORT=3000
```

### ビルドプロセス

```bash
npm run build    # 本番ビルド
npm run start    # 本番サーバー起動
```

### ファイル構成 (本番)

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
npm run typecheck  # TypeScript型チェック
npm run lint      # ESLintチェック
npm run format    # Prettierフォーマット
npm run quality   # 全体品質チェック
```

### Git Hook推奨設定

- **pre-commit**: lint + format
- **pre-push**: typecheck + test

## トラブルシューティング

### よくある問題

1. **YouTube API Quota超過**

   - `api-usage.json`で使用量確認
   - 必要に応じてキャッシュ期間延長

2. **WebSocket接続エラー**

   - ネットワーク設定確認
   - CORS設定確認

3. **ビルドエラー**
   - `node_modules`削除後再インストール
   - TypeScript型エラーの確認

### ログ確認

```bash
# リアルタイムログ監視
tail -f logs/app.log

# エラーログのみ抽出
grep "ERROR" logs/app.log
```

## 今後の拡張予定

- [ ] UIの変更（Daisy UI）
- [ ] 脆弱性の修正
- [ ] 管理者権限の譲渡方法変更

---

最終更新: 2025年6月16日
