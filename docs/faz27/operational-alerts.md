# Operational Alerts

Kaynak: `evaluateOperationalAlerts` → `peaker_operational_alerts` tablosu.

## Severity

| Seviye | Anlam |
|--------|--------|
| info | Bilgi |
| warning | Müdahale planla |
| critical | Acil |

## Kurallar (FAZ 27)

| ruleKey | Tetik |
|---------|--------|
| `queue:latency_oldest_queued` | En eski queued job yaşı |
| `queue:dlq_growth_sample` | DLQ örnek seti |
| `queue:enqueue_spike_60m` | 60 dk enqueue spike |
| `export:duration_p95` | Export p95 süre |
| `export:concurrent_active` | Eşzamanlı export |
| `worker:heartbeat_stale` | Worker tick gecikmesi |
| `worker:dead_stuck_24h` | Stuck → DLQ |
| `worker:retry_storm_24h` | Retry storm |
| `mv:stale_*` | MV freshness |
| `cron:failed:*` | Cron job failed |

## Acknowledge / resolve

Sistem operasyonları panelinden veya `operationalAlertActions`.
