import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  // retry once on CI to reduce flakes
  retries: process.env.CI ? 1 : 0,
  // In CI we often want a single worker to avoid multiple webServer start conflicts.
  // Locally keep Playwright default (undefined) so developers can use parallel workers.
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    headless: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  /* Run your local dev server before starting the tests */
  webServer: {
    // Use a small wrapper that will either reuse an existing server (if port busy)
    // or exec the real start script in the foreground so Playwright can manage it.
    command: "bash ./scripts/playwright-start-wrapper.sh",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
