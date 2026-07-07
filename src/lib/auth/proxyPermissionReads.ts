import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  denyAllAthletePermissions,
  normalizeAthletePermissions,
} from "@/lib/auth/athletePermissions";
import {
  denyAllCoachPermissions,
  normalizeCoachPermissions,
} from "@/lib/auth/coachPermissions";
import { ATHLETE_PERMISSION_KEYS, COACH_PERMISSION_KEYS } from "@/lib/types";
import type { AthletePermissions, CoachPermissions } from "@/lib/types";

let cachedAdmin: SupabaseClient | null | undefined;

function proxyAdminClient(): SupabaseClient | null {
  if (cachedAdmin !== undefined) return cachedAdmin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    cachedAdmin = null;
    return null;
  }
  cachedAdmin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedAdmin;
}

/**
 * Proxy RBAC must match `/api/me-access`: permission rows are read with service role
 * after session identity is established. Anon/RLS reads fail-closed and caused nav
 * links to bounce back to the athlete home route.
 */
export async function loadAthletePermissionsForProxy(
  athleteId: string,
  organizationId: string | null
): Promise<AthletePermissions> {
  if (!organizationId) return normalizeAthletePermissions();
  const admin = proxyAdminClient();
  if (!admin) return denyAllAthletePermissions();

  try {
    const { data, error } = await admin
      .from("athlete_permissions")
      .select(ATHLETE_PERMISSION_KEYS.join(","))
      .eq("athlete_id", athleteId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) return denyAllAthletePermissions();
    return normalizeAthletePermissions(
      (data as Partial<Record<(typeof ATHLETE_PERMISSION_KEYS)[number], boolean>> | null) || undefined
    );
  } catch {
    return denyAllAthletePermissions();
  }
}

export async function loadCoachPermissionsForProxy(
  coachId: string,
  organizationId: string | null
): Promise<CoachPermissions> {
  if (!organizationId) return normalizeCoachPermissions();
  const admin = proxyAdminClient();
  if (!admin) return denyAllCoachPermissions();

  try {
    const { data, error } = await admin
      .from("coach_permissions")
      .select(COACH_PERMISSION_KEYS.join(","))
      .eq("coach_id", coachId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) return denyAllCoachPermissions();
    return normalizeCoachPermissions(
      (data as Partial<Record<(typeof COACH_PERMISSION_KEYS)[number], boolean>> | null) || undefined
    );
  } catch {
    return denyAllCoachPermissions();
  }
}

/** @internal test hook */
export function resetProxyAdminClientCacheForTests() {
  cachedAdmin = undefined;
}
