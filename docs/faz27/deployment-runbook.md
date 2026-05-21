# Deployment Runbook

## Ön koşul

- Supabase migration’lar staging’de uygulandı
- `notify pgrst, 'reload schema';`
- ENV Vercel’de güncel (bkz. `.env.example`)

## Sıra

1. **DB** — SQL migration’ları (faz21 sırası)
2. **Doğrulama** — Sistem operasyonları → şema sağlığı yeşil
3. **Build** — CI: lint, test, build
4. **Deploy** — Vercel production
5. **Worker** — `peaker_worker_tick` / pg_cron veya Vercel cron (tek kaynak)
6. **Smoke** — `production-smoke.md` checklist

## Rollout checklist

- [ ] Feature flag değişikliği yok veya dokümante
- [ ] Breaking API yok
- [ ] Realtime publication tabloları mevcut
- [ ] Sentry DSN production’da (önerilir)

## Post-deploy (15 dk)

- [ ] Login admin + coach
- [ ] Bir tahsilat listesi açılır
- [ ] Bildirim badge güncellenir
- [ ] Ops panel skor > 50
