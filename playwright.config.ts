import { defineConfig, devices } from "@playwright/test";

/**
 * E2E smoke: gerçek Supabase kullanıcıları gerekir (.env.e2e veya ortam değişkenleri).
 * Sunucu: ayrı terminalde `npm run dev` veya `PLAYWRIGHT_START_SERVER=1 npm run test:e2e`
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
    locale: "tr-TR",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: process.env.CI ? "retain-on-failure" : "off",
  },
  webServer: process.env.PLAYWRIGHT_START_SERVER
    ? {
        command: "npm run dev",
        url: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
