# この文章はAIが作りました。

````markdown
# API - エラー契約と主要エンドポイント

このドキュメントは本プロジェクトの REST / HTTP エンドポイントの基本的な応答形式と、拡張機能やクライアントが扱うべきエラー契約をまとめたものです。

## 1. レスポンス共通形式

- 成功:

```json
{ "success": true, "data": <any> }
```
````

- エラー:

```json
{ "success": false, "error": { "code": "<error_code>", "message": "<human readable message>", "details": <optional> } }
```

### 標準的な `error.code`

- `bad_request` → 400
- `validation` / `unprocessable` → 422
- `unauthorized` → 401
- `forbidden` → 403
- `not_found` → 404
- `internal_error` → 500

クライアントはまず `success` フラグを確認し、`false` の場合は `error.code` を用いて UI/フローを制御してください。

## 2. 主要なエンドポイント（要約）

- `GET /api/settings` — ユーザー/クライアント設定を取得
  - 返却例: `{ success: true, data: { ytStatusVisible: true, ytStatusMode: 'player' } }`

- `POST /api/settings` — 設定の保存（同期）
  - リクエストボディ: `{ ytStatusVisible?: boolean, ytStatusMode?: 'compact'|'player' }`

- `GET /internal/youtube/video-info?url=...` — YouTube 動画情報を取得（サーバー側で YouTube Data API を利用）

（補足）多くの操作は Socket.IO を経由してリアルタイムに行うため、REST は補助的に用いられます。エラー契約は REST と Socket の両方で整合が取れていることを前提にしてください。

## 3. Socket (短い説明)

- 本プロジェクトは Socket.IO を利用して次のようなイベントをやり取りします（代表例）:
  - クライアント→サーバー: `progress_update`, `video_ended`, `external_music_add`, `move_next_video` 等
  - サーバー→クライアント: `remoteStatusUpdated`, `musicAdded`, `navigate_to_video`, `no_next_video`

Socket イベントのペイロードもエラーを内包し得るため、サーバー側の `respondWithResult` 相当の形式（`success` / `error`）を内部で統一して扱うことを推奨します。

## 4. エラーハンドリングの運用指針

- 本番環境では `details` に機密情報を出さない。詳細はログで確認する。
- クライアントは `unauthorized` を受けた場合に再ログインを促す等の UI を用意する。
- バルク操作や高頻度イベント（progress など）はサーバー側で入力検証とレート制御を行う。

## 5. 参考: 設定同期フロー

- フロントエンドは `useSettingsStore`（Zustand persist）でローカルに保持し、`useSettingsSync` が初期ロード時に `GET /api/settings` を呼び、変更時に `POST /api/settings` を投げます。

---

詳しいイベントペイロードや拡張機能の実装例は `docs/EXTENSION.md` を参照してください。

```
```
