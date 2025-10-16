# Music Auto Play

> [!IMPORTANT]
> 残念ながらこの案は却下されてしまいました...

> 📋 **[📖 技術仕様書 (TECHNICAL.md)](./TECHNICAL.md)** - システムアーキテクチャ・API仕様・開発ガイド

## 概要

YouTube音楽動画のリアルタイム管理を行うWebアプリケーションです。

### 主要機能

- **音楽管理** (`/home`): YouTube動画の追加・削除・リアルタイム同期

## 機能詳細

### 音楽リクエスト・管理

- YouTubeのURLを入力して楽曲をリクエスト
- 10分以内の音楽動画のみ登録可能
- リアルタイムで楽曲リストに反映
- WebSocketによる複数ユーザー同期

### ユーザーインターフェース

- ダークモード・ライトモード切り替え
- レスポンシブデザイン（モバイル・タブレット・デスクトップ対応）
- 設定パネルによる詳細カスタマイズ

# Music Auto Play (music-autoplay)

YouTube の URL をキューに登録して共有 / 再生状態を管理する Web アプリケーション。
サーバー側は TypeScript + Express + socket.io、フロントエンドは React（Vite）で構成されています。

## 主要なポイント

- リアルタイム同期: socket.io による楽曲リストの同期
- 永続化: ローカル JSON ファイル（開発向け）および PostgreSQL（本番 / Render 向け）をサポート
- ロギング: winston 中央ロガー（開発は色付けプリティ、prod はローテーション）
- 簡易管理者認証: 環境変数 `ADMIN_SECRET` による保護

---

## クイックスタート（ローカル開発）

前提:

- Node.js または Bun がインストールされていること

1. リポジトリをクローン

```bash
git clone https://github.com/Narcissus-tazetta/music-autoplay.git
cd music-autoplay
```

2. 依存関係のインストール

```bash
# Bun を推奨
bun install

# または npm
npm install
```

3. 環境ファイルの準備

```bash
cp .env.example .env
# .env に必要な値（例: ADMIN_SECRET, DATABASE_URL, YOUTUBE_API_KEY）を設定
```

4. 開発サーバ起動

```bash
bun run dev
```

---

## 主要コマンド

```bash
# 開発 / ビルド
bun run dev
bun run build
bun run start

# 品質チェック / テスト
bun run typecheck    # 型チェック
bun run lint         # ESLint
bun run format:check # Prettier check
bun run test:unit    # ユニットテスト（全36テスト、サマリ付き）
bun run test:e2e     # E2Eテスト（Playwright）

# 一括品質チェック
bun run quality      # typecheck + lint + format:check
bun run ci           # quality + test:unit + build
```

---

## 永続化と移行

このプロジェクトはデフォルトで `data/musicRequests.json` を使用する `FileStore` を提供します。
Render 等の複数インスタンス環境では Postgres を推奨します。サーバ起動時に `DATABASE_URL` が設定されていると Postgres ベースの `PgHybridStore` を使用します。

### JSON → Postgres 移行

1. Postgres データベースと接続文字列（`DATABASE_URL`）を用意します。
2. 以下コマンドで移行を実行します（バッチサイズは `MIGRATE_BATCH_SIZE` で調整可能）:

```bash
DATABASE_URL=postgres://user:pass@host:5432/dbname MIGRATE_BATCH_SIZE=500 node scripts/migrate-file-to-pg.js
```

スクリプトの特徴:

- バッチ挿入（デフォルト 500 件）
- 各バッチをトランザクション内で処理、失敗時は ROLLBACK
- バッチごとに最大 3 回のリトライ（指数バックオフ）
- 成功/失敗のサマリを表示し、失敗がある場合は非ゼロで終了

---

## ロギング

- 開発時は色付きのプリティ出力で見やすく表示されます（YouTube URL／状態の強調あり）。
- 本番用に `winston-daily-rotate-file` を使用してログをローテートし、ANSI エスケープシーケンスはファイルに書き込む前に除去されます。
- ログは構造化され、重要イベントにはメトリクスタグを付与します。

設定や出力先は `src/server/logger.ts` を参照してください。

---

## サーバのシャットダウン

サーバは graceful shutdown を実装しています。SIGINT / SIGTERM を受けると:

- HTTP server と socket.io をクローズ
- ストアの flush（PgHybridStore の pending writes の待機）
- Postgres プールの終了（PgStore を使用している場合）

---

## テスト

### ユニットテスト

```bash
bun run test:unit
```

すべてのユニットテストを順次実行し、見やすいサマリを表示します。

- **14ファイル、36テスト、84アサーション**が実行されます
- 各ファイルの結果（PASS/FAIL）とテスト数を表示
- 最後に全体のサマリ（実行時間含む）を出力

> **注意**: Bun v1.2.17 のテストランナーは複数ファイルを一括実行すると一部のテストが検出されない既知の問題があります。このため、`scripts/run-unit-tests.sh` を使用して各ファイルを順次実行しています。

### E2Eテスト

```bash
bun run test:e2e
```

---

## 開発者向けの注意点

- Render 等で複数インスタンスを立てる場合はローカル JSON ではなく Postgres を利用してください。
- migrate スクリプトは一度きりの移行処理として想定しています。実行前に DB バックアップを取ることを推奨します。
- 環境変数の検証は `src/app/env.server.ts`（Zod）で行っています。必須項目がないと起動時にエラーとなります。
- テストは Bun のテストランナーを使用しています。CI では `bun run test:unit` を実行してください。

---

## 変更履歴（要旨）

- ロギングを winston 中心に統一（開発の色付け + 本番のローテーション）
- `src/server/musicPersistence.ts` に Postgres 用の `PgStore` / `PgHybridStore` を追加
- `createPersistentStore()` により DATABASE_URL の有無で自動的にストレージを選択
- 移行スクリプト `scripts/migrate-file-to-pg.js` をバッチ / トランザクション / リトライ対応に強化

---

フィードバックや追記してほしいセクション（Render デプロイ手順や .env.example の自動生成など）があれば教えてください。
