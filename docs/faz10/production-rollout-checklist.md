# Faz 10.9 — Production Rollout Checklist

Faz 1–10 toplamının production deployment'i için **rollout order** ve **rollback order**.

## 1) Rollout Order

Sırayla:

### 1.1 Pre-flight
- [ ] Database backup snapshot (PITR + manuel)
- [ ] Vercel preview deployment QA'dan geçti
- [ ] Smoke test (`npm test`) yeşil
- [ ] Lint + build yeşil
- [ ] Sentry DSN production env'de var

### 1.2 Database migrations (sırayla uygula)
Migration zincirinin önceki migration'ları zaten production'da; yeni eklenenler:

1. `20260511_retention_pg_cron.sql` — pg_cron retention job'ları
2. `20260512_monthly_finance_summary_mv.sql` — MV + cron + RPC

**Doğrulama (her migration sonrası):**
```sql
-- pg_cron job kontrol
select jobname, schedule, active from cron.job where jobname like 'peaker_%';

-- MV kontrol
select count(*) from public.monthly_finance_summary;

-- View kontrol
select * from public.peaker_retention_cron_health limit 5;
```

### 1.3 Application Deployment
1. `main` branch'a merge
2. Vercel auto-deploy bekleniyor
3. `/sistem-operasyonlari` panelinden cron + MV durumu doğrula
4. `/sistem-saglik` panelinden DB schema doğrula

### 1.4 Cron Activation Order
- Migration uygulandığında cron schedule otomatik aktif olur
- İlk run beklemek için:
  - `peaker_retention_notifications`: ertesi gün 03:15 UTC
  - `peaker_retention_audit_logs`: ertesi gün 03:30 UTC
  - `peaker_mv_monthly_finance_summary`: ertesi gün 04:00 UTC
- Manuel ilk run (opsiyonel):
  ```sql
  select public.cleanup_read_notifications(90);
  select public.cleanup_audit_logs(365);
  select * from public.refresh_monthly_finance_summary();
  ```

### 1.5 Queue Rollout Order
Faz 10'da gerçek queue henüz yok. `inMemoryAdapter` aktif (no-op enqueue).
Faz 11'de pgmq aktive edilirken:
1. pgmq extension migration uygula
2. Queue tables oluştur
3. `registerQueueAdapter(pgmqAdapter)` aktive et (Vercel env'de feature flag ile)
4. Cron consumer ekle (`pgmq.read` her dakika)

### 1.6 MV Refresh Verification
- [ ] İlk `pg_cron` run sonrası `monthly_finance_summary.refreshed_at` güncel
- [ ] `/sistem-operasyonlari` panelinde yeşil status

## 2) Rollback Order

Sorun çıkarsa **ters sırayla**:

### 2.1 Application Rollback
1. Vercel: "Promote previous deployment" — eski commit'i aktif et
2. Sentry'de hata düşüşünü doğrula

### 2.2 Cron Disable (acil)
```sql
-- Cron job'ları geçici olarak devre dışı bırak
update cron.job set active = false where jobname like 'peaker_%';
```

### 2.3 Migration Rollback
Eğer migration'ın kendisi hatalı:

1. `20260512_monthly_finance_summary_mv_rollback.sql` — MV silinir
2. `20260511_retention_pg_cron_rollback.sql` — Retention cron silinir

**Önemli:** RPC fonksiyonları (`cleanup_read_notifications`, `cleanup_audit_logs`) Faz 6 migration'ında tanımlı; bu rollback'lerde drop edilmez.

## 3) Export Cap Strategy

| Export | Cap | Davranış | Telemetry |
|--------|-----|----------|-----------|
| Audit log | 5000 | `truncated=true` flag + log | ✅ |
| Performance summary | 200 | runJob + telemetry | ✅ |
| Accounting payments | 10000 | `truncated=true` flag + log | ✅ |
| Field tests | 10000 | `truncated=true` flag + log | ✅ |

Cap aşılırsa UI banner: "İlk N kayıt indirildi". Devam isteyen kullanıcı için filtre/tarih daraltma önerisi.

## 4) Telemetry Watch List (Post-Deploy 24h)

| Metrik | Eşik | Aksiyon |
|--------|------|---------|
| Sentry error rate | baseline +%5 | Rollback |
| Slow action (>1500ms) | >10/saat | Investigate |
| Slow query (>800ms) | >20/saat | DB index audit |
| Export `truncated=true` oranı | >%5 | Cap'leri yeniden değerlendir |
| `chunkedInQuery` warning count | >50/gün | Telemetry log review |
| Retention RPC failure | herhangi biri | `/sistem-operasyonlari` paneli |
| Cron skip (peaker_retention_*) | herhangi biri | pg_cron health view |

## 5) Retention Verification

- [ ] Sabah 06:30 TR (03:30 UTC) sonrası `/sistem-operasyonlari` panelinde:
  - `peaker_retention_notifications` last run = succeeded
  - `peaker_retention_audit_logs` last run = succeeded
- [ ] `notifications` ve `audit_logs` tablo satır sayıları beklenen aralıkta
- [ ] `peaker_retention_cron_health` view'da son 7 günün run'ları görünür

## 6) Tenant Isolation Smoke

- [ ] İki farklı org admin (tarayıcıda iki sekme) → veri karışmıyor
- [ ] Audit-log satırlarında organization_id mevcut
- [ ] MV `monthly_finance_summary` organization_id ile filter'lanıyor
- [ ] Coach (org A) ile coach (org B) cross-data sızıntısı yok (Faz 1 baseline'ı)

## 7) Admin Smoke

- [ ] Dashboard KPI dolu (1+ snapshot)
- [ ] `/muhasebe-finans` filter apply çalışıyor (Faz 10.1b hook adoption)
- [ ] `/performans` sporcu seçimi + range apply (Faz 10.1a hook)
- [ ] `/sporcu/[id]` detay yükleniyor (Faz 10.1c hook)
- [ ] `/audit-log` filter + pagination (Faz 9.7 DataTablePagination)
- [ ] `/bildirimler` LoadMoreButton (Faz 10.5)
- [ ] `/performans/wellness-detay` date filter (Faz 9.5)
- [ ] `/finans/[athleteId]` LoadMoreButton timeline (Faz 9.5)
- [ ] `/sistem-operasyonlari` yeşil görünüyor (Faz 10.6)

## 8) Coach Smoke

- [ ] `can_view_all_athletes=false` ise sporcu listesi sınırlı
- [ ] `can_view_reports=false` ise CSV export buton görünmez
- [ ] Performans takım görünümü permission'a göre filter'lı
- [ ] Wellness arşivi yetki bayrağına göre kontrollü

## 9) Athlete Smoke

- [ ] Sabah raporu submit (`/sporcu/sabah-raporu`)
- [ ] Kendi finansal durumu (`can_view_financial_status` aktifse)
- [ ] Performans / programlar görünür (athlete_permissions ile)
- [ ] Bildirimler okundu işaretlenir

## 10) Faz 10 Yeni Bileşen Final Doğrulama

- [ ] `src/lib/db/chunkedIn.ts` — 9 test pass
- [ ] `src/lib/errors/` — 11 test pass
- [ ] `src/lib/jobs/queueAdapter` — 9 test pass
- [ ] `src/components/ui/charts/ChartFrame` — Faz 9 + 10 sayfalarında render
- [ ] `useAccountingFinanceDashboard` — muhasebe-finans
- [ ] `useAthletePanel` — sporcu/[id]
- [ ] `usePerformanceDashboard` — performans (range + selected + load lifecycle)
- [ ] `LoadMoreButton` — bildirimler / wellness / finance/[athleteId]
- [ ] `DataTablePagination` — audit-log

## 11) Backup Strategy

- [x] Supabase PITR aktif (Pro plan)
- [x] Günlük automated backup retention en az 7 gün
- [ ] Rollout öncesi manuel snapshot alındı
- [ ] Snapshot ID'si runbook'a not düşüldü

## 12) Rate Limiting (Faz 11 hazırlığı)

Şu anda explicit rate limit yok. Riskler:
- CSV export endpoint'leri tek user tarafından peş peşe çağrılırsa memory baskısı
- Bildirim mark-all per user — düşük risk

Faz 11'de Vercel edge config rate limit önerilir (örn. user başına dakikada 3 export).

## 13) Post-Deploy 24h Action Plan

1. **Hour 1**: Sentry monitor, ilk admin login + smoke
2. **Hour 4**: Cron çalışana kadar boşluk; manuel cron run testi opsiyonel
3. **Hour 12**: İlk retention cron sonrası `/sistem-operasyonlari` doğrula
4. **Hour 24**: Tüm cron'lar + MV refresh sonrası health raporu yaz

## 14) Communication

- Stakeholders bilgilendirilmeli:
  - Deployment penceresi (örn. Pazar 23:00 - 02:00)
  - Rollback prosedürü
  - Eskalasyon noktası (geliştirici on-call)
- Kullanıcılara duyuru gerekli mi? — UI değişikliği minimum; opsiyonel.
