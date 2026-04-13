# E2E smoke testleri (Playwright)

Kritik oturum ve yönlendirme akışlarını gerçek tarayıcıda doğrular. **Yeni ürün özelliği değildir**; regresyon ağıdır.

## Önkoşullar

1. Uygulama çalışıyor olmalı: `npm run dev` (varsayılan `http://127.0.0.1:3000`).
2. Supabase’de test amaçlı kullanıcılar (roller: `super_admin`, `admin`, `coach`, `sporcu`).
3. Tarayıcı motoru: `npx playwright install chromium` (ilk kurulumda).

## Ortam değişkenleri

Repoda örnek: [`.env.e2e.example`](../.env.e2e.example). Değerleri doldurup:

```bash
export $(grep -v '^#' .env.e2e | xargs)
npm run test:e2e
```

veya tek tek `export E2E_ADMIN_EMAIL=...` vb.

| Değişken | Rol |
|----------|-----|
| `E2E_SUPER_ADMIN_EMAIL` / `E2E_SUPER_ADMIN_PASSWORD` | Platform süper admin |
| `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` | Organizasyon admini |
| `E2E_COACH_EMAIL` / `E2E_COACH_PASSWORD` | Koç |
| `E2E_ATHLETE_EMAIL` / `E2E_ATHLETE_PASSWORD` | Sporcu |

İsteğe bağlı:

- `PLAYWRIGHT_BASE_URL` — varsayılan `http://127.0.0.1:3000`
- `PLAYWRIGHT_START_SERVER=1` — `playwright.config` içinde dev sunucusunu otomatik başlatır

## Çalıştırma

```bash
npm run test:e2e
```

UI modu (hata ayıklama):

```bash
npx playwright test --ui
```

## Ne korunur?

- Super admin girişi ve `/super-admin` görünürlüğü
- Admin: ana panel, `/finans`, `/ozel-ders-paketleri`, `/oyuncular`, `/koclar` (listede koç varsa ilk satıra tıklayıp detay URL’si)
- Koç: ana sayfada günlük operasyon başlığı
- Sporcu: `/sporcu` ve kişisel analiz başlığı

Eksik env ile ilgili senaryolar **skipped** olur; CI’da kullanıcı yoksa tüm testler atlanabilir — bilinçli olarak yeşil sayılmaz, “skipped” rapora bakın.
