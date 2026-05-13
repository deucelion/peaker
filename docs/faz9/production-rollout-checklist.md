# Faz 9.9 — Production Rollout Checklist

Bu checklist Faz 1–9 toplamının production'a güvenli rollout'u için kontrol noktalarıdır.

## 1) Environment Audit

- [ ] `NEXT_PUBLIC_SUPABASE_URL` — production proje
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key (RLS aktif)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — server-only, Vercel/host env'de
- [ ] `SENTRY_DSN` — error tracking aktif mi?
- [ ] `NODE_ENV=production` — debug helper'lar suppress edildi mi?
- [ ] Image domains: avatar_url storage bucket'ı Next.js image config'inde
- [ ] Time zone: `Europe/Istanbul` default; org-level override desteği aktif

## 2) Database Index Audit

Kritik query'ler için index'ler:

| Table | Index | Amaç |
|-------|-------|------|
| `training_loads` | `(profile_id, measurement_date)` | performans listesi |
| `wellness_reports` | `(profile_id, report_date desc)` | sporcu wellness arşivi |
| `payments` | `(organization_id, due_date)` partial `where deleted_at is null` | dashboard ödeme listesi |
| `payments` | `(organization_id, payment_date)` | accounting ay özetleri |
| `notifications` | `(user_id, created_at desc)` partial `where read = false` | bildirim listesi |
| `notifications` | `(read, created_at)` partial `where read = true` | retention RPC (Faz 6) |
| `audit_logs` | `(organization_id, created_at desc)` | audit-log listesi |
| `athletic_results` | `(profile_id, test_date)` | sporcu field test geçmişi |
| `private_lesson_packages` | `(organization_id, athlete_id)` | finance dashboard |

**Aksiyon:** Production DB'de `\\d+ <table>` ile mevcut index'leri kontrol et; eksik olanlar için ayrı bir indexes migration aç.

## 3) Backup Strategy

- [ ] Supabase PITR (Point-in-Time Recovery) açık (Pro plan)
- [ ] Günlük automated backup retention en az 7 gün
- [ ] Manuel snapshot rollout öncesi alındı mı?

## 4) Cron Strategy

- [ ] `20260511_retention_pg_cron.sql` migration uygulandı
- [ ] `cron.job` tablosunda 2 satır var:
  ```sql
  select jobname, schedule, active from cron.job where jobname like 'peaker_retention_%';
  ```
- [ ] İlk gerçek çalışma sonrası `cron.job_run_details` kontrol edildi
- [ ] Rollback dosyası (`20260511_retention_pg_cron_rollback.sql`) hazır

## 5) Observability

- [ ] Sentry connected (server-side actions için warn/error)
- [ ] `logger` PII sanitize çalışıyor (test: `logger.warn` payload Sentry'de görünmemeli)
- [ ] `measureAction` / `measureQuery` slow eşiği uygun (`1500ms` / `800ms`)
- [ ] `runJob` çıktıları görünür (export.performance, retention.*)

## 6) Retention Policy

- [ ] Notifications retention: **90 gün** (cron'da) — `cleanup_read_notifications(90)`
- [ ] Audit logs retention: **365 gün** — `cleanup_audit_logs(365)`
- [ ] Wellness reports: retention yok (athlete consent'i gereksin)
- [ ] Payments: soft-delete (`deleted_at`) — retention yok

## 7) Export Caps

- [ ] Audit export cap: 5000 satır
- [ ] Accounting payments export cap: 10000 satır
- [ ] Performance summary export cap: 200 sporcu
- [ ] Field tests export cap: 10000 satır
- [ ] Tümünde `truncated` flag + telemetry log

## 8) Rate Limiting

- [ ] Server actions için global rate limit (örn. Vercel edge config)
- [ ] Export endpoint'leri için per-user rate limit (en fazla dakikada 3)
- [ ] CSRF guard `withServerActionGuard` üzerinden aktif

## 9) Smoke Tests

### Admin smoke
- [ ] Dashboard yüklendi, KPI'lar dolu
- [ ] Muhasebe-finans payments listesi geliyor
- [ ] CSV export indirildi (audit, payments, performance, fieldTests)
- [ ] Audit-log filter + pagination çalışıyor
- [ ] Bildirimler load-more çalışıyor

### Coach smoke
- [ ] Sadece kendi yetkisi olduğu sporcuları görüyor
- [ ] `can_view_reports` false ise wellness arşivi engellenmiş
- [ ] Performans sayfasında tüm sporcular yetkisi yoksa banner

### Athlete smoke
- [ ] Kendi finansal durumu (`can_view_financial_status` aktifse)
- [ ] Sabah raporu submit ediliyor
- [ ] Bildirimler okundu işaretleniyor

### Super-admin smoke
- [ ] Organization picker dropdown'ı çalışıyor
- [ ] Cross-org veri sızıntısı yok (organization_id filter zorunlu)

## 10) Tenant Isolation Smoke

- [ ] Aynı tarayıcıda iki sekmede iki farklı admin (farklı org) açıldığında veriler karışmıyor
- [ ] Audit-log'da `organization_id` her satırda var
- [ ] Wellness arşivi `profiles!inner.organization_id` filter'ı doğru

## 11) Performance Smoke (Large Org Simulation)

- [ ] 500 sporcu + 50k load: performans page tek sporcu görünümü <2s
- [ ] 1000 sporcu + 100k load: takım görünümü chunked query log'ları görülüyor
- [ ] Export 200 sporcu <5s
- [ ] Wellness archive page 1 <1s, load-more <500ms

## 12) Faz 9 Yeni Bileşenler Final Doğrulama

- [ ] `src/lib/db/chunkedIn.ts` testleri pass (9 test)
- [ ] `src/lib/jobs/` runJob çalışıyor (manuel export ile)
- [ ] `src/components/ui/charts/ChartFrame` performans + sporcu sayfalarında render ediyor
- [ ] `LoadMoreButton` wellness + athlete-finance sayfalarında çalışıyor
- [ ] `usePerformanceDashboard` performans/page.tsx davranış parity korudu
- [ ] `useAccountingFinanceDashboard` foundation Faz 10 adoption için hazır
- [ ] `useAthletePanel` foundation Faz 10 adoption için hazır

## 13) Rollback Hazırlığı

- [ ] Vercel/host: önceki deployment 1-tıkla rollback edilebilir
- [ ] DB migration: pg_cron rollback dosyası hazır
- [ ] Wellness pagination: server action `WellnessArchiveFilter` opsiyonel olduğundan backward-compatible (rollback gerekmez)
- [ ] CSV export hardening: cap eski default'tan yüksek; rollback gereksiz

## 14) Post-Deploy 24h Watch List

- [ ] Sentry error rate < baseline +%5
- [ ] Slow action log'ları (>1500ms) günlük < 10 adet
- [ ] Export `truncated=true` oranı < %5 (cap'ler uygun mu?)
- [ ] Retention RPC log'ları (her sabah 03:15/03:30 UTC) görüldü mü?
- [ ] User-facing CSV indirme hatası raporu sıfır
