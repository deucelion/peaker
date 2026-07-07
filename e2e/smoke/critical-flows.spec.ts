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
  await expect(page).toHaveURL(/\/tahsilat-merkezi\?bolum=sporcular/);

  await page.goto("/muhasebe-finans");
  await expect(page).toHaveURL(/\/tahsilat-merkezi\?bolum=tahsilatlar/);

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

  // Faz 3.3 — Sporcu Yönetimi → Takım Yönetimi geçişi. Buton mevcutsa
  // takımlar workspace'i açılır; tablo veya empty-state durumu doğrulanır.
  const teamWorkspaceButton = page.getByRole("button", { name: /Takım yönetimi/i });
  if ((await teamWorkspaceButton.count()) > 0) {
    await teamWorkspaceButton.first().click();
    await expect(page.getByRole("heading", { name: /Takım yönetimi/i })).toBeVisible();
    // Tablo (ekipler varsa) veya "Henüz takım oluşturulmadı" empty-state.
    const teamsTable = page.locator("table");
    const teamsEmpty = page.getByText(/Henüz takım oluşturulmadı/i);
    await expect(teamsTable.or(teamsEmpty)).toBeVisible();
    // Kadro ekranına geri dön.
    await page.getByRole("button", { name: /Sporcu yönetimi ekranına dön/i }).click();
  }

  await page.goto("/koclar");
  await expect(page.getByRole("heading", { name: /KOÇ/i })).toBeVisible();

  // Performans Merkezi: yalnızca route + h1 erişilebilirliği — veri girişi gerektirmez.
  await page.goto("/performans");
  await expect(page.getByRole("heading", { name: /PERFORMANS/i })).toBeVisible();

  // Tahsilat Merkezi (birleşik finans workspace): route + h1 + sekmeler.
  await page.goto("/tahsilat-merkezi");
  await expect(page.getByRole("heading", { name: /TAHSİLAT/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Özet/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Tahsilatlar/i })).toBeVisible();

  // Faz 3.3 — Audit log UI smoke (admin görür). H1 + sayfalama veya empty state.
  await page.goto("/audit-log");
  await expect(page.getByRole("heading", { name: /Audit/i })).toBeVisible();
  const auditList = page.locator("section").filter({ hasText: /Kayıtlar/i });
  await expect(auditList.first()).toBeVisible();

  const coachRowLinks = page.locator('.ui-page a[href^="/koclar/"]');
  if ((await coachRowLinks.count()) > 0) {
    await coachRowLinks.first().click();
    await expect(page).toHaveURL(/\/koclar\/[0-9a-f-]{20,}/i);
    await expect(page.locator("h1").first()).toBeVisible();
  }
});

/**
 * Faz 3.3 — Özel Ders Paketi ödeme akışı için skeleton.
 *
 * Tam ödeme akışını çalıştırmak side-effect doğurur (gerçek ödeme satırı yazar).
 * Bu yüzden skeleton: sayfanın açılması, paket varsa detay açılması ve
 * "Ödeme" CTA'sının/formunun erişilebilirliği. Form submit yapılmaz.
 */
test("admin: özel ders paketi ödeme formu skeleton (form-only)", async ({ page }) => {
  test.skip(
    !hasPair(process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD),
    "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD tanımlı değil"
  );
  await loginViaUi(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await waitForDashboardShell(page);

  await page.goto("/ozel-ders-paketleri");
  await expect(page.getByRole("heading", { name: /ÖZEL DERS/i })).toBeVisible();

  const packageLinks = page.locator('a[href^="/ozel-ders-paketleri/"]');
  const count = await packageLinks.count();
  test.skip(count === 0, "Paket bulunamadı; ödeme skeleton testi atlandı.");

  await packageLinks.first().click();
  await expect(page).toHaveURL(/\/ozel-ders-paketleri\/[0-9a-f-]{20,}/i);
  await expect(page.locator("h1").first()).toBeVisible();

  // Ödeme bölümü erişilebilir mi? "Ödeme" başlığı veya tutar input'u beklenir.
  const paymentArea = page.getByText(/Ödeme|Tahsilat/i).first();
  if ((await paymentArea.count()) > 0) {
    await expect(paymentArea).toBeVisible();
  }
});

/**
 * Faz 3.3 — Sporcu RPE anketi → Performans Merkezi route doğrulaması.
 *
 * Sporcu olarak giriş yapılır; anket sayfası ve performans verisi izinleri varsa
 * /performans yönlendirmesi de çalışmalı. RPE submit yapılmaz (yan etki olur).
 */
test("athlete: anket sayfası açılır, performans verisi izniyle uyumludur", async ({ page }) => {
  test.skip(
    !hasPair(process.env.E2E_ATHLETE_EMAIL, process.env.E2E_ATHLETE_PASSWORD),
    "E2E_ATHLETE_EMAIL / E2E_ATHLETE_PASSWORD tanımlı değil"
  );
  await loginViaUi(page, process.env.E2E_ATHLETE_EMAIL!, process.env.E2E_ATHLETE_PASSWORD!);
  await waitForDashboardShell(page);

  // Sporcu paneli ana sayfası.
  await expect(page).toHaveURL(/\/sporcu/);

  // Anket sayfası: izin kapalıysa proxy başka sayfaya gönderir; bu durumda skip.
  await page.goto("/anket");
  if (!page.url().includes("/anket")) {
    test.skip(true, "Anket erişimi izinle kapalı; smoke atlandı.");
  }
  await expect(page.locator("h1").first()).toBeVisible();
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

test("injury-notes smoke: admin create → athlete view + athlete write yok", async ({ page }) => {
  test.skip(
    !hasPair(process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD) ||
      !hasPair(process.env.E2E_ATHLETE_EMAIL, process.env.E2E_ATHLETE_PASSWORD),
    "E2E_ADMIN_* ve E2E_ATHLETE_* tanımlı değil"
  );

  // 1) Athlete login: ad bilgisini al (admin tarafta doğru sporcuyu bulmak için)
  await loginViaUi(page, process.env.E2E_ATHLETE_EMAIL!, process.env.E2E_ATHLETE_PASSWORD!);
  await waitForDashboardShell(page);
  await expect(page).toHaveURL(/\/sporcu/);
  const athleteName = ((await page.locator("aside h2").first().textContent()) || "").trim();
  test.skip(!athleteName, "Sporcu adı okunamadı; smoke eşleme yapılamadı.");

  // Aynı context'te kullanıcı değişimi için oturumu temizle.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();

  // 2) Admin login: sporcuyu bul ve sakatlık kaydı oluştur
  await loginViaUi(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await waitForDashboardShell(page);
  await page.goto("/oyuncular");
  await page.getByPlaceholder(/KADRODA ARA/i).fill(athleteName);

  const athleteCardLink = page.locator(`a[href^="/sporcu/"]`).first();
  await expect(athleteCardLink).toBeVisible();
  await athleteCardLink.click();
  await expect(page).toHaveURL(/\/sporcu\/[0-9a-f-]{20,}/i);

  const uniqueToken = `SMOKE-${Date.now()}`;
  await page.getByPlaceholder(/Sakatlık türü/i).fill("Hamstring Zorlanması");
  await page.getByPlaceholder(/Antrenör notu/i).fill(`Smoke notu ${uniqueToken}`);
  await page.getByRole("button", { name: /Sakatlık Kaydı Ekle/i }).click();
  await expect(page.getByText(/Sakatlik kaydi eklendi/i)).toBeVisible();

  // Admin tarafında kaydın göründüğünü doğrula.
  await expect(page.getByText(uniqueToken)).toBeVisible();

  // Tekrar oturum temizle ve athlete olarak doğrula.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();

  // 3) Athlete login: kayıt görünmeli, yazma kontrolü olmamalı
  await loginViaUi(page, process.env.E2E_ATHLETE_EMAIL!, process.env.E2E_ATHLETE_PASSWORD!);
  await waitForDashboardShell(page);
  await expect(page).toHaveURL(/\/sporcu/);
  await expect(page.getByText(uniqueToken)).toBeVisible();
  await expect(page.getByRole("button", { name: /Sakatlık Kaydı Ekle/i })).toHaveCount(0);
  await expect(page.getByPlaceholder(/Sakatlık türü/i)).toHaveCount(0);
  await expect(page.getByPlaceholder(/Antrenör notu/i)).toHaveCount(0);
});
