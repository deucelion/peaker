import type { ServerActionFeatureDenial } from "@/lib/auth/serverActionFeatureAccess";
import {
  assertOrganizationFeatureForAction,
  resolveServerActionGateTarget,
} from "@/lib/auth/serverActionFeatureAccess";
import { isAlwaysOnEntitlementKey } from "@/lib/organization/features/keys";
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
 * Faz 41: entitlement kontrolu action body'sinden ONCE calisir.
 * Namespace bir configurable entitlement'a mapliyse ve aktorun organizasyonu oturumdan
 * guvenilir sekilde cozulebiliyorsa, entitlement kapaliyken body hic calistirilmaz —
 * boylece mutation'lar deny'dan once DB'ye yazamaz.
 *
 * Organizasyonu oturumdan cozulemeyen aktorlerde (super_admin, oturumsuz istek) gate
 * atlanir; bu aktorlerde yetki karari action'in kendi authorization akisina aittir.
 * Entity lookup sonrasi org bulan action'lar `ctx.assertOrganizationFeature` kullanmayi surdurur.
 */
export async function runServerActionWithFeatureGate<T>(
  actionName: string,
  fn: (ctx: ServerActionGuardContext) => Promise<T>
): Promise<T> {
  const entitlementKey = resolveActionNamespaceEntitlementKey(actionName);

  if (entitlementKey && !isAlwaysOnEntitlementKey(entitlementKey)) {
    const target = await resolveServerActionGateTarget();
    if (target.gated) {
      const denial = await assertOrganizationFeatureForAction(actionName, target.organizationId);
      if (denial) {
        return denial as T;
      }
    }
  }

  return fn(createServerActionGuardContext(actionName));
}
