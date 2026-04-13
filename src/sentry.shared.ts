import * as Sentry from "@sentry/nextjs";
import { getSentryDsn, getSentryEnvironment, isSentryRuntimeEnabled } from "@/lib/observability/sentryEnv";

/**
 * Client + Node + Edge için ortak Sentry.init seçenekleri (minimal: hata, düşük örnekleme).
 */
function allowSendInDev(): boolean {
  const v = process.env.NEXT_PUBLIC_SENTRY_DEV?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function getPeakerSentryInitOptions(): NonNullable<Parameters<typeof Sentry.init>[0]> {
  const dsn = getSentryDsn();
  const baseEnabled = isSentryRuntimeEnabled();
  const devOk = process.env.NODE_ENV !== "development" || allowSendInDev();
  return {
    dsn,
    enabled: baseEnabled && devOk,
    environment: getSentryEnvironment(),
    /** Performans izleme kapalı — yalnızca hata olayları (maliyet ve gürültü azaltır). */
    tracesSampleRate: 0,
    /** Session Replay yok — ek bundle ve gizlilik riski yok. */
    sendDefaultPii: false,
  };
}
