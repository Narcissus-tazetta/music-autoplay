# Chrome Extension Setup Guide

このドキュメントでは、堅牢なSocketWrapper実装を含むChrome拡張機能のセットアップ手順を説明します。

## 📁 ファイル構成

```
extension/
├── manifest.json           # 拡張機能マニフェスト
├── src/
│   ├── bg/
│   │   ├── bg_socket_wrapper.js  # SocketWrapper実装
│   │   └── background.js         # Service Worker
│   ├── content/
│   │   └── content_script.js     # YouTube用コンテンツスクリプト
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   └── config/
│       └── config.js             # 設定ファイル
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── pages/
    └── welcome.html              # 初回インストール時のページ
```

## 🛠️ manifest.json 設定

```json
{
  "manifest_version": 3,
  "name": "Music Auto-Play Extension",
  "version": "1.0.0",
  "description": "Robust music management with Socket.IO communication",

  "permissions": ["activeTab", "tabs", "storage", "notifications", "scripting"],

  "host_permissions": [
    "*://www.youtube.com/*",
    "http://localhost:*/*",
    "https://*.onrender.com/*"
  ],

  "background": {
    "service_worker": "src/bg/background.js",
    "type": "module"
  },

  "content_scripts": [
    {
      "matches": ["*://www.youtube.com/*"],
      "js": ["src/content/content_script.js"],
      "run_at": "document_idle"
    }
  ],

  "action": {
    "default_popup": "src/popup/popup.html",
    "default_title": "Music Auto-Play",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },

  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },

  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self';"
  },

  "web_accessible_resources": [
    {
      "resources": ["src/config/config.js"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

## ⚙️ 設定ファイルの設定

### src/config/config.js

```javascript
/**
 * 拡張機能設定ファイル
 * SOCKET_URLをここで設定（開発時の動的注入対応）
 */

// デフォルト設定
const DEFAULT_CONFIG = {
  // 本番環境用
  SOCKET_URL_PRODUCTION: "https://your-app.onrender.com",
  // 開発環境用
  SOCKET_URL_DEVELOPMENT: "http://localhost:5173",
  // デバッグモード
  DEBUG_MODE: false,
  // Auto-reconnect設定
  AUTO_RECONNECT: true,
  MAX_RECONNECT_ATTEMPTS: 12,
  RECONNECT_BASE_DELAY: 1000,
};

// 現在の環境判定
const isDevelopment = () => {
  return (
    chrome.runtime.getManifest().version.includes("dev") ||
    chrome.runtime.getURL("").includes("unpacked")
  );
};

// 設定取得
const getConfig = () => {
  const env = isDevelopment() ? "DEVELOPMENT" : "PRODUCTION";
  const socketUrl = DEFAULT_CONFIG[`SOCKET_URL_${env}`];

  return {
    ...DEFAULT_CONFIG,
    SOCKET_URL: socketUrl,
    ENVIRONMENT: env,
  };
};

// Globalに設定を注入
if (typeof self !== "undefined") self.EXTENSION_CONFIG = getConfig();

// Popupでの利用
if (typeof window !== "undefined") window.EXTENSION_CONFIG = getConfig();
```

## 🚀 Popup用 Socket URL 注入

### src/popup/popup.js

````javascript
/**
 * Popup用のSocket接続管理
 */

// 設定を読み込み
import "../config/config.js";

class PopupManager {
    constructor() {
        this.config = window.EXTENSION_CONFIG;
        this.backgroundPort = null;
        this.init();
    }

    async init() {
        try {
            // Background scriptと通信ポートを確立
            this.backgroundPort = chrome.runtime.connect({ name: "popup" });

            this.backgroundPort.onMessage.addListener((message) => {
                this.handleBackgroundMessage(message);
            });

            // Socket状態を取得
            const status = await this.getSocketStatus();
            this.updateUI(status);

            // UI イベントハンドラーを設定
            this.setupEventHandlers();
        } catch (error) {
            console.error("[Popup] Initialization failed:", error);
            this.showError("初期化に失敗しました");
        }
    }

    async getSocketStatus() {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: "get_socket_status" }, (response) => {
                if (response && response.success) {
                    resolve(response.data);
                } else {
                    resolve({ isConnected: false, error: "Unknown" });
                }
            });
        });
    }

    updateUI(status) {
        const statusEl = document.getElementById("connection-status");
        const configEl = document.getElementById("config-info");

        if (status.isConnected) {
            statusEl.textContent = "接続済み";
            statusEl.className = "status connected";
        } else {
            statusEl.textContent = "未接続";
            statusEl.className = "status disconnected";
        }

        // 設定情報を表示

## 🔧 ビルド手順（拡張）

開発中に TypeScript の `background.ts` / `socketWrapper.ts` をビルドして拡張に適用するには、リポジトリルートで以下を実行します。

1. 依存をインストール（初回のみ）

```bash
# npm の場合
npm install

# bun の場合
bun install
````

2. 拡張用バンドルを作成

```bash
npm run build:extension
```

出力: `dist/extension/background.js` が作成されます。`manifest.json` の `background.service_worker` をポイントしているファイル（例: `src/bg/background.js`）をこのビルド出力に置き換える、または `manifest.json` を `dist/extension/background.js` を指すように更新してローカルで読み込み直します。

注意: 現在のスクリプトは `src/extension/bg/background.ts` を優先しますが、存在しない場合は `youtube自動再生-clone/src/bg/background.js` をフォールバックとしてバンドルします。TypeScript で保守する場合は `src/extension/bg` に TS ファイルを配置してください。
configEl.innerHTML = `<div>環境: ${this.config.ENVIRONMENT}</div>
            <div>URL: ${this.config.SOCKET_URL}</div>
            <div>再接続: ${status.reconnectAttempts || 0}回</div>
            <div>キュー: ${status.pendingMessages || 0}件</div>`;
}

    handleBackgroundMessage(message) {
        switch (message.type) {
            case "socket_status_updated":
                this.updateUI(message.data);
                break;
            case "music_updated":
                this.refreshMusicList();
                break;
            default:
                console.log("[Popup] Unknown message:", message);
        }
    }

    setupEventHandlers() {
        // 設定更新ボタン
        document.getElementById("update-config").addEventListener("click", () => {
            this.showConfigDialog();
        });

        // 再接続ボタン
        document.getElementById("reconnect").addEventListener("click", () => {
            this.reconnectSocket();
        });

        // 音楽追加フォーム
        document.getElementById("add-music-form").addEventListener("submit", (e) => {
            e.preventDefault();
            const url = document.getElementById("music-url").value;
            this.addMusic(url);
        });
    }

    async addMusic(url) {
        try {
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ type: "add_music", data: { url } }, resolve);
            });

            if (response && response.success) {
                this.showSuccess("楽曲を追加しました");
                document.getElementById("music-url").value = "";
                this.refreshMusicList();
            } else {
                this.showError(response?.error || "追加に失敗しました");
            }
        } catch (error) {
            console.error("[Popup] Add music failed:", error);
            this.showError("追加処理中にエラーが発生しました");
        }
    }

    showConfigDialog() {
        // 設定ダイアログを表示
        // カスタムのSOCKET_URLを設定できるようにする
        const newUrl = prompt("Socket URL:", this.config.SOCKET_URL);
        if (newUrl && newUrl !== this.config.SOCKET_URL) {
            this.updateSocketUrl(newUrl);
        }
    }

    async updateSocketUrl(url) {
        try {
            // chrome.storageに保存
            await chrome.storage.local.set({ custom_socket_url: url });

            // Background scriptに通知
            chrome.runtime.sendMessage({
                type: "update_config",
                data: { socketUrl: url },
            });

            this.config.SOCKET_URL = url;
            this.showSuccess("設定を更新しました");

            // UI更新
            const status = await this.getSocketStatus();
            this.updateUI(status);
        } catch (error) {
            console.error("[Popup] Config update failed:", error);
            this.showError("設定の更新に失敗しました");
        }
    }

    reconnectSocket() {
        chrome.runtime.sendMessage({ type: "force_reconnect" });
        this.showInfo("再接続を開始しました...");
    }

    showSuccess(message) {
        this.showNotification(message, "success");
    }

    showError(message) {
        this.showNotification(message, "error");
    }

    showInfo(message) {
        this.showNotification(message, "info");
    }

    showNotification(message, type) {
        const notification = document.createElement("div");
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
new PopupManager();
});

````
## 🔧 Development vs Production の自動切り替え

### 開発時の動的URL注入

1. **開発環境判定**: manifest.versionやextension URLで判定
2. **Storage Override**: chrome.storage.localでカスタムURLを保存
3. **Environment Variables**: ビルド時の環境変数注入

### ビルド時設定

```bash
# 開発環境でのビルド
npm run build:dev

# 本番環境でのビルド
npm run build:prod
````

## 🔍 CSP (Content Security Policy) 対応

### Extension Pages CSP

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; connect-src 'self' http://localhost:* https://*.onrender.com wss://localhost:* wss://*.onrender.com;"
  }
}
```

### Socket.IOのCSP回避

1. **No eval()**: Socket.IOの設定で`allowEIO3: true`を使用
2. **Polling Preference**: WebSocketでなくpollingを優先
3. **Runtime messaging**: CSPを回避してメッセージングを使用

## 📊 監視とデバッグ

### Chrome DevTools での確認

1. **Extension Page**: `chrome://extensions/` でデバッグモード有効
2. **Background Logs**: Service Workerのコンソールを確認
3. **Storage**: chrome.storage.localの内容を確認

### ログレベル設定

```javascript
// config.jsでデバッグレベルを設定
const DEBUG_CONFIG = {
  SOCKET_EVENTS: true, // Socket.IOイベントログ
  CONNECTION_DETAILS: true, // 接続詳細ログ
  QUEUE_OPERATIONS: true, // キュー操作ログ
  ERROR_STACK_TRACE: true, // エラーのスタックトレース
};
```

## 🚨 トラブルシューティング

### よくある問題と解決策

1. **CORS エラー**
   - サーバー側でALLOW_EXTENSION_ORIGINS=trueを設定
   - manifest.jsonのhost_permissionsを確認

2. **WebSocket 接続失敗**
   - Polling優先設定を確認
   - Network tabでHandshakeエラーを確認

3. **Message 送信失敗**
   - Background scriptが生きているか確認
   - Service Workerのライフサイクルを考慮

4. **Storage Access エラー**
   - permissions配列に"storage"が含まれているか確認
   - Async/await使用時のエラーハンドリング

### デバッグコマンド

```javascript
// Background script内でのデバッグ
console.log("[Debug] Socket Status:", self.socketWrapper.getConnectionStatus());
console.log("[Debug] Background Stats:", self.backgroundManager.getStats());

// Popup内でのデバッグ
chrome.runtime.sendMessage({ type: "get_debug_info" }, console.log);
```

このセットアップにより、堅牢で監視可能な拡張機能の Socket.IO 通信が実現できます。
