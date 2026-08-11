import { test, expect } from "@playwright/test";

/**
 * FAZ 34 Wave 14 — Storybook visual catalog snapshots (blocking when STORYBOOK_URL set).
 *
 * Baselines live in e2e/branding/visual/baselines/.
 * Update baselines: BRANDING_VISUAL_UPDATE=1 STORYBOOK_URL=http://127.0.0.1:6006 npm run test:e2e:branding:visual
 */
const STORYBOOK_URL = process.env.STORYBOOK_URL || "http://127.0.0.1:6006";

const CATALOG_STORIES = [
  { id: "branding-button--primary", name: "button-primary" },
  { id: "branding-empty-loading-kpi-wave-13--kpi-widget", name: "kpi-widget" },
  { id: "branding-empty-loading-kpi-wave-13--empty-card", name: "empty-card" },
  { id: "branding-charts-wave-12--chart-frame-empty", name: "chart-empty" },
  { id: "branding-tables-wave-11--basic-table", name: "table-basic" },
] as const;

test.describe("Storybook branding visual catalog", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.STORYBOOK_URL && !process.env.BRANDING_VISUAL_UPDATE, "STORYBOOK_URL not set");
  });

  for (const story of CATALOG_STORIES) {
    test(`snapshot: ${story.name}`, async ({ page }) => {
      const url = `${STORYBOOK_URL}/iframe.html?id=${story.id}&viewMode=story`;
      await page.goto(url, { waitUntil: "networkidle" });
      await page.locator("#storybook-root").waitFor({ state: "visible", timeout: 30_000 });

      if (process.env.BRANDING_VISUAL_UPDATE === "1") {
        await page.locator("#storybook-root").screenshot({
          path: `e2e/branding/visual/baselines/${story.name}.png`,
        });
        return;
      }

      await expect(page.locator("#storybook-root")).toHaveScreenshot(`${story.name}.png`, {
        maxDiffPixelRatio: 0.005,
      });
    });
  }
});
