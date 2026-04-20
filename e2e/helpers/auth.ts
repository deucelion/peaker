import type { Page } from "@playwright/test";

/** Login formu — placeholder’lar login sayfasıyla uyumlu. */
export async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const emailInput = page.getByPlaceholder("e-posta adresiniz");
  const passwordInput = page.getByPlaceholder("ŞİFRE");
  await emailInput.fill(email);
  await passwordInput.fill(password);

  const emailValue = await emailInput.inputValue();
  const passLen = (await passwordInput.inputValue()).length;
  if (!emailValue.trim() || passLen === 0) {
    throw new Error("Login formuna kimlik bilgileri yazilamadi (input bos kaldi).");
  }

  const authResponsePromise = page
    .waitForResponse(
      (resp) => resp.url().includes("/auth/v1/token") && resp.request().method() === "POST",
      { timeout: 20_000 }
    )
    .catch(() => null);

  await page.getByRole("button", { name: /SİSTEME GİRİŞ YAP/i }).click();
  const authResponse = await authResponsePromise;
  if (!authResponse) {
    throw new Error("Login istegi Supabase auth endpoint'ine ulasmadi.");
  }

  if (!authResponse.ok()) {
    const body = await authResponse.text().catch(() => "");
    throw new Error(`Login auth hatasi: HTTP ${authResponse.status()} ${body.slice(0, 280)}`);
  }

  const navigated = await page
    .waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20_000 })
    .then(() => true)
    .catch(() => false);

  if (!navigated) {
    let alertText = "";
    try {
      alertText = (
        ((await page.locator('[role="alert"]').first().textContent({ timeout: 1000 })) || "") ||
        ((await page.locator("text=/giriş|hata|geçersiz|yanlış/i").first().textContent({ timeout: 1000 })) || "")
      ).trim();
    } catch {
      // sayfa kapanmış olabilir; asıl hata mesajını basit tut.
    }
    const currentUrl = (() => {
      try {
        return page.url();
      } catch {
        return "page-closed";
      }
    })();
    throw new Error(`Login basarisiz veya yonlendirme olmadi. URL=${currentUrl} | Mesaj=${alertText || "yok"}`);
  }
}

/** Dashboard layout yüklendi (kenar çubuk). */
export async function waitForDashboardShell(page: Page): Promise<void> {
  await page.locator("#dashboard-sidebar").waitFor({ state: "visible", timeout: 60_000 });
}
