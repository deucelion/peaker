# Monitoring Guide

## Log katmanları

| Katman | Konum | İçerik |
|--------|--------|--------|
| Structured logger | `src/lib/monitoring/logger.ts` | scope, duration, correlationId |
| Advanced telemetry | `advancedTelemetry.ts` | queue, worker, export eşikleri |
| Runtime (FAZ 27) | `src/lib/monitoring/runtime/` | domain event’ler |

## PII kuralı

Log’a **girmeyen**: email, mesaj gövdesi, finans tutarı detayı, auth token, offline payload.

## Ops panel

`/sistem-operasyonlari` — Production sağlık özeti, kuyruk, worker, uyarılar, realtime istemci sayaçları.

## Sentry

`global-error.tsx` — production exception. `NEXT_PUBLIC_SENTRY_DSN` önerilir.

## İstemci realtime

`clientRealtimeStats` — reconnect, failed subscription, channel subscribe. Storm: `isRealtimeReconnectStorm()`.
