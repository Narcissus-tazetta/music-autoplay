import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 30_000,
    retries: 0,
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
        headless: true,
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    /* Run your local dev server before starting the tests */
    webServer: {
        command: 'bun run dev',
        reuseExistingServer: !process.env.CI,
        url: 'http://localhost:3000',
    },
});
