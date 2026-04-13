import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole, type UserRole } from "@/lib/auth/roleMatrix";
import { isUuid } from "@/lib/validation/uuid";

type AuthUserLite = {
  id: string;
  email: string | null;
  user_metadata?: { role?: string; organization_id?: string; full_name?: string } | null;
};

type ProfileLite = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  organization_id: string | null;
  is_active?: boolean | null;
};

export type ProfileIntegrityReport = {
  authUserCount: number;
  profileCount: number;
  missingProfileCount: number;
  orphanProfileCount: number;
  missingOrganizationCount: number;
  invalidRoleCount: number;
  superAdminRoleMismatchCount: number;
  missingProfileUserIds: string[];
  orphanProfileUserIds: string[];
  invalidRoleProfileIds: string[];
  missingOrganizationProfileIds: string[];
  superAdminRoleMismatchIds: string[];
};

export type ProfileIntegrityRepairResult = {
  dryRun: boolean;
  scanned: ProfileIntegrityReport;
  createdProfiles: number;
  normalizedRoles: number;
  filledOrganizationIds: number;
  skippedMissingProfiles: number;
  deletedOrphanProfiles: number;
};

function normalizeRawRole(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const n = raw.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (!n) return null;
  if (n === "superadmin") return "super_admin";
  if (n === "administrator") return "admin";
  if (n === "athlete" || n === "player") return "sporcu";
  return n;
}

function hasValidTenantOrganizationId(role: UserRole | null, orgId: string | null | undefined): boolean {
  if (role === "super_admin") return true;
  if (!role) return false;
  return isUuid(orgId);
}

async function listAllAuthUsers(adminClient: ReturnType<typeof createSupabaseAdminClient>): Promise<AuthUserLite[]> {
  const rows: AuthUserLite[] = [];
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Auth users listesi alinamadi: ${error.message}`);
    const users = data?.users ?? [];
    rows.push(
      ...users.map((u) => ({
        id: u.id,
        email: u.email ?? null,
        user_metadata: (u.user_metadata as AuthUserLite["user_metadata"]) ?? null,
      }))
    );
    if (users.length < 200) break;
  }
  return rows;
}

async function listAllProfiles(adminClient: ReturnType<typeof createSupabaseAdminClient>): Promise<ProfileLite[]> {
  const rows: ProfileLite[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < 100_000; offset += pageSize) {
    const { data, error } = await adminClient
      .from("profiles")
      .select("id, email, full_name, role, organization_id, is_active")
      .order("id")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Profiles listesi alinamadi: ${error.message}`);
    const part = (data || []) as ProfileLite[];
    rows.push(...part);
    if (part.length < pageSize) break;
  }
  return rows;
}

export async function scanProfileIntegrity(): Promise<ProfileIntegrityReport> {
  const adminClient = createSupabaseAdminClient();
  const [authUsers, profiles] = await Promise.all([listAllAuthUsers(adminClient), listAllProfiles(adminClient)]);

  const authById = new Map(authUsers.map((u) => [u.id, u]));
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const missingProfileUserIds = authUsers.filter((u) => !profileById.has(u.id)).map((u) => u.id);
  const orphanProfileUserIds = profiles.filter((p) => !authById.has(p.id)).map((p) => p.id);

  const invalidRoleProfileIds = profiles
    .filter((p) => {
      if (!p.role) return true;
      const normalized = normalizeRawRole(p.role);
      const safe = normalized == null ? null : getSafeRole(normalized);
      return normalized == null || safe == null || safe !== normalized;
    })
    .map((p) => p.id);

  const missingOrganizationProfileIds = profiles
    .filter((p) => {
      const role = getSafeRole(p.role);
      return role !== "super_admin" && !hasValidTenantOrganizationId(role, p.organization_id);
    })
    .map((p) => p.id);

  const superAdminRoleMismatchIds = authUsers
    .filter((u) => {
      const metaRole = getSafeRole(u.user_metadata?.role);
      if (metaRole !== "super_admin") return false;
      const p = profileById.get(u.id);
      return !!p && getSafeRole(p.role) !== "super_admin";
    })
    .map((u) => u.id);

  return {
    authUserCount: authUsers.length,
    profileCount: profiles.length,
    missingProfileCount: missingProfileUserIds.length,
    orphanProfileCount: orphanProfileUserIds.length,
    missingOrganizationCount: missingOrganizationProfileIds.length,
    invalidRoleCount: invalidRoleProfileIds.length,
    superAdminRoleMismatchCount: superAdminRoleMismatchIds.length,
    missingProfileUserIds,
    orphanProfileUserIds,
    invalidRoleProfileIds,
    missingOrganizationProfileIds,
    superAdminRoleMismatchIds,
  };
}

export async function runProfileIntegrityRepair(dryRun: boolean): Promise<ProfileIntegrityRepairResult> {
  const adminClient = createSupabaseAdminClient();
  const [authUsers, profiles] = await Promise.all([listAllAuthUsers(adminClient), listAllProfiles(adminClient)]);

  const authIds = new Set(authUsers.map((u) => u.id));
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const nowIso = new Date().toISOString();

  let createdProfiles = 0;
  let normalizedRoles = 0;
  let filledOrganizationIds = 0;
  let skippedMissingProfiles = 0;
  let deletedOrphanProfiles = 0;

  for (const p of profiles) {
    if (authIds.has(p.id)) continue;
    if (!dryRun) {
      const { error } = await adminClient.from("profiles").delete().eq("id", p.id);
      if (error) throw new Error(`Yetim profil silinemedi (${p.id}): ${error.message}`);
      profileById.delete(p.id);
    }
    deletedOrphanProfiles += 1;
  }

  for (const user of authUsers) {
    if (profileById.has(user.id)) continue;
    const safeRole = getSafeRole(user.user_metadata?.role);
    const orgId = user.user_metadata?.organization_id ?? null;
    const canAutoCreate = safeRole === "super_admin" ? true : hasValidTenantOrganizationId(safeRole, orgId);
    if (!canAutoCreate) {
      skippedMissingProfiles += 1;
      continue;
    }
    if (!dryRun) {
      const { error } = await adminClient.from("profiles").insert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name ?? user.email ?? "User",
        role: safeRole,
        organization_id: safeRole === "super_admin" ? null : orgId,
        is_active: true,
        created_at: nowIso,
      });
      if (error) throw new Error(`Eksik profil olusturulamadi (${user.id}): ${error.message}`);
    }
    createdProfiles += 1;
  }

  for (const p of profiles) {
    const safeRole = getSafeRole(p.role);
    const normalized = normalizeRawRole(p.role);
    if (safeRole != null && (normalized !== safeRole || p.role !== safeRole)) {
      if (!dryRun) {
        const { error } = await adminClient.from("profiles").update({ role: safeRole }).eq("id", p.id);
        if (error) throw new Error(`Rol normalize edilemedi (${p.id}): ${error.message}`);
      }
      normalizedRoles += 1;
    }
  }

  for (const p of profiles) {
    const role = getSafeRole(p.role);
    if (!role || role === "super_admin" || p.organization_id) continue;
    const authUser = authUsers.find((u) => u.id === p.id);
    const metaOrgId = authUser?.user_metadata?.organization_id ?? null;
    if (!metaOrgId || !isUuid(metaOrgId)) continue;
    if (!dryRun) {
      const { error } = await adminClient.from("profiles").update({ organization_id: metaOrgId }).eq("id", p.id);
      if (error) throw new Error(`organization_id doldurulamadi (${p.id}): ${error.message}`);
    }
    filledOrganizationIds += 1;
  }

  const scanned = await scanProfileIntegrity();

  return {
    dryRun,
    scanned,
    createdProfiles,
    normalizedRoles,
    filledOrganizationIds,
    skippedMissingProfiles,
    deletedOrphanProfiles,
  };
}
