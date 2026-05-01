import { NextResponse } from "next/server";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getCoachPermissions } from "@/lib/auth/coachPermissions";
import { normalizeAthletePermissions } from "@/lib/auth/athletePermissions";
import type { AthletePermissionKey, CoachPermissionKey } from "@/lib/types";

export async function GET() {
  const resolved = await resolveSessionActor();
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 401 });
  }

  const { actor } = resolved;
  const role = actor.role;
  const orgId = actor.organizationId;
  const adminClient = createSupabaseAdminClient();

  if (role === "coach" && orgId) {
    const coachPermissions = await getCoachPermissions(actor.id, orgId);
    return NextResponse.json({
      role,
      coachPermissions,
      athletePermissions: null,
    });
  }

  if (role === "sporcu" && orgId) {
    const { data } = await adminClient
      .from("athlete_permissions")
      .select(
        "can_view_morning_report, can_view_programs, can_view_calendar, can_view_notifications, can_view_rpe_entry, can_view_development_profile, can_view_financial_status, can_view_performance_metrics, can_view_wellness_metrics, can_view_skill_radar"
      )
      .eq("athlete_id", actor.id)
      .eq("organization_id", orgId)
      .maybeSingle();

    return NextResponse.json({
      role,
      coachPermissions: null,
      athletePermissions: normalizeAthletePermissions(
        (data as Partial<Record<AthletePermissionKey, boolean>> | null) || undefined
      ),
    });
  }

  return NextResponse.json({
    role,
    coachPermissions: null as Partial<Record<CoachPermissionKey, boolean>> | null,
    athletePermissions: null as Partial<Record<AthletePermissionKey, boolean>> | null,
  });
}

