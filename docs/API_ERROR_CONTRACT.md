# API エラー契約（API_ERROR_CONTRACT.md)

このドキュメントは、サーバー側で統一したエラーハンドリングの結果として返却される HTTP レスポンスのフォーマットと、開発者がクライアント側でどのようにハンドリングすべきかを示します。

## 全体仕様

すべての HTTP API（loader / action / API ルート）は、成功時と失敗時で以下の JSON 形式を返します。成功時は 2xx ステータス、失敗時はエラー種別に応じたステータスを返します。

- 成功レスポンス

```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": <any>
}
```

- エラーレスポンス（構造化）

```
HTTP/1.1 <status>
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "<error_code>",
    "message": "<human-readable message>",
    "details": <optional - additional machine-readable info (nullable)>
  }
}
```

注意: 例外的に、OAuth プロバイダ等が返す `Response` オブジェクト（リダイレクトなど）はそのまま返却されます。フロントエンドは `Response` を受け取るケースを考慮してください（fetch/Router の挙動に依存します）。

## error.code の一覧と HTTP ステータスマッピング（現在サポート）

- `bad_request` → 400
  - 入力検証エラーや不正なリクエストボディ
- `validation` / `unprocessable` → 422
  - フィールド単位のバリデーションエラー（フォーム返却など）
- `unauthorized` → 401
  - 認証が必要な操作における未認証
- `forbidden` → 403
  - 認可（権限）エラーや操作禁止
- `not_found` → 404
  - リソースが見つからない場合
- `internal_error` → 500
  - サーバ内部の予期しないエラー（ログを参照）

実装上は `respondWithResult` がハンドラーの `HandlerError.code` を参照して適切なステータスへマッピングします。拡張が必要な場合は `respondWithResult` を更新して下さい。

## details フィールドについて

- `details` はデバッグ/機械的ハンドリングに必要な追加情報を入れますが、**機密情報やスタックトレースを直接公開しない**でください。
- 本番では `details` は最小化し、必要な情報はサーバー側ログに出力してください。

## クライアント実装のガイドライン

1. レスポンスの Content-Type が `application/json` であることを確認する。
2. `success` フラグを最優先で判定する。
   - `success === true` → `data` を使う。
   - `success === false` → `error.code` による分岐を行う。
3. `error.code` をスイッチして適切に UI をハンドリングする（例：`unauthorized`→ログイン遷移、`validation`→フォーム表示）。
4. 例外的に `Response` が返るケース（OAuth など）を考慮し、`response instanceof Response` のチェックを行うか、Router 側の挙動に委ねる。

## 移行ガイド（サーバー側）

- サーバーの top-level loader/action では、ビジネスロジックを `safeExecuteAsync` / `safeExecute` でラップし、失敗時は `respondWithResult(err({ message, code }))` を返す。
- 既存のフォームフロー（`submission.reply()` 等）を壊さないよう、フォーム専用の action は成功時に `submission.reply(value)` を返すことで互換性を保つ。
- `respondWithResult` はエラーを JSON に整形し HTTP ステータスをセットする。フロントエンドはその JSON シグネチャに合わせて更新する。

## 例（サンプル）

- 成功例

```
return new Response(JSON.stringify({ success: true, data: { id: "abc" } }), { status: 200 });
```

- エラー例

```
return respondWithResult(err({ message: "不正な入力です", code: "bad_request", meta: { field: "url" } }));
```

## ロギング

サーバー側では `HandlerError.meta` やスタックトレースをログに出力して解析可能にしますが、クライアントへは不要情報を返さない運用を推奨します。

---

更新履歴

- 2025-09-21: 初版（サーバーの Result/HandlerError + respondWithResult パターン採用に対応）
