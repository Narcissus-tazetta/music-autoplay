# music-auto-play

[![wakatime](https://wakatime.com/badge/user/69c81f1f-2463-47f1-8304-a57b844fbf86/project/f1072ab0-bf44-4342-9588-d883b50196e5.svg)](https://wakatime.com/badge/user/69c81f1f-2463-47f1-8304-a57b844fbf86/project/f1072ab0-bf44-4342-9588-d883b50196e5)

リクエストされた YouTube 動画をブラウザ拡張経由で自動再生するフルスタックツールです。拡張機能が再生リクエストをサーバーへ送信し、Socket.IO によるリアルタイム同期でプレイリスト管理・キュー処理・複数クライアント間の連携を行えます。React/Vite を使ったフロントエンドとサーバーが連携して動作します。たぶん。

## 使用している主な技術

- Node/Bun, Express
- React + Vite
- react-router (server-side rendering 用ツール)
- Socket.IO
- Tailwind / Radix UI

## プロジェクト概要

ローカルで音楽の自動再生やプレイリスト管理を行うためのウェブアプリケーションと、YouTube 拡張（ブラウザ拡張）を含むフルスタックプロジェクトです。サーバーはビルド済みアセットを配信し、Socket.IO でクライアントと双方向通信を行います。

## 必要な環境変数（主なもの）

- `CLIENT_URL` : 公開されたフロントエンドの URL（例: `https://music-auto-play.onrender.com`）
- `CORS_ORIGINS` : カンマ区切りで許可するオリジン
- `YOUTUBE_API_KEY` : YouTube API を使う場合の API キー
- `ADMIN_SECRET` : 管理用シークレット（任意）
- `SESSION_SECRET` : セッション署名に使う秘密鍵
- `DATABASE_URL` : PostgreSQL 等の接続文字列（このプロジェクトで使う場合）

（注意）これらの値はデプロイ先のシークレット管理に登録してください。ローカル開発ではリポジトリ直下に `.env` を作成して設定できますが、秘密情報を公開リポジトリに置かないでください。

## よく使うコマンド

# （`bun` を推奨）

```bash
# bun をインストール（未導入の場合）
curl -fsSL https://bun.sh/install | bash

# 依存関係をインストール
bun install

# 開発サーバー
bun run dev

# 本番用ビルド（クライアントとサーバーのビルド）
bun run build

# 拡張機能（Chrome 拡張など）ビルド（任意）
bun run build:extension

# 本番起動
bun run start

# テスト
bun run test:unit
bun run test:critical
```

## ディレクトリ構成（抜粋）

- `src/` : アプリケーションのソース（サーバー・クライアント共存）
- `build/` : ビルド出力（`build/client` / `build/server`）
- `youtube-auto-play/` : ブラウザ拡張のソースと設定
- `server/` : サーバーブートストラップや設定（一部）
- `public/` : 静的公開ファイル
- `tests/` : テスト群

## 開発環境の構築（要点）

1. リポジトリをクローン
   ```bash
   git clone <repo-url>
   cd music-auto-play
   ```
2. Bun をインストール（未導入の場合）
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```
3. 依存関係をインストール
   ```bash
   bun install
   ```
4. `.env` を作成し、必要な環境変数を設定
5. 開発サーバーを起動
   ```bash
   bun run dev
   ```
