# この文章はAIが作りました。

````markdown
<!-- Migrated from TECHNICAL.md -->

# Architecture & Technical Overview

このファイルはプロジェクトの技術スタック、構成、データフロー、運用に関する概要を示します。

## 技術スタック

- Frontend: React, TypeScript, Tailwind CSS, Zustand, Socket.IO Client
- Backend: Node.js, TypeScript, Socket.IO, Winston
- Build: Vite, bun/npm

[この文章はAIが作りました。]

```markdown
# アーキテクチャ概要

このドキュメントは `music-autoplay` の主要コンポーネント、データフロー、運用上の考慮点を短くまとめたものです。設計方針は「リアルタイム同期」「可観測性」「軽量なクライアント」を重視しています。

## 1. 主要コンポーネント

- フロントエンド (ブラウザ)
  - React + TypeScript。UI は Tailwind / shadcn コンポーネントを使用。
  - 状態管理: Zustand（persist ミドルウェアで localStorage に保存）。
  - リアルタイム: Socket.IO クライアントでサーバーと同期。
  - 拡張機能（Chrome 拡張）: YouTube ページ上のイベントを検知してサーバーへ送信。

- サーバー
  - Node.js + TypeScript。Socket.IO サーバーを中心に、REST API を補助的に提供。
  - ロジック: 楽曲キュー管理、リモート再生状態管理、拡張機能からのイベント処理。
  - 永続化: 開発は JSON、運用では Postgres 等に切替可能（環境変数で判定）。

- 運用・監視
  - ログ: Winston（環境に応じた出力）。
  - テスト: ユニットテスト（Playwright / Bun スクリプトで E2E）。

## 2. データフロー（高レベル）

1. ブラウザ/拡張が再生イベントや進捗を取得 → Socket.IO 経由でサーバーへ送信（例: `progress_update`, `video_ended`）。
2. サーバーは受信した進捗を解析（広告検出やシーク検出）し、正規化した `RemoteStatus` を全クライアントへブロードキャスト。
3. フロントエンドは受信した `RemoteStatus` をもとに UI を補間（rAF や lastProgressUpdate を利用）して滑らかな表示を行う。
4. 楽曲追加/削除は Socket または REST 経由で行い、サーバーは変更を永続化して全クライアントへ通知する。

## 3. 状態同期の要点

- `RemoteStatus` は `currentTime`, `duration`, `progressPercent`, `lastProgressUpdate` 等を含む。これによりクライアント側で正確に時刻を補間できる。
- サーバーは受信イベント名の差（例: `video_progress` vs `progress_update`）に対して後方互換を維持するか統一する必要がある。

## 4. 拡張機能（Extension）との連携

- 拡張はコンテンツスクリプトで YouTube の `video` 要素を監視し、定期的に `progress_update` を送ることが望ましい（1s 間隔推奨）。
- 重要イベント: `video_ended`, `progress_update`, `navigate_to_video`, `external_music_add`。
- 拡張は複数タブでの競合を避けるため、Tab ID や origin を付与して送信する。

## 5. パフォーマンスと品質

- クライアント: rAF を使った表示補間で頻繁な React ステート更新を抑制。
- サーバー: 受信レートが高い場合はレート制限やデバウンスを適用して処理負荷を抑える。
- テスト: 単体テストと E2E（Playwright）を CI に組み込み、主要シナリオ（自動遷移、広告検出、進捗同期）を保持。

## 6. セキュリティとプライバシー

- 拡張機能は要求される最小限の権限のみ付与する（`storage`, `tabs`, `scripting` 等）。
- サーバーは公開 API の入力を検証し、不正リクエストへの対策（レート制限・バリデーション）を行う。
- 個人情報や視聴履歴は収集しない方針。ログに機密情報を出さない運用を徹底する。

## 7. デプロイと運用

- 環境ごとの設定は環境変数で管理（例: `DATABASE_URL`, `YOUTUBE_API_KEY`, `PRODUCTION` フラグ）。
- 本番では Postgres 等の永続化、ログのローテーション、モニタリング（ログ/メトリクス）を設定する。

## 8. 開発者向けメモ

- ローカル起動: `bun install` → `bun run dev`（または `npm install` / `npm run dev`）
- 主要ファイル:
  - サーバー: `src/server/*`, `src/server/socket/*`
  - クライアント: `src/shared/components`, `src/app/*`
  - 拡張: `extension/` または `src/extension/`（本リポジトリの拡張関連ドキュメントを参照）

---

詳しい API 仕様や実装チェックリストは `docs/API.md` と `docs/EXTENSION.md` を参照してください。
```
````
