# FAZ 27 — Production Readiness Audit

## Kritik

| Risk | Etki | Azaltma |
|------|------|---------|
| Eksik `SUPABASE_SERVICE_ROLE_KEY` | Tüm admin işlemleri çöker | `validateProductionEnv`, deploy checklist |
| Migration drift (FAZ 18/19/20) | Finans/paket/realtime kırılır | Şema sağlığı paneli, forward-fix |
| Worker/cron durması | Retention, export, bildirim gecikir | Heartbeat uyarıları, pg_cron |
| Cross-tenant RLS hatası | Veri sızıntısı | RLS review, scope key’ler |

## Orta

| Risk | Etki | Azaltma |
|------|------|---------|
| Realtime reconnect storm | UI gecikmesi, fazla fetch | İstemci telemetri, debounce, storm tespiti |
| DLQ / kuyruk büyümesi | Geciken işler | Ops uyarıları, queue admin |
| Export p95 yüksek | Timeout, abuse | Rate limit, export uyarıları |
| Offline replay storm | Yinelenen server action | Idempotency, failure kind, max retry |
| 5k+ sporcu tenant | Yavaş dashboard | Performance profiling, MV read-path |

## Düşük

| Risk | Etki | Azaltma |
|------|------|---------|
| SW stale cache | Eski statik asset | Versiyonlu cache, auth HTML cache yok |
| MV stale | Eski finans özeti | MV refresh cron, uyarı |
| Audit list spike | DB yükü | Export rate limit, tarih filtresi |
