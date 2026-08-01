import { runServerActionWithFeatureGate, type ServerActionGuardContext } from "@/lib/auth/serverActionFeatureGate";
import { captureServerActionError } from "@/lib/observability/serverActionTelemetry";

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

export { captureServerActionError, captureServerActionSignal } from "@/lib/observability/serverActionTelemetry";

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
