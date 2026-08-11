/**
 * Mobile viewport smoke for field-test metric inputs.
 *
 * NOTE: This does NOT prove real iPhone/iPad Safari behavior — only DOM/layout
 * in Chromium with mobile viewport. Manual Safari verification still required.
 */
import { test, expect } from "@playwright/test";
import { loginViaUi, waitForDashboardShell } from "../helpers/auth";
import { hasPair } from "../helpers/env";

test.describe("field test mobile viewport", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("metric inputs are visible and accept values at mobile width", async ({ page }) => {
    test.skip(
      !hasPair(process.env.E2E_COACH_EMAIL, process.env.E2E_COACH_PASSWORD),
      "E2E_COACH_EMAIL / E2E_COACH_PASSWORD tanımlı değil"
    );

    await loginViaUi(page, process.env.E2E_COACH_EMAIL!, process.env.E2E_COACH_PASSWORD!);
    await waitForDashboardShell(page);

    const today = new Date().toISOString().slice(0, 10);
    await page.goto(`/saha-testleri/oturum/${today}`);

    const numericInputs = page.locator('input[type="number"]');
    await expect(numericInputs.first()).toBeVisible({ timeout: 20_000 });

    const first = numericInputs.nth(0);
    const second = numericInputs.nth(1);

    await expect(first).toBeEnabled();
    await expect(second).toBeEnabled();

    await first.fill("12.5");
    await first.blur();
    await expect(first).toHaveValue("12.5");

    await second.fill("9.25");
    await second.blur();
    await expect(second).toHaveValue("9.25");
  });
});

test.describe("field test tablet viewport", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test("left/right column inputs both accept values at tablet width", async ({ page }) => {
    test.skip(
      !hasPair(process.env.E2E_COACH_EMAIL, process.env.E2E_COACH_PASSWORD),
      "E2E_COACH_EMAIL / E2E_COACH_PASSWORD tanımlı değil"
    );

    await loginViaUi(page, process.env.E2E_COACH_EMAIL!, process.env.E2E_COACH_PASSWORD!);
    await waitForDashboardShell(page);

    const today = new Date().toISOString().slice(0, 10);
    await page.goto(`/saha-testleri/oturum/${today}`);

    const numericInputs = page.locator('input[type="number"]');
    await expect(numericInputs.first()).toBeVisible({ timeout: 20_000 });

    const leftColumn = numericInputs.nth(0);
    const rightColumn = numericInputs.nth(1);

    await leftColumn.fill("20");
    await leftColumn.blur();
    await expect(leftColumn).toHaveValue("20");

    await rightColumn.fill("30");
    await rightColumn.blur();
    await expect(rightColumn).toHaveValue("30");
  });
});
