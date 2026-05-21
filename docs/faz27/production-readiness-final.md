# Production Readiness — Final (FAZ 27)

Önceki: [`docs/faz21/production-readiness.md`](../faz21/production-readiness.md)

## Yeni operasyon katmanları (FAZ 27)

- `src/lib/monitoring/runtime/` — server action, export, queue, cron, offline replay trackers
- `src/lib/ops/envValidation.ts` — deploy öncesi ENV kontrolü
- `src/lib/ops/systemHealthScore.ts` — ops panel skorları
- `src/lib/ops/operationalContext.ts` — correlationId, diagnostics envelope
- Genişletilmiş `evaluateOperationalAlerts` kuralları
- `ProductionHealthOverview` — Sistem Operasyonları üst panel

## Launch öncesi minimum

1. Migration sırası (faz21 doc)
2. `validateProductionEnv()` → zorunlu key’ler yeşil
3. `npm run lint && npm test && npm run build`
4. [`production-smoke.md`](./production-smoke.md) manuel
5. Worker heartbeat aktif (ops panel)
6. Realtime publication migration uygulandı

## Korunan sistemler

- RLS / tenant isolation
- Offline queue (localStorage + IDB)
- Finans otomatik offline sync yok (blocked)
- PWA service worker (auth/API cache yok)
