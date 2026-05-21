# Rollback Runbook

## Uygulama rollback (Vercel)

1. Vercel → Deployments → önceki stabil deployment → Promote
2. ENV değişmediyse ek işlem gerekmez

## Migration rollback

**Tercih:** Forward-fix migration (veri kaybı riski düşük).

Ters sıra (dikkatli):

1. `20260521_faz20_realtime_package_events_publish` — publication geri al
2. FAZ 19 rollback — **finans verisi riski** — yalnızca acil
3. FAZ 18 rollback — lifecycle kolonları

## Kritik tablolar (backup öncelik)

- `private_lesson_packages`, `payments`, `audit_logs`, `notifications`, `training_loads`

## Restore

- Supabase point-in-time recovery (plan’a bağlı)
- Export CSV snapshot (audit/payments API) operasyonel yedek
