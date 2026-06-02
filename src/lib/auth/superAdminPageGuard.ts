import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDefaultRouteForRole } from "@/lib/auth/roleMatrix";
import { resolveRouteRoleFromUser } from "@/lib/auth/resolveRouteRole";
import { extractSessionRole } from "@/lib/auth/sessionClaims";
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

  let profile: { id: string; role?: string | null } | null = null;

  const profileRes = await sessionClient.from("profiles").select("id, role").eq("id", user.id).maybeSingle();
  if (profileRes.data) profile = profileRes.data;

  const sessionRole = extractSessionRole(user);

  if (!profile) {
    try {
      const adminClient = createSupabaseAdminClient();
      const byId = await adminClient.from("profiles").select("id, role").eq("id", user.id).maybeSingle();
      if (byId.data) profile = byId.data;
    } catch {
      // claim ile devam
    }
  }

  if (!profile?.role && /super[\s_-]?admin/i.test(sessionRole || "")) {
    try {
      const adminClient = createSupabaseAdminClient();
      const { error } = await adminClient.from("profiles").upsert(
        {
          id: user.id,
          email: user.email ?? null,
          full_name: user.email ?? "Super Admin",
          role: "super_admin",
          organization_id: null,
          is_active: true,
        },
        { onConflict: "id" }
      );
      if (!error) {
        const refresh = await sessionClient.from("profiles").select("id, role").eq("id", user.id).maybeSingle();
        if (refresh.data) profile = refresh.data;
      }
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
