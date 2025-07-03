# Music Auto Play

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
- 直感的な操作性とモダンなUI

### YouTube連携

- YouTube拡張機能との連携
- 再生状態の監視・表示
- 動画の自動検証・キャッシュ機能

## 技術スタック

> 🔧 **詳細な技術仕様は [TECHNICAL.md](./TECHNICAL.md) をご確認ください**

- **Frontend**: React Router v7, React, TypeScript, Tailwind CSS v4 + DaisyUI
- **Backend**: Node.js, Express, Socket.IO
- **State Management**: Zustand + React Hooks
- **API**: YouTube Data API v3
- **Logging**: Winston
- **UI Components**: shadcn/ui + Radix UI
- **Code Quality**: ESLint, Prettier
- **Development**: Vite, Watchexec
- **Date/Time**: date-fns

## 開発環境セットアップ

### 前提条件

- Node.js 18.0.0以上
- bun（推奨）
- YouTube Data API v3 キー

git clone https://github.com/Narcissus-tazetta/music-autoplay.git

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/Narcissus-tazetta/music-autoplay.git
cd music-autoplay

# 依存関係をインストール
bun install

# 環境変数を設定（.env.exampleがあればコピー）
cp .env.example .env
# .envファイルにYOUTUBE_API_KEYを記入
```

### 開発サーバーの起動

```bash
# 開発サーバーを起動
bun run dev

# 型チェックやLintも必要に応じて
bun run typecheck
bun run lint
bun run format
```

### 主なコマンド一覧

```bash
# 開発
bun run dev           # 開発サーバー起動
bun run build         # 本番ビルド
bun run start         # 本番サーバー起動

# コード品質
bun run lint          # ESLintチェック
bun run lint:fix      # ESLint自動修正
bun run format        # Prettierフォーマット
bun run format:check  # フォーマットチェック
bun run typecheck     # TypeScript型チェック

# メンテナンス
bun run clean         # ビルドファイル削除
bun run fresh         # 依存関係再インストール

# 品質チェック一括
bun run quality       # typecheck + lint + format check
```

## 使い方

### 音楽管理（/home）

1. YouTubeのURLを入力して楽曲を追加します。
2. リストから削除ボタンを押すと楽曲を削除できます。
3. 右上の設定ボタンからテーマや表示設定を変更できます。

## 開発ガイドライン

### コード品質

- **ESLint**: エラーが0件となるように保ちましょう
- **Prettier**: コードフォーマットを統一しましょう
- **TypeScript**: 型安全性を重視しましょう
- **モジュール設計**: 機能ごとに適切に分離しましょう

### 設計方針

- **コンポーネント分割**: 単一責任の原則を意識して設計
- **カスタムフック**: ロジックの再利用性を高める
- **型定義**: 厳密な型システムで安全性を担保
- **状態管理統一**: Zustandでグローバル・ローカル両方の状態を一元管理
- **設定管理**: Zustand persistで設定を永続化（ストレージは環境依存）
