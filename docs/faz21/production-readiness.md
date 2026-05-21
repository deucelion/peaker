# FAZ 21 — Production Readiness Checklist

## Migration sırası (Supabase SQL Editor veya `supabase db push`)

1. `20260410_audit_logs.sql` — audit ekranı için zorunlu
2. `20260519_faz18_package_lifecycle_events.sql` — lifecycle, events
3. `20260520_faz19_manual_finance_operations.sql` — voided_at, finans notları, void RPC
4. `20260520_faz20_realtime_publication.sql` — realtime publication (tablo yoksa atlar)
5. `20260521_faz20_realtime_package_events_publish.sql` — package_events publication

Migration sonrası:

```sql
notify pgrst, 'reload schema';
```

## Gerekli ENV (Vercel + `.env.local`)

| Değişken | Zorunlu | Not |
|----------|---------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Evet | Proje URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Evet | Client |
| `SUPABASE_SERVICE_ROLE_KEY` | Evet | Server actions / worker |
| Sentry DSN (varsa) | Önerilir | `global-error` capture |

Eksik `SUPABASE_SERVICE_ROLE_KEY` → admin sorguları çöker.

## Cron / worker

- `20260511_retention_pg_cron.sql` — pg_cron (notifications + audit retention)
- `20260514_worker_cron.sql` — worker tick
- Vercel cron → `/api/cron/worker` (projede tanımlı route’a göre)

## Realtime

- Publication: `supabase_realtime` + org-scoped RLS
- Client: `useFinanceRealtimeSync`, `useUnreadNotificationsLive`, `useLiveAttendanceDashboard`
- Hidden tab: yavaş polling / debounce (4s)

## Rate limiter

- Export stream: `checkExportRateLimit` (audit, payments, receivables)
- Operational replay: `replayCooldown.ts`

## Deployment sırası

1. Supabase migration’lar (yukarıdaki sıra)
2. `notify pgrst, 'reload schema'`
3. Vercel deploy (env doğrula)
4. Worker cron aktif mi kontrol
5. Smoke checklist (`smoke-test-report.md`)

## Rollback sırası (ters)

1. `20260521_*_rollback` (varsa) veya publication’dan tablo çıkar
2. `20260520_faz20_realtime_publication_rollback` (varsa)
3. FAZ 19 rollback dosyası **dikkatli** — veri kaybı riski
4. FAZ 18 rollback — lifecycle kolonları

Production’da rollback yerine **forward-fix migration** tercih edin.

## Smoke checklist (deploy sonrası)

- [ ] Giriş / admin rol
- [ ] Paket listesi (şema uyarısı yok)
- [ ] Muhasebe tahsilat listesi
- [ ] Audit son 30 gün açılıyor
- [ ] Bildirim badge güncelleniyor
- [ ] Sistem operasyonları → şema sağlığı yeşil
- [ ] Export CSV (audit, 7 günlük aralık)
- [ ] `npm run lint` / `npm test` / `npm run build` CI yeşil

## Backup

- Supabase günlük backup (plan’a göre)
- Kritik tablolar: `profiles`, `payments`, `private_lesson_packages`, `audit_logs`

## Supabase config

- RLS açık tenant tablolarında
- Service role yalnızca server/worker
- API schema reload migration sonrası

## Vercel config

- Node runtime server actions
- Cron secret (`CRON_SECRET` vb. projede tanımlıysa)
- `NODE_ENV=production` → `__PEAKER_DEBUG__` kapalı
