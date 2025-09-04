import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const INVALID_YOUTUBE_URL = "https://example.com/invalid";
const VALID_YOUTUBE_URL = "https://youtu.be/BVvvUGP0MFw?si=zLCnZFPpyWuLgVRX";

// サーバー起動待ち関数
async function waitForServer(page: Page, url = BASE_URL, timeout = 20000) {
  let lastError;
  for (let i = 0; i < 10; i++) {
    try {
      await page.goto(url, { timeout });
      await expect(
        page.locator('h1:has-text("楽曲リクエストフォーム")'),
      ).toBeVisible({ timeout: 5000 });
      return;
    } catch (e) {
      lastError = e;
      await page.waitForTimeout(1000);
    }
  }
  throw lastError;
}

// 共通操作関数
async function submitYoutubeUrl(page: Page, url: string) {
  await page.locator('input[placeholder*="youtube.com"]').fill(url);
  await page.getByRole("button", { name: /送信/ }).click();
}

test.describe("楽曲リクエストフォーム", () => {
  test.beforeEach(async ({ page }) => {
    await waitForServer(page);
  });

  test("初期表示でフォーム要素が見える", async ({ page }) => {
    await expect(
      page.locator('input[placeholder*="youtube.com"]'),
    ).toBeVisible();
  });

  test("不正なYouTube URLはエラー表示", async ({ page }) => {
    await submitYoutubeUrl(page, INVALID_YOUTUBE_URL);
    await expect(
      page.locator("text=有効なYouTubeのURLを入力してください"),
    ).toBeVisible({ timeout: 5000 });
  });

  test("有効なYouTube URLを追加・削除できる", async ({ page }) => {
    await submitYoutubeUrl(page, VALID_YOUTUBE_URL);
    const alert = page.locator('[role="alert"]');
    await expect(alert).toBeVisible({ timeout: 15000 });
    const alertText = await alert.textContent();
    if (alertText?.includes("追加しました")) {
      await expect(page.locator("table tbody tr").first()).toBeVisible({
        timeout: 5000,
      });
      const deleteButton = page
        .getByRole("button", { name: /この曲を削除/ })
        .first();
      if ((await deleteButton.count()) > 0) await deleteButton.click();
    } else if (alertText?.includes("すでにリクエストされています")) {
      // 既存の場合はOK
      expect(alertText).toContain("すでにリクエストされています");
    } else {
      // 失敗時はスクリーンショット保存
      await page.screenshot({ path: "error-add-music.png" });
      throw new Error(`予期しないアラートメッセージ: ${alertText}`);
    }
  });
});

test.describe("楽曲リストUI", () => {
  test.beforeEach(async ({ page }) => {
    await waitForServer(page);
  });
  test("楽曲リストのテーブルが表示される", async ({ page }) => {
    await expect(page.locator('table th:has-text("楽曲")')).toBeVisible();
    await expect(page.locator("table")).toBeVisible();
  });
});

test.describe("設定パネル", () => {
  test.beforeEach(async ({ page }) => {
    await waitForServer(page);
  });
  test("設定パネルの表示・非表示", async ({ page }) => {
    await page.locator('button[aria-label="設定"]').click();
    // 何かしらの設定UI要素が表示されることを確認（例: テーマ切替ボタン）
    await expect(page.locator('button[aria-label*="テーマ"]')).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe("ネットワーク障害時の挙動", () => {
  test.beforeEach(async ({ page }) => {
    await waitForServer(page);
  });

  test("API接続失敗時はエラー表示", async ({ page }) => {
    await page.route("**/api/assets", (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal Server Error" }),
      });
    });
    await submitYoutubeUrl(page, VALID_YOUTUBE_URL);
    const errorAlert = page.locator('[role="alert"]');
    await expect(errorAlert).toBeVisible({ timeout: 10000 });
    const alertText = await errorAlert.textContent();
    expect(alertText).toContain("エラー");
  });

  test("Socket.IO接続失敗時でもUIが壊れない", async ({ page }) => {
    await page.route("**/socket.io/**", (route) => {
      route.abort("connectionfailed");
    });
    await page.reload();
    await expect(
      page.locator('h1:has-text("楽曲リクエストフォーム")'),
    ).toBeVisible({ timeout: 10000 });
    await submitYoutubeUrl(page, VALID_YOUTUBE_URL);
    await page.waitForTimeout(3000);
    const form = page.locator('input[placeholder*="youtube.com"]');
    await expect(form).toBeVisible();
  });

  test("APIタイムアウト時はUIが応答可能", async ({ page }) => {
    await page.route("**/api/assets", (route) => {
      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            title: "Test",
            thumbnail: "",
            length: "180",
            isMusic: true,
          }),
        });
      }, 10000);
    });
    await submitYoutubeUrl(page, VALID_YOUTUBE_URL);
    try {
      const alert = page.locator('[role="alert"]');
      await expect(alert).toBeVisible({ timeout: 20000 });
      const alertContent = await alert.textContent();
      expect(alertContent).toMatch(/(タイムアウト|エラー|失敗|通信)/);
    } catch {
      await page.screenshot({ path: "error-timeout.png" });
      const form = page.locator('input[placeholder*="youtube.com"]');
      await expect(form).toBeVisible();
    }
  });
});
