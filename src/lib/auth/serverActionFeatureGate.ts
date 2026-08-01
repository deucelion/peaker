import type { ServerActionFeatureDenial } from "@/lib/auth/serverActionFeatureAccess";
import {
  assertOrganizationFeatureForAction,
  isServerActionPermissionDeniedResult,
  peekOrganizationIdForServerAction,
} from "@/lib/auth/serverActionFeatureAccess";
import { resolveActionNamespaceEntitlementKey } from "@/lib/organization/features/surfaces/resolveActionNamespaceEntitlement";

export type ServerActionGuardContext = {
  readonly actionName: string;
  assertOrganizationFeature(organizationId: string | null): Promise<ServerActionFeatureDenial | null>;
};

export function createServerActionGuardContext(actionName: string): ServerActionGuardContext {
  return {
    actionName,
    assertOrganizationFeature: (organizationId) =>
      assertOrganizationFeatureForAction(actionName, organizationId),
  };
}

/**
 * Permission sonrasi ctx.assertOrganizationFeature(orgId) cagrisi onerilir.
 * Map hit + explicit assert yoksa, fn basarili donusunde org peek ile otomatik gate calisir.
 * Permission denied sonucunda runtime cagrilmaz.
 */
export async function runServerActionWithFeatureGate<T>(
  actionName: string,
  fn: (ctx: ServerActionGuardContext) => Promise<T>
): Promise<T> {
  const ctx = createServerActionGuardContext(actionName);
  let explicitFeatureCheck = false;

  const trackedCtx: ServerActionGuardContext = {
    actionName,
    assertOrganizationFeature: async (organizationId) => {
      explicitFeatureCheck = true;
      return assertOrganizationFeatureForAction(actionName, organizationId);
    },
  };

  const result = await fn(trackedCtx);

  if (isServerActionPermissionDeniedResult(result)) {
    return result;
  }

  if (explicitFeatureCheck || !resolveActionNamespaceEntitlementKey(actionName)) {
    return result;
  }

  const organizationId = await peekOrganizationIdForServerAction();
  const denial = await assertOrganizationFeatureForAction(actionName, organizationId);
  if (denial) {
    return denial as T;
  }

  return result;
}
