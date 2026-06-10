import "server-only";

import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole, type UserRole } from "@/lib/auth/roleMatrix";
import { looksLikeSuperAdminRole } from "@/lib/auth/resolveRouteRole";
import { extractSessionOrganizationId, extractSessionRole, extractSessionFullName } from "@/lib/auth/sessionClaims";
import { isUuid } from "@/lib/validation/uuid";

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

type ProfileSelectRow = {
  id: string;
  role: string;
  full_name: string | null;
  organization_id: string | null;
  is_active: boolean | null;
};

/**
 * Auth metadata'dan tenant profili olusturur / eksik organization_id'yi tamamlar.
 * Yeni kayitli sporcu/koc icin profiles satiri yoksa veya org_id bos ise login engellenmesin.
 */
async function ensureTenantProfileFromMetadata(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  user: User,
  existing: ProfileSelectRow | null
): Promise<ProfileSelectRow | null> {
  const metaRole = getSafeRole(extractSessionRole(user));
  const metaOrgId = extractSessionOrganizationId(user);
  if (!metaRole || metaRole === "super_admin") return existing;
  if (metaRole !== "coach" && metaRole !== "sporcu") return existing;
  if (!user.email_confirmed_at || !metaOrgId || !isUuid(metaOrgId)) return existing;

  const needsInsert = !existing;
  const needsOrgRepair = !!existing && !existing.organization_id && metaOrgId;
  if (!needsInsert && !needsOrgRepair) return existing;

  const payload = {
    id: user.id,
    email: user.email ?? null,
    full_name: existing?.full_name ?? extractSessionFullName(user) ?? user.email ?? "User",
    role: existing?.role && getSafeRole(existing.role) ? existing.role : metaRole,
    organization_id: existing?.organization_id ?? metaOrgId,
    is_active: existing?.is_active ?? true,
  };

  const { error } = await adminClient.from("profiles").upsert(payload, { onConflict: "id" });
  if (error) return existing;

  return {
    id: user.id,
    role: payload.role,
    full_name: payload.full_name,
    organization_id: payload.organization_id,
    is_active: payload.is_active,
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

  // FAZ 29: super_admin claim kestirmesi kaldırıldı — super_admin yalnızca
  // profiles tablosundaki rol ile kanıtlanır (user_metadata client yazabilir).
  const claimRoleRaw = extractSessionRole(authData.user);

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
      } else if (authData.user.email && authData.user.email_confirmed_at) {
        // FAZ 29: e-posta eşleşmeli bağlama yalnızca doğrulanmış e-postayla ve
        // asla super_admin profillerine yapılmaz (hesap devralma koruması).
        const byEmail = await adminClient
          .from("profiles")
          .select("id, role, full_name, organization_id, is_active")
          .eq("email", authData.user.email)
          .limit(2);
        const candidate =
          !byEmail.error && (byEmail.data || []).length === 1 ? byEmail.data![0] : null;
        if (candidate && !looksLikeSuperAdminRole(candidate.role)) {
          profile = {
            id: authData.user.id,
            role: candidate.role,
            full_name: candidate.full_name,
            organization_id: candidate.organization_id,
            is_active: candidate.is_active,
          };
          await adminClient.from("profiles").upsert(
            {
              id: authData.user.id,
              email: authData.user.email,
              role: candidate.role,
              full_name: candidate.full_name,
              organization_id: candidate.organization_id,
              is_active: candidate.is_active ?? true,
            },
            { onConflict: "id" }
          );
        }
      }
    } catch {
      // claim fallback below
    }
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const repaired = await ensureTenantProfileFromMetadata(adminClient, authData.user, profile ?? null);
    if (repaired) profile = repaired;
  } catch {
    // mevcut profile veya claim fallback ile devam
  }

  if (!profile) {
    if (!claimRoleRaw) return { error: "Profil dogrulanamadi." };
    const claimRole = getSafeRole(claimRoleRaw);
    // FAZ 29: claim fallback tenant rolleriyle sınırlıdır; profil satırı olmadan
    // super_admin yetkisi verilmez.
    if (!claimRole || claimRole === "super_admin") return { error: "Profil dogrulanamadi." };
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

  const profileRole = looksLikeSuperAdminRole(profile.role)
    ? "super_admin"
    : getSafeRole(profile.role);
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
