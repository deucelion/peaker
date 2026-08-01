import * as Sentry from "@sentry/nextjs";
import { isSentryRuntimeEnabled } from "@/lib/observability/sentryEnv";
import { runServerActionWithFeatureGate, type ServerActionGuardContext } from "@/lib/auth/serverActionFeatureGate";

export type { ServerActionGuardContext };
export {
  assertOrganizationFeatureForAction,
  evaluateServerActionFeatureAccess,
  evaluateServerActionFeatureAccessAfterPermissions,
  isServerActionFeatureDenial,
  isServerActionPermissionDeniedResult,
} from "@/lib/auth/serverActionFeatureAccess";
export type {
  ServerActionFeatureDecision,
  ServerActionFeatureDenial,
} from "@/lib/auth/serverActionFeatureAccess";

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
 * Permission sonrası feature gate icin ctx.assertOrganizationFeature(orgId) kullanin.
 */
export async function withServerActionGuard<T>(
  actionName: string,
  fn: (ctx: ServerActionGuardContext) => Promise<T>
): Promise<T> {
  try {
    return await runServerActionWithFeatureGate(actionName, fn);
  } catch (err) {
    captureServerActionError(actionName, err);
    throw err;
  }
}
