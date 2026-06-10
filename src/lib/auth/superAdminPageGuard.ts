import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDefaultRouteForRole } from "@/lib/auth/roleMatrix";
import { resolveRouteRoleFromUser } from "@/lib/auth/resolveRouteRole";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { logRouteRedirectDecision } from "@/lib/auth/routeRedirect";

/**
 * Super admin sayfaları: oturum yok → login; yetkisiz tenant rolü → kendi dashboard'u (login değil).
 */
export async function assertSuperAdminPageAccess(
  sessionClient: SupabaseClient,
  user: User,
  pathname: string
): Promise<void> {
  const actor = await resolveSessionActor({ claimRequiresOrganization: false });
  if (!("error" in actor) && actor.actor.role === "super_admin") return;

  // FAZ 29: metadata claim'inden super_admin profili self-provision etme kaldırıldı.
  // Super admin profilleri yalnızca kontrollü provisioning (ops/script) ile oluşturulur.
  let profile: { id: string; role?: string | null } | null = null;

  const profileRes = await sessionClient.from("profiles").select("id, role").eq("id", user.id).maybeSingle();
  if (profileRes.data) profile = profileRes.data;

  if (!profile) {
    try {
      const adminClient = createSupabaseAdminClient();
      const byId = await adminClient.from("profiles").select("id, role").eq("id", user.id).maybeSingle();
      if (byId.data) profile = byId.data;
    } catch {
      // guard aşağıda karar verir
    }
  }

  const effectiveRole = resolveRouteRoleFromUser(user, profile?.role);
  if (effectiveRole === "super_admin") return;

  const target = effectiveRole ? getDefaultRouteForRole(effectiveRole) : "/login";
  logRouteRedirectDecision("super-admin-page", {
    pathname,
    role: effectiveRole,
    organizationId: null,
    target,
    reason: "not_super_admin",
  });
  redirect(target);
}
