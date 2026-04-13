import "server-only";

import type { User } from "@supabase/supabase-js";
import type { SessionProfileRow } from "@/lib/auth/tenantProfileMerge";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";

/**
 * Oturum aktörü: `resolveSessionActor` tek kaynak; me-role / org-durumu için satır şekline çevrilir.
 */
export async function loadSessionProfileWithAdminFallback(user: User): Promise<{
  profile: SessionProfileRow | null;
  profileError: { message: string } | null;
}> {
  void user;
  const result = await resolveSessionActor();
  if ("error" in result) {
    return {
      profile: null,
      profileError: { message: result.error },
    };
  }

  const { actor } = result;
  if (actor.role === "super_admin") {
    return {
      profile: {
        role: "super_admin",
        full_name: actor.fullName,
        organization_id: null,
        is_active: actor.isActive ?? true,
      },
      profileError: null,
    };
  }

  return {
    profile: {
      role: actor.role,
      full_name: actor.fullName,
      organization_id: actor.organizationId,
      is_active: actor.isActive,
    },
    profileError: null,
  };
}
