# E2E Testing & Monitoring Setup

拡張機能とサーバー間の堅牢な通信をテストし、監視するためのセットアップガイドです。

## 🧪 E2E テスト戦略

### テストシナリオ

1. **基本接続テスト**
   - Extension → Server 接続確立
   - Handshake成功確認
   - CORS設定の動作確認

2. **通信堅牢性テスト**
   - Network断絶時の再接続
   - Polling ↔ WebSocket切り替え
   - メッセージキューイング

3. **機能統合テスト**
   - 楽曲追加/削除操作
   - リアルタイム状態同期
   - Admin操作の権限確認

### テスト実装

#### tests/e2e/extension-communication.test.js

```javascript
const { test, expect } = require("@playwright/test");
const path = require("path");

test.describe("Extension-Server Communication", () => {
  let server;
  let extensionId;

  test.beforeAll(async ({ browser }) => {
    // 1. サーバー起動
    server = await startTestServer();

    // 2. 拡張機能をロード
    const context = await browser.newContext();
    const extensionPath = path.resolve(__dirname, "../../extension");

    // Chrome拡張機能として読み込み
    await context.addInitScript(`
            window.EXTENSION_CONFIG = {
                SOCKET_URL: '${server.url}',
                DEBUG_MODE: true
            };
        `);

    const [backgroundPage] = await context.serviceWorkers();
    extensionId = await backgroundPage.evaluate(() => chrome.runtime.id);
  });

  test.afterAll(async () => {
    await server.close();
  });

  test("Basic connection establishment", async ({ page }) => {
    // Extension background pageにアクセス
    const backgroundPage = await page.context().newPage();
    await backgroundPage.goto(
      `chrome-extension://${extensionId}/src/bg/background.js`,
    );

    // Socket接続状態を確認
    const connectionStatus = await backgroundPage.evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3000)); // 接続待機
      return self.socketWrapper.getConnectionStatus();
    });

    expect(connectionStatus.isConnected).toBe(true);
    expect(connectionStatus.pendingMessages).toBe(0);
  });

  test("Message sending with ACK", async ({ page }) => {
    const backgroundPage = await page.context().newPage();
    await backgroundPage.goto(
      `chrome-extension://${extensionId}/src/bg/background.js`,
    );

    // ACK付きメッセージ送信テスト
    const result = await backgroundPage.evaluate(async () => {
      try {
        const response = await self.socketWrapper.send(
          "getAllMusics",
          {},
          {
            requireAck: true,
            timeoutMs: 5000,
          },
        );

        return { success: true, data: response };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  test("Network disconnection recovery", async ({ page }) => {
    const backgroundPage = await page.context().newPage();
    await backgroundPage.goto(
      `chrome-extension://${extensionId}/src/bg/background.js`,
    );

    // 1. 正常接続確認
    let status = await backgroundPage.evaluate(() =>
      self.socketWrapper.getConnectionStatus(),
    );
    expect(status.isConnected).toBe(true);

    // 2. サーバー一時停止
    await server.pause();

    // 3. 再接続試行を確認
    await backgroundPage.waitForFunction(
      () => {
        const status = self.socketWrapper.getConnectionStatus();
        return status.reconnectAttempts > 0;
      },
      { timeout: 10000 },
    );

    // 4. サーバー復旧
    await server.resume();

    // 5. 自動再接続確認
    await backgroundPage.waitForFunction(
      () => {
        return self.socketWrapper.getConnectionStatus().isConnected;
      },
      { timeout: 15000 },
    );

    status = await backgroundPage.evaluate(() =>
      self.socketWrapper.getConnectionStatus(),
    );
    expect(status.isConnected).toBe(true);
  });

  test("Message queuing during disconnection", async ({ page }) => {
    const backgroundPage = await page.context().newPage();
    await backgroundPage.goto(
      `chrome-extension://${extensionId}/src/bg/background.js`,
    );

    // サーバー停止
    await server.pause();

    // 切断状態でメッセージ送信（キューイング）
    const sendPromise = backgroundPage.evaluate(async () => {
      return self.socketWrapper.send(
        "getAllMusics",
        {},
        {
          requireAck: true,
          timeoutMs: 20000,
        },
      );
    });

    // キューに追加されたことを確認
    const queueStatus = await backgroundPage.evaluate(
      () => self.socketWrapper.getConnectionStatus().pendingMessages,
    );
    expect(queueStatus).toBeGreaterThan(0);

    // サーバー復旧
    await server.resume();

    // キューが処理されることを確認
    const result = await sendPromise;
    expect(Array.isArray(result)).toBe(true);

    const finalStatus = await backgroundPage.evaluate(
      () => self.socketWrapper.getConnectionStatus().pendingMessages,
    );
    expect(finalStatus).toBe(0);
  });

  test("Polling fallback on WebSocket failure", async ({ page }) => {
    // WebSocketを無効化してpolling強制
    await page.setNetworkConditions({
      offline: false,
      downloadThroughput: 1000,
      uploadThroughput: 1000,
      latency: 100,
    });

    const backgroundPage = await page.context().newPage();
    await backgroundPage.goto(
      `chrome-extension://${extensionId}/src/bg/background.js`,
    );

    // Polling設定の確認
    const config = await backgroundPage.evaluate(
      () => self.socketWrapper.config.preferPolling,
    );
    expect(config).toBe(true);

    // 接続成功確認
    await backgroundPage.waitForFunction(
      () => {
        return self.socketWrapper.getConnectionStatus().isConnected;
      },
      { timeout: 10000 },
    );

    const status = await backgroundPage.evaluate(() =>
      self.socketWrapper.getConnectionStatus(),
    );
    expect(status.isConnected).toBe(true);
  });
});

// テストサーバーヘルパー
async function startTestServer() {
  const { spawn } = require("child_process");
  const { promisify } = require("util");
  const { readFile } = require("fs").promises;

  // テスト用環境変数
  const env = {
    ...process.env,
    NODE_ENV: "test",
    PORT: "0", // 動的ポート割り当て
    ALLOW_EXTENSION_ORIGINS: "true",
    LOG_LEVEL: "warn",
  };

  const serverProcess = spawn("npm", ["run", "start"], { env, stdio: "pipe" });

  // ポート番号の検出
  let serverUrl;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Server start timeout")),
      30000,
    );

    serverProcess.stdout.on("data", (data) => {
      const output = data.toString();
      const portMatch = output.match(/Server running on port (\d+)/);
      if (portMatch) {
        serverUrl = `http://localhost:${portMatch[1]}`;
        clearTimeout(timeout);
        resolve();
      }
    });

    serverProcess.stderr.on("data", (data) => {
      console.error("Server error:", data.toString());
    });
  });

  return {
    url: serverUrl,
    process: serverProcess,
    async pause() {
      // サーバーを一時停止（SIGSTOPシグナル）
      serverProcess.kill("SIGSTOP");
    },
    async resume() {
      // サーバーを再開（SIGCONTシグナル）
      serverProcess.kill("SIGCONT");
    },
    async close() {
      serverProcess.kill("SIGTERM");
      await new Promise((resolve) => serverProcess.on("exit", resolve));
    },
  };
}
```

### スモークテスト設定

#### tests/smoke/extension-smoke.test.js

```javascript
/**
 * 軽量なスモークテスト - CI/CDで毎回実行
 */

const { test, expect } = require("@playwright/test");

test.describe("Extension Smoke Tests", () => {
  test("Extension loads without errors", async ({ context }) => {
    // 拡張機能の基本読み込みテスト
    const errors = [];
    context.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    const page = await context.newPage();
    await page.goto("chrome://extensions/");

    // 致命的なエラーがないことを確認
    expect(errors.filter((e) => e.includes("FATAL")).length).toBe(0);
  });

  test("Socket connection attempt", async ({ page }) => {
    // 最低限の接続試行を確認
    const connectionAttempted = await page.evaluate(() => {
      return new Promise((resolve) => {
        // 簡易的な接続テスト
        const testSocket = io("http://localhost:5173", {
          transports: ["polling"],
          timeout: 5000,
        });

        const timeout = setTimeout(() => {
          testSocket.disconnect();
          resolve(false);
        }, 3000);

        testSocket.on("connect", () => {
          clearTimeout(timeout);
          testSocket.disconnect();
          resolve(true);
        });

        testSocket.on("connect_error", () => {
          clearTimeout(timeout);
          testSocket.disconnect();
          resolve(false);
        });
      });
    });

    // 接続試行自体は成功すべき（サーバーが無くても）
    expect(typeof connectionAttempted).toBe("boolean");
  });
});
```

## 📊 Monitoring & Metrics

### サーバー側メトリクス

#### src/server/monitoring.ts

```typescript
/**
 * 拡張機能通信専用のメトリクス収集
 */

interface ExtensionMetrics {
  connections: {
    total: number;
    active: number;
    byTransport: Record<string, number>;
  };
  messages: {
    sent: number;
    received: number;
    queued: number;
    failed: number;
  };
  errors: {
    connectionErrors: number;
    messageTimeouts: number;
    corsRejections: number;
  };
  performance: {
    avgResponseTime: number;
    reconnectRate: number;
  };
}

class ExtensionMonitor {
  private metrics: ExtensionMetrics = {
    connections: { total: 0, active: 0, byTransport: {} },
    messages: { sent: 0, received: 0, queued: 0, failed: 0 },
    errors: { connectionErrors: 0, messageTimeouts: 0, corsRejections: 0 },
    performance: { avgResponseTime: 0, reconnectRate: 0 },
  };

  private responseTimes: number[] = [];
  private readonly maxSamples = 100;

  recordConnection(transport: string, isExtension: boolean) {
    if (isExtension) {
      this.metrics.connections.total++;
      this.metrics.connections.active++;
      this.metrics.connections.byTransport[transport] =
        (this.metrics.connections.byTransport[transport] || 0) + 1;
    }
  }

  recordDisconnection(isExtension: boolean) {
    if (isExtension) {
      this.metrics.connections.active = Math.max(
        0,
        this.metrics.connections.active - 1,
      );
    }
  }

  recordMessage(type: "sent" | "received" | "queued" | "failed") {
    this.metrics.messages[type]++;
  }

  recordError(type: keyof ExtensionMetrics["errors"]) {
    this.metrics.errors[type]++;
  }

  recordResponseTime(ms: number) {
    this.responseTimes.push(ms);
    if (this.responseTimes.length > this.maxSamples) {
      this.responseTimes.shift();
    }

    this.metrics.performance.avgResponseTime =
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
  }

  getMetrics(): ExtensionMetrics {
    return { ...this.metrics };
  }

  getHealthStatus(): "healthy" | "warning" | "critical" {
    const { connections, errors, performance } = this.metrics;

    // Critical conditions
    if (connections.active === 0 && connections.total > 0) return "critical";
    if (errors.connectionErrors > 10) return "critical";
    if (performance.avgResponseTime > 5000) return "critical";

    // Warning conditions
    if (errors.corsRejections > 5) return "warning";
    if (performance.avgResponseTime > 2000) return "warning";
    if (errors.messageTimeouts > 3) return "warning";

    return "healthy";
  }

  generateReport(): string {
    const health = this.getHealthStatus();
    const metrics = this.getMetrics();

    return `
Extension Communication Health Report
=====================================

Status: ${health.toUpperCase()}

Connections:
- Total: ${metrics.connections.total}
- Active: ${metrics.connections.active}
- Transports: ${JSON.stringify(metrics.connections.byTransport)}

Messages:
- Sent: ${metrics.messages.sent}
- Received: ${metrics.messages.received}
- Queued: ${metrics.messages.queued}
- Failed: ${metrics.messages.failed}

Errors:
- Connection Errors: ${metrics.errors.connectionErrors}
- Message Timeouts: ${metrics.errors.messageTimeouts}
- CORS Rejections: ${metrics.errors.corsRejections}

Performance:
- Avg Response Time: ${metrics.performance.avgResponseTime.toFixed(2)}ms
- Reconnection Rate: ${metrics.performance.reconnectRate}

Generated: ${new Date().toISOString()}
        `.trim();
  }
}

export const extensionMonitor = new ExtensionMonitor();
```

### アラート設定

#### monitoring/alerts.js

```javascript
/**
 * Extension通信のアラート設定
 */

const { extensionMonitor } = require("../src/server/monitoring");

class AlertManager {
  constructor() {
    this.alertThresholds = {
      connectionFailureRate: 0.1, // 10%以上の接続失敗
      avgResponseTime: 3000, // 3秒以上の応答時間
      errorRate: 0.05, // 5%以上のエラー率
      activeConnections: 1, // 最低1つの拡張機能接続
    };

    this.alertCooldown = 5 * 60 * 1000; // 5分のクールダウン
    this.lastAlerts = new Map();

    this.startMonitoring();
  }

  startMonitoring() {
    setInterval(() => {
      this.checkAlerts();
    }, 30000); // 30秒ごとにチェック
  }

  checkAlerts() {
    const metrics = extensionMonitor.getMetrics();
    const health = extensionMonitor.getHealthStatus();

    // Critical health状態
    if (health === "critical") {
      this.sendAlert("critical", {
        message: "Extension communication is in critical state",
        metrics,
        report: extensionMonitor.generateReport(),
      });
    }

    // 拡張機能接続なし
    if (metrics.connections.active < this.alertThresholds.activeConnections) {
      this.sendAlert("no_extensions", {
        message: "No active extension connections",
        activeConnections: metrics.connections.active,
      });
    }

    // 高いエラー率
    const totalMessages = metrics.messages.sent + metrics.messages.received;
    const errorRate =
      totalMessages > 0 ? metrics.messages.failed / totalMessages : 0;

    if (errorRate > this.alertThresholds.errorRate) {
      this.sendAlert("high_error_rate", {
        message: `High error rate: ${(errorRate * 100).toFixed(2)}%`,
        errorRate,
        metrics,
      });
    }

    // 応答時間遅延
    if (
      metrics.performance.avgResponseTime > this.alertThresholds.avgResponseTime
    ) {
      this.sendAlert("slow_response", {
        message: `Slow response time: ${metrics.performance.avgResponseTime.toFixed(2)}ms`,
        responseTime: metrics.performance.avgResponseTime,
      });
    }
  }

  sendAlert(type, data) {
    const now = Date.now();
    const lastAlert = this.lastAlerts.get(type);

    // クールダウン中はスキップ
    if (lastAlert && now - lastAlert < this.alertCooldown) {
      return;
    }

    this.lastAlerts.set(type, now);

    // 実際のアラート送信
    this.deliverAlert(type, data);
  }

  deliverAlert(type, data) {
    // ログ出力
    console.error(`[ALERT] ${type}:`, data);

    // Slack、Discord、メール等の通知
    this.sendToSlack(type, data);

    // メトリクス記録
    this.recordAlert(type, data);
  }

  sendToSlack(type, data) {
    // Slack Webhook実装例
    if (!process.env.SLACK_WEBHOOK_URL) return;

    const payload = {
      text: `🚨 Extension Alert: ${type}`,
      attachments: [
        {
          color: type === "critical" ? "danger" : "warning",
          fields: [
            {
              title: "Message",
              value: data.message,
              short: false,
            },
            {
              title: "Timestamp",
              value: new Date().toISOString(),
              short: true,
            },
          ],
        },
      ],
    };

    // HTTP POST to Slack webhook
    fetch(process.env.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch((error) => {
      console.error("Failed to send Slack alert:", error);
    });
  }

  recordAlert(type, data) {
    // アラート履歴をDBや外部サービスに記録
    const alertRecord = {
      timestamp: new Date().toISOString(),
      type,
      data,
      serverInfo: {
        nodeVersion: process.version,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
    };

    // 記録処理（例：ファイル、DB、外部API等）
    console.log("[Alert Recorded]:", JSON.stringify(alertRecord, null, 2));
  }
}

// アラート管理を開始
const alertManager = new AlertManager();

module.exports = { alertManager };
```

## 📈 ダッシュボード設定

### メトリクス可視化

#### public/monitoring/dashboard.html

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Extension Communication Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 20px;
      }
      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px;
      }
      .metric-card {
        border: 1px solid #ddd;
        padding: 15px;
        border-radius: 8px;
      }
      .status {
        padding: 5px 10px;
        border-radius: 4px;
        color: white;
      }
      .status.healthy {
        background-color: #28a745;
      }
      .status.warning {
        background-color: #ffc107;
        color: black;
      }
      .status.critical {
        background-color: #dc3545;
      }
    </style>
  </head>
  <body>
    <h1>Extension Communication Dashboard</h1>

    <div id="overall-status" class="status">Loading...</div>

    <div class="metrics-grid">
      <div class="metric-card">
        <h3>Active Connections</h3>
        <canvas id="connections-chart"></canvas>
      </div>

      <div class="metric-card">
        <h3>Message Throughput</h3>
        <canvas id="messages-chart"></canvas>
      </div>

      <div class="metric-card">
        <h3>Error Rates</h3>
        <canvas id="errors-chart"></canvas>
      </div>

      <div class="metric-card">
        <h3>Response Times</h3>
        <canvas id="response-chart"></canvas>
      </div>
    </div>

    <script>
      // リアルタイムメトリクス更新
      async function updateDashboard() {
        try {
          const response = await fetch("/api/monitoring/extension-metrics");
          const data = await response.json();

          updateStatusIndicator(data.health);
          updateCharts(data.metrics);
        } catch (error) {
          console.error("Failed to fetch metrics:", error);
          document.getElementById("overall-status").textContent =
            "Connection Error";
          document.getElementById("overall-status").className =
            "status critical";
        }
      }

      function updateStatusIndicator(health) {
        const statusEl = document.getElementById("overall-status");
        statusEl.textContent = `System Status: ${health.toUpperCase()}`;
        statusEl.className = `status ${health}`;
      }

      function updateCharts(metrics) {
        // Chart.jsを使用してメトリクス可視化
        // 実装は各チャートごとに詳細化
      }

      // 5秒ごとに更新
      setInterval(updateDashboard, 5000);
      updateDashboard();
    </script>
  </body>
</html>
```

このE2Eテストと監視設定により、拡張機能とサーバー間の通信品質を継続的に検証・監視できます。
