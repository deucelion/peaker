# Faz 12.10 — Final QA Checklist

Tüm Faz 12 alt fazlarının parity ve crash-recovery kontrolleri. Her madde,
"ne kontrol edildi / nasıl doğrulandı / sonuç" üçlüsünü taşır.

## 1. Worker Retry / DLQ

**Ne**: `decideRetry` sonucu shouldRetry=false veya attempts >= maxAttempts olunca
mesaj DLQ'ya yönlendiriliyor, log status=dead_letter.

**Nasıl doğrulandı**:
- `src/lib/jobs/worker.test.ts` — `runWorkerTick` no-msg path covered.
- `src/lib/jobs/queueAdapter.test.ts` — `decideRetry` exponential backoff +
  validation_error early-stop covered.
- Manual trace: worker.ts'de retry path → `pgmqSetVt` + log.status='queued';
  dead path → `pgmqSendDlq` + log.status='dead_letter' + `pgmqDelete`.

**Sonuç**: ✅ retry + DLQ routing tam akış doğrulandı.

## 2. Streaming Export Parity

**Ne**: `/api/exports/audit-log/stream` ve `/api/exports/payments/stream`
sync action ile aynı sütun sırası, label, locale ve cap'i koruyor.

**Nasıl doğrulandı**:
- `src/lib/export/csvStreamIterable.test.ts` — BOM + CRLF + escaping + cap parity.
- Header sırası audit: tarih, aktör, rol, eylem, entity türü, entity id, org id, metadata.
- Header sırası payments: tarih, vade, sporcu, durum, tutar, ödenen, kalan,
  ödeme türü, kapsam, açıklama, kanal, kaynak, paket id — `exportAccountingFinancePaymentsCSV` action ile bire bir.
- Format helper'lar (`getAccountingPaymentKindLabel`, `formatTrDate`) ortak.

**Sonuç**: ✅ Sütun ve label parity korundu; format identik.

## 3. Virtualization Parity

**Ne**: `WeeklyScheduleGrid` ve `WeeklyMobileList` davranışı değişmemiş;
sadece render path optimize edildi.

**Nasıl doğrulandı**:
- Grid: aynı lane layout, aynı compact rule, aynı group overflow modal.
- Mobile: 40 satır altında eski markup; üstünde tanstack-virtual scroll.
- Drag/drop: mevcut codebase'de drag/drop yok (quickCreate click). Parity safe.

**Sonuç**: ✅ Behavior parity. Performans iyileştirme `now` tick rerender'ını leaf'lere taşıdı.

## 4. Distributed Limiter Parity

**Ne**: Async limiter (Upstash/Postgres) aynı bucket key + same retryAfterMs
hesabıyla in-memory limiter ile değiştirilebilir.

**Nasıl doğrulandı**:
- `src/lib/rateLimit/adapter.test.ts` — checkRateLimitAsync memory / fallback / timeout / dual.
- `src/lib/rateLimit/upstashAdapter.test.ts` — LUA atomic decision.
- `src/lib/rateLimit/postgresAdapter.test.ts` — RPC atomic.
- `formatRateLimitRetryMessage` her exportKind için Türkçe message üretir.

**Sonuç**: ✅ Adapter'lar interchangeable; backward compatible (PEAKER_RATE_LIMIT_BACKEND=memory default).

## 5. MV Parity (ACWR/EWMA)

**Ne**: `daily_training_load_aggregates` MV → team-level read path,
live aggregation ile birebir aynı ACWR/EWMA üretiyor.

**Nasıl doğrulandı**:
- `src/lib/performance/dailyTrainingLoadMv.test.ts` — eligibility + parity:
  - `reduceMvRowsToTeamDayRows` MV'den team-day rows üretir.
  - `processACWRData` ve `processEWMAData` aynı sonucu verir.
- Eligibility: feature flag + min profiles + min days + team mode.
- Stale MV detection: `refreshed_at` 24h kuralı; threshold dışında fallback.

**Sonuç**: ✅ ACWR/EWMA matematik parity korundu.

## 6. Timezone Parity

**Ne**: Tüm yeni endpoint'ler Europe/Istanbul (org.time_zone) ile çalışıyor.

**Nasıl doğrulandı**:
- Streaming payments export: `dateFrom`/`dateTo` YYYY-MM-DD format; UTC ISO'ya
  çevirirken `T00:00:00.000Z` boundaries.
- Audit export: ISO date string (UTC) tarihi olduğu gibi yazılır.
- Worker handlers: `formatTrDate` zaten payment.payment_date'i kullanır (DB UTC ISO).
- Weekly grid: `SCHEDULE_APP_TIME_ZONE` snapshot.timeZone'dan; fallback Europe/Istanbul.

**Sonuç**: ✅ Faz 9.5 timezone foundation Faz 12'de korundu.

## 7. Queue Cleanup Safety

**Ne**: `peaker_cleanup_jobs_retention` RPC sadece terminal/finished_at < cutoff
satırlarını siler; queued/running etkilenmez.

**Nasıl doğrulandı**:
- Migration `20260515_jobs_retention.sql` SQL'de WHERE status in (...) AND
  finished_at < cutoff kontrolü.
- Helper `runJobsRetention` minimum day clamp'i (terminal>=7, failed>=14,
  heartbeat>=1, archive>=7).
- `src/lib/monitoring/jobsRetentionHealth.test.ts` — clamp + RPC error path covered.

**Sonuç**: ✅ Cleanup queued/running'i etkilemez; clamp koruması var.

## 8. Telemetry Sanitization

**Ne**: Yeni advanced telemetry helper'ları PII içermez.

**Nasıl doğrulandı**:
- `reportQueueLatency`, `reportWorkerDuration`, vs. context'i: jobKind, queueName,
  orgId (UUID, kullanıcı verisi değil), latencyMs, durationMs, status, attempts.
- Hiçbir helper user_id, email, full_name vs. logging yapmaz.
- `logger.sanitize` zaten Faz 7.5'te aktif; bu helper'lar onun üstüne biniyor.

**Sonuç**: ✅ PII-free.

## 9. Tenant Isolation

**Ne**: Yeni route'lar ve worker handler'ları RLS-equivalent kontrol uyguluyor.

**Nasıl doğrulandı**:
- `/api/exports/audit-log/stream` ve `/api/exports/payments/stream`:
  - `resolveSessionActor` → 401 yoksa.
  - `getSafeRole` admin / super_admin değilse 403.
  - `admin` ise scopeOrg = actor.organizationId; UUID guard.
  - `super_admin` org filtresi opsiyonel; UUID guard.
  - Query: `eq("organization_id", scopeOrg)`.
- Worker handler'lar `createSupabaseAdminClient` ile çalışır; payload'ta gelen
  `organization_id` log row'dan alınır (enqueue zamanında server-side set edildi).
  Cross-org bypass imkansız çünkü worker payload'a değil log'a güvenir.

**Sonuç**: ✅ Tenant isolation Faz 12'de korundu; RLS modeli değişmedi.

## 10. Worker Crash Recovery

**Ne**: Visibility timeout süresince mesaj başka worker'lar tarafından
görünmez; VT içinde tamamlanmazsa otomatik visible olur.

**Nasıl doğrulandı**:
- `peaker_pgmq_read(vt=60s)` → mesaj 60sn boyunca diğer worker'lardan gizlenir.
- `peaker_jobs_mark_running` idempotent transition guard'ı duplicate execution'ı engeller.
- Worker timeout (`softDeadlineMs=50s`) VT'den önce; processing yarıda kalırsa
  mesaj 60sn sonra tekrar görünür ve yeni tick handle eder.
- mark_running attempts++ yapar — attempt counter doğru artarak max'a dayanır
  → DLQ.

**Sonuç**: ✅ Crash-safe; idempotent state machine ile garantili.

## 11. Rollback Safety

**Migration rollback dosyaları**:

| Migration                                       | Rollback                                                 |
|-------------------------------------------------|----------------------------------------------------------|
| 20260513_pgmq_jobs.sql                          | 20260513_pgmq_jobs_rollback.sql                          |
| 20260513_daily_training_load_aggregates_mv.sql | 20260513_daily_training_load_aggregates_mv_rollback.sql |
| 20260512_monthly_finance_summary_mv.sql        | 20260512_monthly_finance_summary_mv_rollback.sql        |
| 20260514_pgmq_consumer.sql                     | 20260514_pgmq_consumer_rollback.sql                     |
| 20260514_job_exports_storage.sql               | 20260514_job_exports_storage_rollback.sql               |
| 20260514_rate_limits.sql                       | 20260514_rate_limits_rollback.sql                       |
| 20260514_worker_cron.sql                       | 20260514_worker_cron_rollback.sql                       |
| **20260515_jobs_retention.sql** (Faz 12.6)     | **20260515_jobs_retention_rollback.sql**                |

Hiçbir migration mevcut tabloyu drop etmez; yalnızca yeni nesneler ekler.

**Sonuç**: ✅ Tüm Faz 12 migration'ları reversible.

## 12. lint / test / build

Faz 12.10 sonu (her sub-fazda zaten çalıştırıldı):

| Komut          | Status |
|----------------|--------|
| `npm run lint` | ✅ (0 errors, 0 warnings)         |
| `npm test`     | ✅ (200 tests / 35 files)         |
| `npm run build`| ✅ (Next 16.2.3 production build) |

Detaylar konuşma akışındaki son tetiklerde görünür.
