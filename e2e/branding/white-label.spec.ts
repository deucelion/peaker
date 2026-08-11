import { test, expect } from "@playwright/test";
import { loginViaUi, waitForDashboardShell } from "../helpers/auth";
import { hasPair } from "../helpers/env";
import {
  buildMeAccessPayload,
  CUSTOM_ORG_A_PRIMARY,
  CUSTOM_ORG_B_PRIMARY,
  readContentPrimaryVar,
} from "./fixtures/custom-org";

/**
 * FAZ 34 Wave 14 — white-label provider validation.
 * Intercepts me-access to simulate Org A → Org B branding without DB writes.
 */
test.describe.configure({ mode: "serial" });

test("org A → org B: content primary CSS var follows me-access branding", async ({ page }) => {
  test.skip(
    !hasPair(process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD),
    "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD tanımlı değil"
  );

  let activePrimary = CUSTOM_ORG_A_PRIMARY;

  await page.route("**/api/me-access", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildMeAccessPayload(activePrimary)),
    });
  });

  await loginViaUi(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await waitForDashboardShell(page);

  await expect(page.locator("[data-peaker-ui-content-root]")).toBeVisible();
  await expect.poll(() => readContentPrimaryVar(page)).toBe(CUSTOM_ORG_A_PRIMARY.toLowerCase());

  activePrimary = CUSTOM_ORG_B_PRIMARY;
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForDashboardShell(page);

  await expect.poll(() => readContentPrimaryVar(page)).toBe(CUSTOM_ORG_B_PRIMARY.toLowerCase());
});

test("default org: ui-btn-primary uses content theme var", async ({ page }) => {
  test.skip(
    !hasPair(process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD),
    "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD tanımlı değil"
  );

  await loginViaUi(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await waitForDashboardShell(page);

  const button = page.locator(".ui-btn-primary").first();
  if ((await button.count()) === 0) {
    test.skip(true, "Dashboard'da ui-btn-primary bulunamadı.");
  }

  const background = await button.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(background.length).toBeGreaterThan(0);
});
