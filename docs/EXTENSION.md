# この文章はAIが作りました。

```markdown
# Chrome 拡張機能 (Extension) — 実装ガイドと運用メモ

このファイルは拡張機能に関するセットアップ、拡張→サーバー間の通信仕様、実装チェックリスト、既知の修正点、デバッグ手順をまとめたものです。

> 参考: 添付の拡張リポジトリには `manifest.json`, `src/bg/*`, `src/content/*`, `src/popup/*` の実装例が含まれています。

## 1. 構成（典型例）
```

extension/
├── manifest.json
├── src/
│ ├── bg/ # service worker / background
│ ├── content/ # content scripts (YouTube ページへ挿入)
│ └── popup/ # 拡張のポップアップ UI
├── icons/
└── pages/

````
## 2. manifest のポイント

- `manifest_version: 3` を使用。
- `background.service_worker` にビルド済みの service worker を指定。
- 必要最小限の権限を付与: `storage`, `tabs`, `scripting`, `activeTab` など。

## 3. 重要イベントとペイロード（サーバー連携）

- `progress_update` (content → server)
	- 送信タイミング: 再生中に 1s 間隔で送るのが推奨。
	- ペイロード例:
		```json
		{
			"url": "https://www.youtube.com/watch?v=...",
			"videoId": "...",
			"currentTime": 12.34,
			"duration": 240.0,
			"playbackRate": 1,
			"isBuffering": false,
			"visibilityState": "visible",
			"timestamp": 1690000000000
		}
		```

- `video_ended` (content → server)
	- ペイロード例: `{ url, videoId, timestamp }`

- `navigate_to_video` (server → extension)
	- サーバーから届いたら同タブで `window.location.href = url`、またはバックグラウンド経由で `chrome.tabs.update` を呼ぶ。

- `external_music_add` (content/popup → server)
	- 外部動画をサーバーのキューへ追加する用途。`{ url, title? }` を送信。

## 4. 実装上の注意点

- 複数タブ対応: 送信時に `tabId` または `origin` を付与し、サーバー・バックグラウンドで競合を回避する。
- 名前の一貫性: サーバーは `progress_update` を期待するが、古い実装で `video_progress` を出している場合があるため受信側で互換処理を入れる。
- リソース管理: `setInterval` を使う場合は `playing`/`pause`/`ended`/`beforeunload` で確実に `clearInterval` する。

## 5. サンプル（content script の概略）

```javascript
// content.js (概略)
let progressInterval = null;
function startProgressTracking(player) {
	stopProgressTracking();
	progressInterval = setInterval(() => {
		if (!player || player.paused) return;
		socket.emit('progress_update', {
			url: location.href,
			videoId: extractVideoId(location.href),
			currentTime: player.currentTime,
			duration: player.duration,
			playbackRate: player.playbackRate || 1,
			isBuffering: player.readyState < 3,
			visibilityState: document.visibilityState,
			timestamp: Date.now()
		});
	}, 1000);
}

function stopProgressTracking() {
	if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }
}
````

## 6. デバッグ・ビルド

- 開発: `manifest.json` をローカルで読み込み、Dev Tools で Background Service Worker / content script のログを確認。
- ビルド: リポジトリのビルドスクリプト（例: `npm run build:extension`）に従う。出力を `manifest.json` の `background` に合わせて配置する。

## 7. よくある不具合と対策

- 進捗が送られない: `content script` が正しいページで動いているか、`player` 要素が見つかっているか確認。SPA ナビゲーションに対応するため `yt-navigate-finish` 等のイベントを監視する。
- 重複イベント: 既に同一タブで複数の listener が登録されていると重複送信される。起動時の初期化コードを idempotent にする。

---

詳細なチェックリストや実装例は `docs/API.md`、および拡張リポジトリの `src/` を参照してください。

```
```
