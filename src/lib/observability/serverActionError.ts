import * as Sentry from "@sentry/nextjs";
import { isSentryRuntimeEnabled } from "@/lib/observability/sentryEnv";

/**
 * Server action / sunucu işleminde yakalanan hatayı güvenli şekilde raporlar.
 * - PII eklemez; action adı tag olarak gider.
 * - Önce konsola (sunucu log / hosting drain) düşer, sonra Sentry açıksa capture.
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

/**
 * Beklenmeyen throw'ları raporlar; davranışı korur (aynı hatayı yeniden fırlatır).
 * Çoğu action `{ error: string }` döndüğü için throw seyrek — yine de ağ/seri hata durumunda görünürlük sağlar.
 */
export async function withServerActionGuard<T>(actionName: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    captureServerActionError(actionName, err);
    throw err;
  }
}
