# 技術仕様書

## システム概要

本プロジェクトは、YouTube動画の音楽再生管理と学校の時間割表示を統合したWebアプリケーションです。リアルタイム同期や管理者機能、柔軟なUIカスタマイズを備え、教育現場やイベントでの利用を想定しています。

---

## 機能一覧

### 音楽管理（/home）

- YouTube動画の追加・削除・並び替え
- 楽曲情報の自動取得（タイトル・時間・サムネイル）
- プレイリストのリアルタイム同期（Socket.IO）
- Chrome拡張との連携による再生状態監視
- 管理者権限による操作制御

### 時間割表示（/time）

- 授業・休憩時間のカウントダウン・進捗表示
- 柔軟なスケジュール設定・祝日対応
- 高度な日付・進捗バー表示カスタマイズ
- タブ非アクティブ時の自動停止による省リソース化

---

## 技術スタック

| レイヤー           | 技術・ライブラリ                                                                                                                                                |
| :----------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **フロントエンド** | - React<br>- TypeScript<br>- Tailwind CSS v4<br>- Zustand<br>- shadcn/ui<br>- React Router v7<br>- Socket.IO Client<br>- date-fns<br>- React Hook Form<br>- Zod |
| **バックエンド**   | - Node.js<br>- Express<br>- TypeScript<br>- Socket.IO<br>- Winston<br>- YouTube Data API v3                                                                     |
| **開発ツール**     | - Vite<br>- bun<br>- ESLint<br>- Prettier<br>- Lucide React<br>- React Icons                                                                                    |

---

## アーキテクチャ・構成

### データフロー

```
ユーザー操作
  ↓
フロントエンド（React, WebSocket/HTTP）
  ↓
バックエンド（Node.js, Express, Socket.IO）
  ↓
YouTube Data API
```

### ディレクトリ構成（抜粋）

```
app/
├── components/      # UIコンポーネント
├── hooks/           # カスタムフック
├── libs/            # ユーティリティ
├── routes/          # ルーティング・API
├── server/          # サーバーサイド
├── stores/          # Zustandストア
├── utils/           # 汎用関数
├── types/           # 型定義
└── socket.ts        # Socket.IO型定義

time/                # スケジュール管理モジュール
```

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
- UI設定は localStorage/IndexedDB で管理

---

## 実装例

### 楽曲追加フロー

```typescript
const addMusic = async (url: string) => {
  if (!isValidYouTubeUrl(url)) throw new Error("無効なURL");
  const cached = await cache.get(extractVideoId(url));
  if (cached) return cached;
  const videoInfo = await youtubeApi.getVideoInfo(url);
  if (videoInfo.duration > 600) throw new Error("10分以内のみ");
  const music = await musicStore.add(videoInfo);
  io.emit("addMusic", music);
  return music;
};
```

### 時間計算フック例

```typescript
const useTimeCalculation = () => {
  // ...省略（詳細は元仕様参照）
};
```

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

**最終更新:** 2025年6月23日  
**バージョン:** v2.0.0
