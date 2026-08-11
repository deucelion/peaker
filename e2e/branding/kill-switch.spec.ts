import { test, expect } from "@playwright/test";
import { loginViaUi, waitForDashboardShell } from "../helpers/auth";
import { hasPair } from "../helpers/env";
import { createDefaultBranding } from "../../src/lib/organization/branding/defaults";

/**
 * FAZ 34 Wave 14 — kill switch OFF parity (production default).
 */
test("kill switch OFF: me-access returns default branding revision 0", async ({ page }) => {
  test.skip(
    !hasPair(process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD),
    "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD tanımlı değil"
  );

  await loginViaUi(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await waitForDashboardShell(page);

  const response = await page.request.get("/api/me-access");
  expect(response.ok()).toBe(true);

  const payload = (await response.json()) as {
    brandingRevision?: number;
    organizationBranding?: { theme?: { primary?: string } };
  };

  expect(payload.brandingRevision).toBe(0);
  expect(payload.organizationBranding?.theme?.primary?.toLowerCase()).toBe(
    createDefaultBranding().theme.primary.toLowerCase()
  );
});

test("kill switch OFF: content root exposes default primary token", async ({ page }) => {
  test.skip(
    !hasPair(process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD),
    "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD tanımlı değil"
  );

  await loginViaUi(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await waitForDashboardShell(page);

  const primary = await page.locator("[data-peaker-ui-content-root]").evaluate((el) => {
    const inline = el.style.getPropertyValue("--peaker-ui-PRIMARY").trim();
    return (inline || getComputedStyle(el).getPropertyValue("--peaker-ui-PRIMARY")).trim().toLowerCase();
  });

  expect(primary).toBe(createDefaultBranding().theme.primary.toLowerCase());
});
