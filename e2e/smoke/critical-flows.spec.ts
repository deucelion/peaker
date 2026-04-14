import { test, expect } from "@playwright/test";
import { loginViaUi, waitForDashboardShell } from "../helpers/auth";
import { hasPair } from "../helpers/env";

/**
 * Kritik duman testleri — Supabase’de tanımlı gerçek kullanıcılar gerekir.
 * Eksik env ile ilgili testler atlanır (skipped).
 */

test.describe.configure({ mode: "serial" });

test("super_admin: giriş → Super Admin paneli", async ({ page }) => {
  test.skip(
    !hasPair(process.env.E2E_SUPER_ADMIN_EMAIL, process.env.E2E_SUPER_ADMIN_PASSWORD),
    "E2E_SUPER_ADMIN_EMAIL / E2E_SUPER_ADMIN_PASSWORD tanımlı değil"
  );
  await loginViaUi(page, process.env.E2E_SUPER_ADMIN_EMAIL!, process.env.E2E_SUPER_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(/\/super-admin/);
  await expect(page.getByRole("heading", { name: /SUPER ADMIN/i })).toBeVisible();
});

test("admin: dashboard + aidat + özel paket + sporcular + koçlar (ve varsa koç detay)", async ({ page }) => {
  test.skip(
    !hasPair(process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD),
    "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD tanımlı değil"
  );
  await loginViaUi(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await waitForDashboardShell(page);
  await expect(page).toHaveURL(/\//);
  await expect(page.getByRole("heading", { name: /AKADEMİ|PANELİ/i })).toBeVisible();

  await page.goto("/finans");
  await expect(page.getByRole("heading", { name: /AİDAT/i })).toBeVisible();

  await page.goto("/ozel-ders-paketleri");
  await expect(page.getByRole("heading", { name: /ÖZEL DERS/i })).toBeVisible();
  const packageLinks = page.locator('.ui-page a[href^="/ozel-ders-paketleri/"]');
  if ((await packageLinks.count()) > 0) {
    await packageLinks.first().click();
    await expect(page).toHaveURL(/\/ozel-ders-paketleri\/[0-9a-f-]{20,}/i);
    await expect(page.locator("h1").first()).toBeVisible();
  }

  await page.goto("/oyuncular");
  await expect(page.getByRole("heading", { name: /TAKIM/i })).toBeVisible();

  await page.goto("/koclar");
  await expect(page.getByRole("heading", { name: /KOÇ/i })).toBeVisible();

  const coachRowLinks = page.locator('.ui-page a[href^="/koclar/"]');
  if ((await coachRowLinks.count()) > 0) {
    await coachRowLinks.first().click();
    await expect(page).toHaveURL(/\/koclar\/[0-9a-f-]{20,}/i);
    await expect(page.locator("h1").first()).toBeVisible();
  }
});

test("coach: giriş → günlük operasyon paneli", async ({ page }) => {
  test.skip(
    !hasPair(process.env.E2E_COACH_EMAIL, process.env.E2E_COACH_PASSWORD),
    "E2E_COACH_EMAIL / E2E_COACH_PASSWORD tanımlı değil"
  );
  await loginViaUi(page, process.env.E2E_COACH_EMAIL!, process.env.E2E_COACH_PASSWORD!);
  await waitForDashboardShell(page);
  await expect(page).toHaveURL(/\//);
  await expect(page.getByRole("heading", { name: /GUNLUK|OPERASYON/i })).toBeVisible();
});

test("athlete: giriş → sporcu paneli", async ({ page }) => {
  test.skip(
    !hasPair(process.env.E2E_ATHLETE_EMAIL, process.env.E2E_ATHLETE_PASSWORD),
    "E2E_ATHLETE_EMAIL / E2E_ATHLETE_PASSWORD tanımlı değil"
  );
  await loginViaUi(page, process.env.E2E_ATHLETE_EMAIL!, process.env.E2E_ATHLETE_PASSWORD!);
  await waitForDashboardShell(page);
  await expect(page).toHaveURL(/\/sporcu/);
  await expect(page.getByRole("heading", { name: /KİŞİSEL|ANALİZ/i })).toBeVisible();
});
