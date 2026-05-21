# Performance Risks (Large Tenant)

| Alan | Risk | Not |
|------|------|-----|
| Admin dashboard | Çok ders/sporcu snapshot | Pagination, lazy load |
| Audit list | Geniş tarih aralığı | Max range, stream export |
| Receivables | Aggregate sorgular | MV / index |
| Performans merkezi | Çok sporcu ACWR | MV read `PEAKER_PERF_MV_READ` |
| Realtime | Çok kanal | Org filter, debounce |
| Paket timeline | Çok event | Sayfalama |
| Offline queue | Büyük batch | Onaylı sync, idempotency |

Hedef: 5k+ sporcu org’da P95 dashboard < 3s (ölçüm önerilir).
