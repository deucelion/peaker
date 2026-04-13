"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { messageIfAthleteCannotOperate } from "@/lib/athlete/lifecycle";
import { resolveSessionActor, toTenantProfileRow } from "@/lib/auth/resolveSessionActor";

export type CalendarTrainingSchedule = {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  location: string | null;
  capacity: number | null;
  status: string | null;
};

export type AthleteCalendarRow = {
  training_id: string;
  training_schedule: CalendarTrainingSchedule | null;
};

export async function listAthleteCalendarTrainings(): Promise<
  | { allowed: true; trainings: AthleteCalendarRow[] }
  | { allowed: false; trainings: [] }
  | { error: string }
> {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
  if ("error" in resolved) return { error: resolved.error };
  const actor = toTenantProfileRow(resolved.actor);
  if (!actor.organization_id) return { error: "Profil dogrulanamadi." };
  if (getSafeRole(actor.role) !== "sporcu") return { error: "Bu sayfa yalnizca sporcular icindir." };
  const block = messageIfAthleteCannotOperate(actor.role, actor.is_active);
  if (block) return { error: block };

  const adminClient = createSupabaseAdminClient();
  const { data: permissionRow } = await adminClient
    .from("athlete_permissions")
    .select("can_view_calendar")
    .eq("athlete_id", actor.id)
    .maybeSingle();

  const allowed = permissionRow?.can_view_calendar ?? true;
  if (!allowed) return { allowed: false as const, trainings: [] };

  const { data: rows, error } = await adminClient
    .from("training_participants")
    .select(
      `
      training_id,
      training_schedule (
        id,
        organization_id,
        title,
        description,
        start_time,
        end_time,
        location,
        capacity,
        status
      )
    `
    )
    .eq("profile_id", actor.id);

  if (error) return { error: `Takvim verisi alinamadi: ${error.message}` };

  const orgId = actor.organization_id;
  const raw = (rows || []) as Array<{
    training_id: string;
    training_schedule:
      | CalendarTrainingSchedule
      | CalendarTrainingSchedule[]
      | null;
  }>;

  const trainings: AthleteCalendarRow[] = raw.flatMap((item) => {
    const sch = item.training_schedule;
    const t = Array.isArray(sch) ? sch[0] : sch;
    if (!t || t.organization_id !== orgId) return [];
    return [
      {
        training_id: item.training_id,
        training_schedule: {
          id: t.id,
          organization_id: t.organization_id,
          title: t.title,
          description: t.description ?? null,
          start_time: t.start_time,
          end_time: t.end_time ?? null,
          location: t.location ?? null,
          capacity: t.capacity ?? null,
          status: t.status ?? null,
        },
      },
    ];
  });

  trainings.sort((a, b) => {
    const sa = a.training_schedule?.start_time ?? "";
    const sb = b.training_schedule?.start_time ?? "";
    return sb.localeCompare(sa);
  });

  return { allowed: true as const, trainings };
}
