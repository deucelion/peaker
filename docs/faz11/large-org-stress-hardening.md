# Faz 11.9 — Large-Org Stress Hardening Raporu

## Simülasyon Profili

| Boyut | Değer |
|-------|-------|
| Sporcu sayısı | 1000 |
| Aktif koç | 50 |
| Training load (yıllık) | 250.000 satır (1000 × 250 gün) |
| Payments | 50.000 satır (5 yıl × 10.000) |
| Notifications | 100.000 satır |
| Audit log | 10 yıl × 5.000 satır = 50.000 satır |
| Wellness reports | 80.000 satır |
| Field tests | 30.000 satır |

## 1) Query Performansı

| Endpoint | Önceki risk | Faz 11 etkisi | Kalan risk |
|----------|-------------|---------------|------------|
| `listPerformanceAnalyticsData` | 1000 profileId × 90 gün IN sorgusu | Chunked .in() (Faz 9) korunuyor; Faz 12'de `daily_training_load_aggregates` MV read path | Orta (MV read path Faz 12) |
| `loadAccountingFinanceDashboard` (month) | Sum + count tüm payments | Faz 11.2 — MV read path KPI için aktif | **Düşük** |
| `loadAccountingFinanceDashboard` (custom range) | Custom range MV yok | Live aggregation; cap yok | **Orta** — query timeout riski 50k+ payments'ta |
| `auditLogActions.listAuditLogs` | Cursor-based pagination | Stable | Düşük |
| `notifications` | `created_at` desc + limit | Stable | Düşük |

**Aksiyon önerisi**: Custom date range için partial index düşünülmeli:
```sql
create index if not exists payments_org_paid_at_idx
  on public.payments (organization_id, paid_at desc)
  where status = 'odendi';
```

## 2) Render Performansı

| Sayfa | Önceki rerender hotspot | Faz 11 etkisi | Kalan risk |
|-------|-------------------------|---------------|------------|
| `haftalik-ders-programi` | `now` tick her 30sn + child rerender | Faz 11.5 — `now` 60sn + `WeeklyScheduleGrid` / `WeeklyMobileList` memoized + stable callbacks | **Düşük** |
| `sporcu/[id]` AthletePerformanceInsightsPanel | Recharts rerender | ChartFrame (Faz 10.4) | Düşük |
| `muhasebe-finans` payments table | 10k satır = 30k+ DOM node | Faz 11.6 — Client-side pagination 50/sayfa | **Düşük** |
| `performans` ACWR/EWMA chart | 90 günlük × 1000 sporcu = 90k node | ChartFrame + filtered athlete view | Orta (1000 sporcu ortalaması) |

## 3) Export Performansı

| Export | Önceki cap | Faz 11 etkisi | Kalan risk |
|--------|------------|---------------|------------|
| Audit logs | 5000 satır in-memory | Chunked iteration (500/chunk) + rate limit | Düşük |
| Payments | 10000 satır in-memory | Rate limit | Orta (10k × 13 col ~ 1MB CSV) |
| Performance summary | 200 sporcu cap | runJob telemetry | Düşük |
| Wellness archive | Pagination | Stable | Düşük |
| Field tests | 10000 satır | Stable | Düşük |

**Aksiyon önerisi (Faz 12)**: Payments export'u response body streaming (`streamCsvToResponse`) ile, route handler altına taşınmalı.

## 4) MV Stale Riskleri

| MV | Refresh | Stale tolerance | Risk |
|----|---------|-----------------|------|
| `monthly_finance_summary` | 04:00 UTC günlük | 26 saat | Düşük; fallback live aggregation |
| `daily_training_load_aggregates` | 6 saatte bir | 6 saat | Read path Faz 12; bu turda sadece veri pre-load |

## 5) Pagination Kırılma Noktaları

- **Notifications** retention 90 gün → 100k → ~10k aktif. Cursor pagination + DataTable adoption (Faz 10.5). **OK**.
- **Payments** 50k → page size 50 → 1000 sayfa. Client-side pagination kullanışlı ama büyük orgda server-side pagination (Faz 12) gerekli.
- **Athlete timeline** 50 ilk yükleme + LoadMoreButton. **OK**.

## 6) Worker / Queue Darboğazları (Faz 11.1 sonrası)

| Worker | Beklenen yük | Risk |
|--------|---------------|------|
| Retention | 1/gün | Düşük |
| Export (audit, payments) | 6/dak/user, 20/dak/org rate limit | Düşük |
| Telemetry aggregation | Henüz worker yok | — |

DLQ stratejisi: 5 attempt sonrası `peaker_jobs_dlq` queue'ya gider; admin paneli `failed_count_24h` ile uyarı verebilir (Faz 12).

## Yeni LR Riskleri

| ID | Severity | Açıklama | Aksiyon |
|----|----------|----------|---------|
| **LR-7** | Orta | Custom range payments query 50k+ satırda yavaşlayabilir | Partial index önerisi yukarıda |
| **LR-8** | Düşük | `monthly_finance_summary` MV refresh DDL contention 04:00 UTC | `REFRESH MATERIALIZED VIEW CONCURRENTLY` zaten kullanılıyor; risk düşük |
| **LR-9** | Orta | 1000 sporcu × 90 gün performans takım görünümü tek istekte gelir (chunked .in ile) | Faz 12 — MV read path zorunlu |
| **LR-10** | Düşük | In-memory rate limiter Vercel multi-instance'ta replicate olmaz | Faz 12 — Redis/Upstash veya pgmq tabanlı distributed limit |
| **LR-11** | Düşük | `peaker_jobs_log` retention politikası yok; log büyür | Cron job + retention RPC eklenmeli (Faz 12) |

## Faz 12 Teknik Borçları

1. Streaming CSV response body (HTTP route handler)
2. `daily_training_load_aggregates` MV read path
3. Distributed rate limiter (Redis/Upstash)
4. `peaker_jobs_log` retention cron
5. pgmq consumer worker (real dequeue + processing)
6. Custom range payments index partial

## Enterprise Readiness Skoru

| Boyut | Skor | Yorum |
|-------|------|-------|
| Async-ready | 7/10 | pgmq schema + adapter hazır; gerçek worker Faz 12 |
| Large-org optimized | 8/10 | MV read path 1/2, chunked exports, memoized renders |
| High-volume stable | 7/10 | Rate limit + cap'ler aktif; streaming response Faz 12 |
| Enterprise operational | 8/10 | sistem-operasyonlari v2 + queue visibility |
