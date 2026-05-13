# Faz 10.8 — Large Org Stress Audit

> Simülasyon hedefi: **1000 sporcu / 20 koç / 100k training_load / 20k payments / 50k wellness_reports / 10 yıl audit_logs**.

## 1) Query Bazlı Risk Analizi

| Action | Tablolar | Query Risk | Mitigasyon (mevcut) | Faz 11 |
|--------|----------|-----------:|---------------------|--------|
| `listPerformanceAnalyticsData` (tek sporcu, 28 gün) | `training_loads`, `wellness_reports` | 🟢 Düşük | Tek profile_id, date range filter |  — |
| `listPerformanceAnalyticsData` (takım, 28 gün) | aynı | 🟡 Orta | Faz 9.2 chunking + Faz 8.1 soft cap (PROFILE_LOAD_FETCH_HARD_CAP=1000) | Materialized view |
| `exportPerformanceSummaryCSV` | aynı | 🟢 Düşük | PERFORMANCE_SUMMARY_HARD_CAP=200 | streaming export |
| `loadAccountingFinanceDashboard` (genel) | `payments`, `lessons`, `private_lesson_payments` | 🔴 Yüksek | Filter ile sınırlı; ay bazlı | MV `monthly_finance_summary` |
| `loadFinanceForAthletes` (tüm sporcular) | `payments`, `private_lesson_*` | 🟡 Orta | Faz 9.2 chunked .in() | — |
| `listAthleticResultsByDate` (team) | `athletic_results` | 🟡 Orta | Chunked .in() | — |
| `listAuditLogs` (filter) | `audit_logs` | 🟢 Düşük | Pagination + retention 365 gün | — |
| `listNotificationsForUser` | `notifications` | 🟢 Düşük | Per-user filter + pagination | — |
| `listWellnessArchiveForManagement` | `wellness_reports` join `profiles` | 🟢 Düşük | Pagination + date filter (Faz 9.5) | — |

**Kritik:** `loadAccountingFinanceDashboard` 20k payment satırı üzerinde aggregation yapıyor; ay başında 1.5-3s sürebilir. → MV implementation Faz 10.3'te yapıldı (`monthly_finance_summary`), ancak hâlâ live query kullanılıyor (backward-compat). Faz 11'de selektif MV read path eklenebilir.

## 2) Render Risk Analizi

| Sayfa | Render Risk | Sebep | Mitigasyon |
|-------|------------|------|------------|
| `performans/page.tsx` (1023 satır) | 🟡 Orta | Çoklu chart + filtre değişimi | ChartFrame memo (Faz 8.11 + 10.4); 90 gün takım grafiği için verilerin aggregation'ı `aggregateTrainingLoadsByCalendarDay` |
| `sporcu/[id]/page.tsx` (493 satır) | 🟡 Orta | 6+ section, paralel fetch | useAthletePanel adoption (Faz 10.1c); chart memo (Faz 10.4) |
| `muhasebe-finans/page.tsx` (605 satır) | 🟢 Düşük | Filtre apply'da tek fetch | useAccountingFinanceDashboard (Faz 10.1b) |
| `haftalik-ders-programi/page.tsx` (861 satır) | 🔴 Yüksek (Faz 11 backlog) | Her keystroke'da filter rerender |  TODO: virtualization veya debounced filter |
| `audit-log/page.tsx` | 🟢 Düşük | DataTablePagination (Faz 9.7) | — |
| `bildirimler/page.tsx` | 🟢 Düşük | LoadMoreButton + EmptyState (Faz 10.5) | — |

## 3) Export Risk Analizi

| Export | Hard Cap | Telemetry | Streaming Hazır mı? |
|--------|---------:|-----------|---------------------|
| Audit log | 5000 | ✅ logger.info | 🟡 buildCsvFromRows row-based |
| Performance summary | 200 | ✅ runJob telemetry (Faz 9.4) | 🟡 row-based |
| Accounting payments | 10000 | ✅ logger.info | 🟡 row-based |
| Field tests | 10000 | ✅ logger.info | 🟡 row-based |

**Memory budget**: 10000 satır × ~500 byte = ~5MB CSV. Vercel function memory limit'inin altında. 50k+ ihtiyaç olursa streaming gerekli.

## 4) Pagination Risk Analizi

| Liste | Şu anki davranış | Tutarlı mı? |
|-------|------------------|-------------|
| Audit log | Server-side pagination (50/sayfa) + DataTablePagination | ✅ |
| Notifications | Server-side load-more (50/yük) | ✅ |
| Wellness archive | Server-side load-more (200/yük) + date filter | ✅ |
| Athlete finance timeline | Client-side load-more (50/yük) | ✅ |
| Accounting payments | Cap-only (max 10000) | 🟡 Pagination yok |

**Aksiyon**: Accounting payments için server-side pagination Faz 11'e ertelendi (filtre yapısı karmaşık; MV ile çözüm daha iyi olabilir).

## 5) Chart Risk Analizi

| Chart | Veri Boyutu (typical) | Rerender Riski | Faz 8/9/10 Mitigasyonu |
|-------|----------------------|----------------|------------------------|
| ACWR (performans) | 90 günlük × tek sporcu = ~90 nokta | 🟢 Düşük | ChartFrame memo |
| EWMA (performans) | aynı | 🟢 Düşük | ChartFrame memo |
| Sporcu detay: radar | 1 sporcu × 6 metrik | 🟢 Düşük | ChartFrame memo |
| Sporcu detay: weekly load | son 7 gün | 🟢 Düşük | ChartFrame memo |
| Sporcu detay: insights ACWR/EWMA/loads/wellness/body | 90 gün | 🟡 Orta | ChartFrame memo (Faz 10.4) |
| Saha test radarları | 3-10 sporcu × 5 metrik | 🟢 Düşük | — |

## 6) Storage / DB Büyüme Tahmini (1000 sporcu / 1 yıl)

| Tablo | Tahmini boyut | İndeks ihtiyacı |
|-------|---------------|------------------|
| `training_loads` | 1000 × 250 gün ≈ 250k satır × 200 byte ≈ 50MB | `(profile_id, measurement_date)` ✅ |
| `wellness_reports` | 1000 × 200 gün ≈ 200k satır × 300 byte ≈ 60MB | `(profile_id, report_date desc)` ✅ |
| `payments` | 1000 × 12 ay ≈ 12k satır × 1KB ≈ 12MB | `(organization_id, due_date)` partial ✅ |
| `notifications` | 1000 × 30 gün ≈ 30k satır × 500 byte ≈ 15MB | retention 90 gün ✅ |
| `audit_logs` | 100k+ event/yıl × 1KB ≈ 100MB+ | retention 365 gün ✅ |
| `athletic_results` | 1000 × 4 test/yıl × 5 metrik ≈ 20k × 200 byte ≈ 4MB | `(profile_id, test_date)` ✅ |

**Total DB footprint**: ~250MB / yıl / 1000 sporcu. Supabase Pro tier 8GB içinde 30+ yıl yer.

## 7) Sentry / Logging Risk

| Olay | Logging | PII Risk |
|------|---------|----------|
| Server action error | `logger.error` ile severity'e göre | ✅ PII sanitized |
| Slow query (>800ms) | `measureQuery` slow path | — |
| Slow action (>1500ms) | `measureAction` slow path | — |
| `runJob` failure | `logger.error("job", "failed", { kind, jobId })` | — |
| `chunkedInQuery` chunk failure | `logger.warn` ile failed chunk index | — |

## 8) Belirlenen Riskler ve Eylem Planı

| ID | Risk | Şu anki durum | Hedef |
|----|------|---------------|-------|
| LR-1 | `loadAccountingFinanceDashboard` 20k+ payment satırında yavaş | Aktif live query | Faz 11: MV `monthly_finance_summary` read path |
| LR-2 | `haftalik-ders-programi` her keystroke'da rerender | Aktif | Faz 11: debounce + section memo |
| LR-3 | CSV export 50k+ satırda memory baskısı | Cap koruması var | Faz 11: streaming CSV / async job |
| LR-4 | `chunkedInQuery` 1000+ ID'de URL büyüklüğü hâlâ olabilir | Cap 500, max concurrent 4 | Faz 11: Telemetry ile chunk count ölç → optimal değer |
| LR-5 | Accounting payments pagination eksik | Cap 200 | Faz 11: server-side pagination |
| LR-6 | Performance team view → 1000 sporcu × 90 gün = 90k satır | Soft cap 500, hard cap 1000 | Faz 11: MV `daily_training_load_aggregates` |

**Sonuç**: Sistem 1000 sporcu / 100k training_load seviyesinde **stabil** çalışacak şekilde sağlamlaştırıldı. Daha büyük ölçek için MV read path + streaming export Faz 11'de planlı.
