# Peaker — production runbook

Yeni özellik eklemeden dağıtım ve sorun giderme için kısa operasyon kılavuzu.

## Önkoşullar

- [ ] `README.md` içindeki ortam değişkenleri üretim ortamında tanımlı
- [ ] Supabase production projesinde migrasyonlar uygulandı (`supabase/migrations/` sırası)
- [ ] `npm run ci` (veya en azından `npm run build`) yeşil

## Dağıtım (ör. Vercel)

1. Repoyu bağlayın; **Build Command:** `npm run build`, **Output:** Next.js varsayılanı.
2. **Environment:** Production’a şu üç değişkeni ekleyin (değerler asla client bundle’a sızmaz; `NEXT_PUBLIC_*` hariç):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. İlk deploy sonrası **Preview** ile smoke test, ardından production’a alın.

## Build / runtime guard’ları

| Ne zaman | Ne yapar |
|----------|----------|
| `npm run build` (`npm_lifecycle_event=build`) | `assertPeakerBuildEnv` — üç zorunlu env yoksa derleme düşer |
| Production Node process start | `runProductionEnvGate` (`instrumentation.ts`) — public + service role eksikse process başlamaz |

Yerelde `.env.local` ile build alıyorsanız aynı anahtarların CI/CD’de de tanımlı olduğundan emin olun.

## Smoke test checklist (deploy sonrası)

Tarayıcıda veya API ile hızlı kontrol:

- [ ] `/login` açılıyor, giriş yapılabiliyor
- [ ] `GET /api/me-role` — oturum açıkken 200 ve `role` / `organizationId` tutarlı
- [ ] Dashboard ana sayfa yükleniyor (rolünüze uygun)
- [ ] `/finans` (admin) veya yetkili rolde finans listesi hatasız
- [ ] `/performans` (admin/coach) veri veya boş durum hatasız
- [ ] `/bildirimler` liste veya boş durum
- [ ] Çıkış sonrası korumalı sayfa `/login`’e düşüyor

Super admin / sporcu panelleri kullanıyorsanız ilgili rotaları da tek seferlik deneyin.

**Otomatik smoke (isteğe bağlı):** Staging’de gerçek test kullanıcıları ve gizli `E2E_*` değişkenleri tanımlıysa `npm run test:e2e` ile aynı akışların Playwright ile doğrulanması mümkündür (`e2e/README.md`). Production’da E2E koşmak genelde önerilmez; secrets ve trafik riski nedeniyle ayrı ortam veya nightly job tercih edilir.

## Geri alma (rollback)

- Hosting’de **önceki başarılı deployment**’a dönün (Vercel: Instant Rollback).
- Veritabanı için migrasyon geri alma ayrı planlanmalı; üretimde migration’ları önce staging’de doğrulayın.

## Güvenlik ve sınırlar

- **Rate limiting:** Aşağıdaki bölüme bakın; uygulama içinde merkezi limit şu an yok.
- **Merkezi hata izleme:** İsteğe bağlı **Sentry** — `NEXT_PUBLIC_SENTRY_DSN` ve `NEXT_PUBLIC_SENTRY_ENABLED` ile açılır; ayrıntı `README.md` (Gözlemlenebilirlik). Kaynak haritası için build’de `SENTRY_AUTH_TOKEN` (+ org/project). Ek olarak Vercel Log Drains / harici APM kullanılabilir.
- **CSP:** Sıkı `Content-Security-Policy` eklemeden önce tüm script/style kaynakları test edilmeli; şu an yalnızca güvenlik başlıkları `next.config.ts` içinde.

## Rate limiting (katmanlar)

**Durum:** Uygulama kodunda merkezi, paylaşımlı depolu (Redis vb.) rate limit yok; bilinçli olarak önce edge ve kimlik doğrulama katmanına güvenilir.

| Katman | Ne için | Not |
|--------|---------|-----|
| **Barındırıcı / edge** | Botlar, anormal trafik, coğrafi kısıt | Örn. Vercel Firewall, IP / ülke kuralları |
| **Supabase Auth** | Şifre ve oturum istekleri | Platform’un kendi throttle davranışı |
| **İleride: uygulama** | `/login`, şüpheli server action yoğunluğu | Önerilen yol: **Upstash Ratelimit** (veya eşdeğeri) + edge uyumlu Redis; anahtar olarak `ip` ve mümkünse `userId` birleşimi |

**Önerilmeyen:** Sunucusuz çoklu replika ortamında tek süreç bellek içi `Map` ile limit — tutarsız ve yanlış güven hissi verir.

**Observability:** Sentry’de `server_action` etiketi ile hata sıklığı izlenir; rate limit eklemeden önce baseline ve eşik kararı verilir.

## Sağlık kontrolü (yönetici)

- Uygulama içi: `/sistem-saglik` (super admin) — şema ve profil bütünlüğü kontrolleri.
