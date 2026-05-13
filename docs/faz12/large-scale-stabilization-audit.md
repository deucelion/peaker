# Faz 12.9 — Large-Scale Stabilization Audit (5000 sporcu / 1M load)

Bu rapor, Faz 12.1 – 12.8 kapsamındaki tüm değişikliklerden sonra sistemin
büyük-org / yüksek-trafik profilinde dayanıklılığını analiz eder ve yeni LR
risklerini (LR-12+) saptar.

## 1. Simülasyon Profili

| Boyut                              | Hedef değer              |
|------------------------------------|--------------------------|
| Organizasyon başına sporcu         | 5.000                    |
| Aktif koç                          | 200                      |
| Lokasyon                           | 30                       |
| `training_load` satırı             | 1.000.000 (5000 × 200 gün)|
| `payments`                         | 250.000 (yıllık ~50k × 5 yıl) |
| `notifications`                    | 500.000                  |
| `audit_logs`                       | 250.000                  |
| `wellness_reports`                 | 400.000                  |
| `field_tests`                      | 150.000                  |
| Eş zamanlı kullanıcı (peak)        | 80                       |
| Eş zamanlı admin (dashboard)       | 5                        |
| Eş zamanlı export tetik (peak/sa)  | 30                       |

## 2. Query Performansı

| Endpoint / Query                       | Risk Seviyesi | Faz 11 sonrası durum                      | Faz 12 etkisi |
|----------------------------------------|---------------|-------------------------------------------|---------------|
| `listPerformanceAnalyticsData` (team)  | Yüksek        | Live aggregation 5000 sporcu × 90 gün     | **Çözüm**: `daily_training_load_aggregates` MV read path (Faz 12.2). Live fallback hâlâ var. |
| `loadAccountingFinanceDashboard` month | Düşük         | `monthly_finance_summary` MV              | Stable        |
| `loadAccountingFinanceDashboard` custom| Orta          | Live aggregation cap'siz                  | **LR-12**: partial index önerisi hâlâ uygulanmadı |
| `listAuditLogs` cursor pagination      | Düşük         | Cursor + index                            | Stable        |
| `listNotifications`                    | Düşük         | `(user_id, created_at desc)` index        | Stable; mute preferences Faz 11 |
| `listLessonsSnapshot` weekly           | Orta          | 5000 sporcu × 30 koç haftalık = ~7k ders  | Grid memo + leaf decoupling (Faz 12.5) |
| `getSystemOperationsSnapshot`          | Düşük         | 100 job + 60 heartbeat tek query          | Stable        |
| `peaker_pgmq_read`                     | Düşük         | Batch 10 + VT                              | Stable; pgmq sub-ms |

**Eksik kalan optimizasyonlar (Faz 13'e devir)**:
- `payments_org_paid_at_idx` partial index (LR-7'den devam).
- Performans MV'yi cron ile saat başı refresh (şu an: günde 1 — `daily_training_load_aggregates`).
- `notifications_org_user_created_idx` composite (read pattern: org-wide queue stats).

## 3. Render Performansı

| Sayfa                                  | Önceki hotspot                        | Faz 12 etkisi |
|----------------------------------------|---------------------------------------|---------------|
| `haftalik-ders-programi`               | 7k card + `now` tick → grid rerender  | **Çözüm**: leaf decomposition (NowLine, Pulse, LessonCard memo) + mobile virtualization (Faz 12.5). 60s tick artık sadece `todayKey` türevini etkiler. |
| `sporcu/[id]` (5000 sporcudan biri)    | AthletePerformanceInsightsPanel       | ChartFrame + memo; Recharts re-mount tetikleyici yok |
| `muhasebe-finans` payments tablosu     | 50k satır → 1000 sayfa client-side    | LoadMore + ek server-side cursor Faz 13'te |
| `performans` ACWR/EWMA chart           | 90 gün × 5000 sporcu ortalaması       | MV team-day reduce (Faz 12.2). Chart node ≤ 90 |
| `sistem-operasyonlari`                 | Cron job list + worker heartbeat      | Yeni: 4 ek section (mvFreshness, workers, expSparkline, queue stats). Tüm sectionlar SSR-free, snapshot-driven |
| `bildirimler` infinite list            | 500k notifications retention 90 gün → ~50k aktif | DataTable + LoadMore (Faz 10.5) |

## 4. Worker / Queue Darboğazları

| Worker target            | Yük profili                             | Risk                                  |
|--------------------------|-----------------------------------------|---------------------------------------|
| `retention.notifications`| Günlük 1 tetik; ~50k delete            | Düşük (RPC chunked delete)             |
| `retention.auditLogs`    | Günlük 1 tetik; ~10k delete            | Düşük                                  |
| `retention.jobs`         | Günlük 1 tetik; ~5k log + heartbeat    | Düşük (Faz 12.6)                       |
| `export.audit`           | 30/saat peak; 5k satır cap              | **Orta**: stream HTTP route + worker handler; rate limit Upstash/Postgres |
| `export.payments`        | 30/saat peak; 10k satır cap             | **Orta**: stream route + storage upload (worker mode) |
| `batch.notifications`    | Henüz handler yok                       | Faz 13                                 |
| `report.snapshot`        | Henüz handler yok                       | Faz 13                                 |

**Worker tick capacity**:
- Vercel cron her dakikada bir → batch_size=10 → 600 mesaj/saat.
- pg_cron her dakikada bir → +600 mesaj/saat (Vault secrets ile aktive olursa).
- DLQ depth eşiği: warn >= 20, error >= 100 (Faz 12.7).

## 5. Export Performansı

| Export    | Cap            | Stream | Memory profile             | Risk |
|-----------|----------------|--------|----------------------------|------|
| Audit     | 5.000 satır    | ✅      | ~500 KB; chunk 500/quanta  | Düşük |
| Payments  | 10.000 satır   | ✅      | ~1 MB; chunk 500           | Düşük (sync action hâlâ var) |
| Performance | 200 sporcu cap | ❌    | runJob in-memory           | **LR-13**: 5000 sporcuda kullanıcı 200 sporcu cap'iyle karşılaşır; team-level export Faz 13 |
| Wellness  | Pagination     | ❌      | Page-based                  | Düşük |
| Field tests | 10.000 satır | ❌      | runJob in-memory           | Orta |

## 6. MV Stale Riskleri

| MV                                | Refresh | Stale tolerance | Faz 12.8 dashboard |
|-----------------------------------|---------|-----------------|--------------------|
| `monthly_finance_summary`         | 04:00 UTC daily | 26h | "Stale" >24h, "Critical" >48h |
| `daily_training_load_aggregates`  | 6h cron (daily fallback) | 6h | Aynı eşik; Faz 12.2 read path eligibility'yi 24h içinde sayar |

**Aksiyon**: `daily_training_load_aggregates` için saat başı refresh önerisi (Faz 13) — şu an günlük; team ACWR/EWMA kullanıcıları için 24h önceki veriyi gösterebilir.

## 7. Distributed Rate Limiter

| Adapter   | Trafik kapasitesi | Risk |
|-----------|-------------------|------|
| In-memory | ~tek instance     | OK (Vercel cold start) |
| Upstash   | Global atomic LUA | OK; LUA timeout 1s |
| Postgres  | RPC atomic        | OK; cluster shared connection |

`checkRateLimitDualAsync` failover (dual adapter failure → allow) Faz 12.3 ile aktif.
Org/user separation korunuyor (bucket key = `org:user:scope`).

## 8. Telemetry Yükü

| Telemetry kanalı           | Tetik frekansı | Maliyet     |
|----------------------------|----------------|-------------|
| `logger.info` her server action | ~yüksek    | structured JSON; volume = trafik |
| `reportQueueLatency` per job | <600/dk       | logger.info / warn |
| `reportWorkerDuration` per job | <600/dk     | logger.info / warn |
| `recordRetryAttempt` (storm) | Worker hata path | retry storm uyarısı |
| `reportMvStaleness`        | Dashboard fetch | <5/dk     |
| `reportExportRun`          | Stream tamamlanma | <30/sa  |
| `reportDashboardQuery`     | Sadece slow query | <10/dk  |

Tüm telemetry hot path'i bozmayan **fire-and-forget** structured log. Toplam volume Vercel logging quota'sına göre revize edilebilir.

## 9. Pagination Kırılma Noktaları

- **Payments** 50k/yıl → server-side pagination + cursor Faz 13'te zorunlu. Şu an client-side 50/sayfa = 1000 sayfa scroll.
- **Audit logs** 250k → cursor-based çalışıyor; cap 5000 export.
- **Athlete timeline** 50 ilk → LoadMore. OK.
- **Notifications** 50k aktif → cursor + DataTable. OK.

## 10. Yeni LR Riskleri (LR-12+)

| ID     | Severity | Açıklama                                                                 | Aksiyon                                          |
|--------|----------|--------------------------------------------------------------------------|--------------------------------------------------|
| LR-12  | Orta     | Custom date range payments — large org'da `org_id, paid_at` partial index hâlâ yok | Faz 13 — DDL migration                          |
| LR-13  | Orta     | Performance team-level export 200 sporcu cap; 5000 sporcuda kısmi export | Faz 13 — chunked iterable + cap 1000 + Storage    |
| LR-14  | Düşük    | `daily_training_load_aggregates` 6h cron; hızlı ACWR güncellemesi için saat başı | Faz 13 — refresh cron + telemetry alert         |
| LR-15  | Orta     | Vercel cron + pg_cron paralel tetikli; worker race önlemini `mark_running` sağlıyor ama gözlemlenebilir değil | Faz 13 — worker_id collisions metric            |
| LR-16  | Düşük    | Streaming export'lar `AbortSignal` ile iptal edilirse partial CSV iner; user-facing notice yok | Faz 13 — explicit "truncated" header'ı kullanmak |
| LR-17  | Düşük    | `peaker_worker_heartbeat` 5 dk window; multi-region deploy'da clock skew olabilir | Faz 13 — server timestamp normalizasyonu        |
| LR-18  | Orta     | Postgres rate limiter tablosu retention yok (cleanup RPC var ama cron'a bağlı değil) | Faz 13 — `peaker_rate_limit_cleanup` cron schedule |
| LR-19  | Düşük    | Streaming export route'lar `withServerActionGuard` kapsamı dışında (GET) — yine de session actor kontrolü var; CSRF only POST | Faz 13 — referer/origin opsiyonel check |
| LR-20  | Orta     | `monthly_finance_summary` MV refresh tablosu büyük org'da DDL latency yaratabilir; CONCURRENTLY zaten kullanılıyor ama lock olayları | Faz 13 — refresh dashboard metric (lock_held_ms) |
| LR-21  | Düşük    | Ops paneli `getSystemOperationsSnapshot` içinde alert sync + çoklu sorgu; çok sık poll'da DB yükü | Faz 15 — snapshot RPC veya read replica |
| LR-22  | Orta     | `rateLimiterRuntime` metrikleri process-local; multi-instance konsolidasyon yok | Faz 15 — merkezi metrics sink |
| LR-23  | Düşük    | `replayOperationalAlertEvaluation` audit yazar ama gerçek “re-eval” side-effect minimal (snapshot zaten taze) | Faz 15 — idempotent rule engine tick |
| LR-24  | Orta     | Streaming CSV client tarafında tamamen buffer'lanıyor (indirme öncesi); çok büyük export'ta bellek | Faz 15 — File System Access / stream-to-disk |
| LR-25  | Düşük    | Operational alert escalation sayacı yalnızca kritik + 30dk cooldown; farklı kural aileleri için ayrı policy gerekebilir | İzleme sonrası ince ayar |

## 11. Production Readiness Skor Tablosu

| Boyut                  | Faz 11 sonrası | Faz 12 sonrası | Hedef |
|------------------------|----------------|----------------|-------|
| Async-ready            | 7/10           | **9/10**       | 10    |
| Distributed-safe       | 4/10           | **8/10**       | 9     |
| Large-scale stable     | 6/10           | **8/10**       | 9     |
| Enterprise operational | 5/10           | **8/10**       | 9     |
| High-volume resilient  | 6/10           | **8/10**       | 9     |
| Telemetry / observability | 6/10        | **9/10**       | 9     |
| Rollback safety        | 9/10           | **9/10**       | 10    |

**Genel değerlendirme**: Faz 12, Faz 11'in foundation'ını gerçekten "production-ready async + distributed-safe + large-scale stable" hale getirdi. Geriye kalan teknik borçlar Faz 13'te indekslerin / saat başı MV refresh'in / team-level export'un yüksek-org senaryosunda gözlemlenmesi gereken metriklere bağlı.

## 12. Faz 13'e Bırakılan Teknik Borçlar (kısa liste)

1. `payments_org_paid_at_idx` partial index (LR-12)
2. Team-level performance export (LR-13)
3. `daily_training_load_aggregates` saat başı refresh (LR-14)
4. Worker race observability — worker_id collision metric (LR-15)
5. Streaming export abort UX (LR-16)
6. Rate limiter table retention cron (LR-18)
7. MV refresh lock_held_ms metric (LR-20)
8. `batch.notifications` + `report.snapshot` worker handler'ları
9. Real-time DLQ depth + retry-storm Sentry alert kuralı
10. `payments` server-side cursor pagination (>50k row scenario)
