import "server-only";

import { createServerSupabaseClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole, type UserRole } from "@/lib/auth/roleMatrix";
import { extractSessionOrganizationId, extractSessionRole } from "@/lib/auth/sessionClaims";

export type SessionActor = {
  id: string;
  role: UserRole;
  organizationId: string | null;
  isActive: boolean | null;
  fullName: string | null;
};

export type TenantProfileRow = {
  id: string;
  role: string;
  organization_id: string | null;
  is_active: boolean | null;
};

export type ProgramActorProfile = TenantProfileRow & { full_name: string | null };

export function toTenantProfileRow(actor: SessionActor): TenantProfileRow {
  return {
    id: actor.id,
    role: actor.role,
    organization_id: actor.organizationId,
    is_active: actor.isActive,
  };
}

export function toProgramActorProfile(actor: SessionActor): ProgramActorProfile {
  return {
    ...toTenantProfileRow(actor),
    full_name: actor.fullName,
  };
}

export type ResolveSessionActorOptions = {
  /**
   * Profil yokken yalnızca JWT claim ile devam edilecekse organizasyon id zorunlu olsun mu.
   * (program, yoklama, ders, finans gibi tenant-scoped aksiyonlar için true.)
   */
  claimRequiresOrganization?: boolean;
};

/**
 * Oturum + profiles (+ gerekirse service-role) ile tek tip aktör çözümü.
 * Davranış snapshotActions.resolveActor ile hizalıdır.
 */
export async function resolveSessionActor(
  options: ResolveSessionActorOptions = {}
): Promise<{ actor: SessionActor } | { error: string }> {
  const { claimRequiresOrganization = false } = options;

  const sessionClient = await createServerSupabaseClient();
  const { data: authData, error: authError } = await sessionClient.auth.getUser();
  if (authError || !authData.user) return { error: "Gecersiz oturum." };

  const claimRoleRaw = extractSessionRole(authData.user);
  if (getSafeRole(claimRoleRaw) === "super_admin") {
    return {
      actor: {
        id: authData.user.id,
        role: "super_admin",
        organizationId: null,
        isActive: true,
        fullName: null,
      },
    };
  }

  let { data: profile } = await sessionClient
    .from("profiles")
    .select("id, role, full_name, organization_id, is_active")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (!profile) {
    try {
      const adminClient = createSupabaseAdminClient();
      const byId = await adminClient
        .from("profiles")
        .select("id, role, full_name, organization_id, is_active")
        .eq("id", authData.user.id)
        .maybeSingle();
      if (byId.data) {
        profile = byId.data;
      } else if (authData.user.email) {
        const byEmail = await adminClient
          .from("profiles")
          .select("id, role, full_name, organization_id, is_active")
          .eq("email", authData.user.email)
          .limit(2);
        if (!byEmail.error && (byEmail.data || []).length === 1) {
          const src = byEmail.data![0];
          profile = {
            id: authData.user.id,
            role: src.role,
            full_name: src.full_name,
            organization_id: src.organization_id,
            is_active: src.is_active,
          };
          await adminClient.from("profiles").upsert(
            {
              id: authData.user.id,
              email: authData.user.email,
              role: src.role,
              full_name: src.full_name,
              organization_id: src.organization_id,
              is_active: src.is_active ?? true,
            },
            { onConflict: "id" }
          );
        }
      }
    } catch {
      // claim fallback below
    }
  }

  if (!profile) {
    if (!claimRoleRaw) return { error: "Profil dogrulanamadi." };
    const claimRole = getSafeRole(claimRoleRaw);
    if (!claimRole) return { error: "Profil dogrulanamadi." };
    const orgId = extractSessionOrganizationId(authData.user);
    if (claimRequiresOrganization && !orgId) return { error: "Kullanici profili dogrulanamadi." };
    return {
      actor: {
        id: authData.user.id,
        role: claimRole,
        organizationId: orgId ?? null,
        isActive: true,
        fullName: null,
      },
    };
  }

  const profileRole = getSafeRole(profile.role);
  if (!profileRole) return { error: "Gecersiz rol." };

  return {
    actor: {
      id: profile.id,
      role: profileRole,
      organizationId: profile.organization_id ?? null,
      isActive: profile.is_active ?? null,
      fullName: profile.full_name ?? null,
    },
  };
}
