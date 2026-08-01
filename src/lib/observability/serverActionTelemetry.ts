import * as Sentry from "@sentry/nextjs";
import { isSentryRuntimeEnabled } from "@/lib/observability/sentryEnv";

/**
 * Server action telemetry — Sentry/console only.
 * Feature gate veya runtime bagimliligi yok; client-safe logger tarafindan da kullanilabilir.
 */
export function captureServerActionError(
  actionName: string,
  err: unknown,
  extra?: Record<string, unknown>
): void {
  const error = err instanceof Error ? err : new Error(typeof err === "string" ? err : JSON.stringify(err));
  console.error(`[Peaker] server action error: ${actionName}`, error);
  if (!isSentryRuntimeEnabled()) return;
  Sentry.captureException(error, {
    tags: { server_action: actionName },
    extra: extra ?? {},
  });
}

export function captureServerActionSignal(
  actionName: string,
  message: string,
  extra?: Record<string, unknown>
): void {
  console.error(`[Peaker][signal] ${actionName}: ${message}`, extra ?? {});
  if (!isSentryRuntimeEnabled()) return;
  Sentry.captureMessage(`[${actionName}] ${message}`, {
    level: "error",
    tags: { server_action: actionName, signal_type: "handled_error" },
    extra: extra ?? {},
  });
}
