# Peaker

Next.js (App Router) + Supabase ile spor organizasyonu yönetim paneli.

## Hızlı başlangıç

```bash
cp .env.example .env.local   # değerleri doldurun
npm install
npm run dev
```

## Ortam değişkenleri

| Değişken | Zorunlu | Açıklama |
|----------|---------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Evet | Supabase proje URL’si |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Evet | Anon (public) API anahtarı |
| `SUPABASE_SERVICE_ROLE_KEY` | Evet (build + production runtime) | Service role; yalnızca sunucu (server actions, admin client). İstemciye veya `NEXT_PUBLIC_*` altına koymayın. |

Şablon: [`.env.example`](./.env.example).

**Guard’lar**

| Aşama | Davranış |
|-------|----------|
| `npm run build` | `src/lib/env/productionBuildEnv.ts` — üç zorunlu anahtar yoksa derleme hata verir. |
| Production süreç başlangıcı | `src/lib/env/productionEnvGate.ts` (`instrumentation.ts`) — public + service role eksikse süreç başlamaz. |

Yerel geliştirme: `.env.local` (repoya commit etmeyin).

## Supabase kurulumu

1. [Supabase](https://supabase.com) üzerinde proje oluşturun.
2. URL ve anahtarları proje ayarlarından alın.
3. SQL migrasyonlarını **tarih sırasıyla** uygulayın: `supabase/migrations/` (`YYYYMMDD_` önekine göre).

```bash
npx supabase link   # bir kez
npx supabase db push
```

Alternatif: SQL Editor’da dosyaları sırayla çalıştırın.

**Ödeme (`payments`):** Tek sahip kolonu `profile_id` → `public.profiles.id`; raporlama alanları `month_name`, `year_int`. Ayrıntılı şema ve backfill: `supabase/migrations/20260412_payments_profile_id_canonical.sql`.

## Geliştirme ve kalite

```bash
npm run dev
npm test
npm run lint
npm run build
```

CI eşdeğeri: `npm run ci` (test + lint + build).

### E2E smoke (Playwright)

Kritik giriş, rol yönlendirme ve ana modül rotaları için tarayıcı smoke testleri. Ayrıntı: [`e2e/README.md`](./e2e/README.md). Ortam şablonu: [`.env.e2e.example`](./.env.e2e.example) (kopyalayıp `.env.e2e` olarak doldurun; repoya commit etmeyin).

```bash
npx playwright install chromium   # ilk kurulumda
npm run test:e2e
```

Eksik `E2E_*` çiftlerinde ilgili senaryolar atlanır (`skipped`); tam güvenlik ağı için dört rol için de test kullanıcıları tanımlayın.

## Dağıtım ve operasyon

- **Runbook / smoke checklist:** [docs/production-runbook.md](./docs/production-runbook.md)
- Hosting’e (ör. Vercel) aynı env değişkenlerini Production ortamına ekleyin.
- `npm run build` ile üretim derlemesinin geçtiğını doğrulayın.
- Supabase **production** veritabanında RLS ve migrasyonların staging ile uyumlu olduğundan emin olun.

### Güvenlik başlıkları

`next.config.ts` içinde: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `X-DNS-Prefetch-Control`, `Permissions-Policy`.  
Sıkı **Content-Security-Policy** eklemeden önce tüm script/kaynaklar test edilmelidir (şu an eklenmedi).

### Rate limiting

Uygulama kodunda merkezi API rate limit yok. Üretimde brute-force / kötüye kullanım için barındırıcı firewall (ör. Vercel), Supabase Auth limitleri veya edge tabanlı limit (ör. Upstash + Middleware) ayrı planlanmalı — ayrıntılar [runbook — Rate limiting](docs/production-runbook.md#rate-limiting-katmanlar).

### Gözlemlenebilirlik (Sentry — isteğe bağlı)

Hata izleme için **Sentry** (`@sentry/nextjs`) entegre edildi; DSN yoksa SDK yüklenmez, mevcut akışlar değişmez.

| Değişken | Açıklama |
|----------|----------|
| `NEXT_PUBLIC_SENTRY_DSN` | Proje DSN (istemci + sunucu; açık değil ama tarayıcıda görünür). |
| `NEXT_PUBLIC_SENTRY_ENABLED` | `0` / `false` ile DSN olsa bile kapalı. |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | İsteğe bağlı ortam etiketi (`production`, `preview` vb.). |
| `NEXT_PUBLIC_SENTRY_DEV` | `1` ile **development** ortamında da olay gönderimi (varsayılan: yalnızca production/preview). |
| `SENTRY_AUTH_TOKEN` | İsteğe bağlı; build sırasında kaynak haritası yüklemek için (CI gizli değişkeni). |
| `SENTRY_ORG` / `SENTRY_PROJECT` | Kaynak haritası yüklemesi için (token ile birlikte). |

Sunucu tarafında `instrumentation` içinde `onRequestError` ile App Router / middleware kaynaklı istek hataları; `global-error` ve `error.tsx` bileşenlerinde istemci render hataları raporlanır. `captureServerActionError` ve `withServerActionGuard` (`src/lib/observability/serverActionError.ts`) ile beklenmeyen throw’lar konsola + Sentry’e düşer (`server_action` etiketi). Kritik mutasyonlar (super admin, finans, koç yaşam döngüsü, özel ders paketleri, izinler, org adı) guard ile sarıldı.

Production’da env gate tamamlandığında sunucu loglarında `[Peaker] instrumentation: production env gate completed` satırı görülebilir.

## Mimari notlar

- **Aktör çözümü:** `src/lib/auth/resolveSessionActor.ts`
- **Rol / org (istemci):** `GET /api/me-role` ve `fetchMeRoleClient()`; proxy oturum kontrolü.
- **Tarayıcı Supabase:** `src/lib/supabase.ts` — tablo erişimi sunucu tarafında; istemcide ağırlıklı olarak auth ve gerektiğinde Realtime.
