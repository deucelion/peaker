import type { Page } from "@playwright/test";

/** Login formu — placeholder’lar login sayfasıyla uyumlu. */
export async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("e-posta adresiniz").fill(email);
  await page.getByPlaceholder("ŞİFRE").fill(password);
  await page.getByRole("button", { name: /SİSTEME GİRİŞ YAP/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 60_000 });
}

/** Dashboard layout yüklendi (kenar çubuk). */
export async function waitForDashboardShell(page: Page): Promise<void> {
  await page.locator("#dashboard-sidebar").waitFor({ state: "visible", timeout: 60_000 });
}
