"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { messageIfCoachCannotOperate } from "@/lib/coach/lifecycle";
import { toDisplayName } from "@/lib/profile/displayName";
import { withServerActionGuard } from "@/lib/observability/serverActionError";

type ManagementRole = "admin" | "coach";

async function resolveTeamActor(): Promise<
  | { role: ManagementRole; actorUserId: string; organizationId: string }
  | { error: string }
> {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
  if ("error" in resolved) return { error: resolved.error };
  const actor = resolved.actor;
  if (actor.role !== "admin" && actor.role !== "coach") {
    return { error: "Bu islem icin yetkiniz yok." };
  }
  const coachBlock = messageIfCoachCannotOperate(actor.role, actor.isActive ?? true);
  if (coachBlock) return { error: coachBlock };
  return {
    role: getSafeRole(actor.role) as ManagementRole,
    actorUserId: actor.id,
    organizationId: actor.organizationId!,
  };
}

export async function listTeamsForActor() {
  return withServerActionGuard("team.listTeamsForActor", async () => {
    const actor = await resolveTeamActor();
    if ("error" in actor) return { error: actor.error };

    const adminClient = createSupabaseAdminClient();
    const { data, error } = await adminClient
      .from("teams")
      .select("id, name, organization_id, created_at")
      .eq("organization_id", actor.organizationId)
      .order("name", { ascending: true });
    if (error) return { error: `Takimlar alinamadi: ${error.message}` };
    return { teams: data ?? [] };
  });
}

export async function createTeamAction(formData: FormData) {
  return withServerActionGuard("team.createTeamAction", async () => {
    const actor = await resolveTeamActor();
    if ("error" in actor) return { error: actor.error };

    const name = formData.get("name")?.toString().trim() || "";
    if (!name) return { error: "Takim adi zorunludur." };
    if (name.length < 2 || name.length > 60) {
      return { error: "Takim adi 2-60 karakter araliginda olmalidir." };
    }

    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient.from("teams").insert({
      organization_id: actor.organizationId,
      name,
      created_by: actor.actorUserId,
    });
    if (error) {
      if (error.message.toLowerCase().includes("duplicate") || error.code === "23505") {
        return { error: "Bu takim adi zaten mevcut." };
      }
      return { error: `Takim olusturulamadi: ${error.message}` };
    }

    revalidatePath("/takimlar");
    revalidatePath("/oyuncular");
    return { success: true as const };
  });
}

export async function loadTeamDetail(teamId: string) {
  return withServerActionGuard("team.loadTeamDetail", async () => {
    const actor = await resolveTeamActor();
    if ("error" in actor) return { error: actor.error };
    const id = teamId?.trim() || "";
    if (!id) return { error: "Takim kimligi zorunludur." };

    const adminClient = createSupabaseAdminClient();
    const { data: team, error: teamError } = await adminClient
      .from("teams")
      .select("id, name, organization_id, created_at")
      .eq("id", id)
      .eq("organization_id", actor.organizationId)
      .maybeSingle();
    if (teamError || !team) return { error: "Takim bulunamadi." };

    const { data: athletes, error: athletesError } = await adminClient
      .from("profiles")
      .select("id, full_name, email, number, position, is_active, team")
      .eq("organization_id", actor.organizationId)
      .eq("role", "sporcu")
      .eq("team", team.name)
      .order("full_name");
    if (athletesError) return { error: `Takim sporculari alinamadi: ${athletesError.message}` };

    const rows = (athletes ?? []).map((row) => ({
      id: row.id as string,
      fullName: toDisplayName(row.full_name as string | null, row.email as string | null, "Sporcu"),
      number: (row.number as string | null) || "-",
      position: (row.position as string | null) || "-",
      isActive: row.is_active !== false,
    }));
    const total = rows.length;
    const activeCount = rows.filter((r) => r.isActive).length;
    const inactiveCount = total - activeCount;
    const positionSummary = rows.reduce<Record<string, number>>((acc, row) => {
      const key = row.position || "-";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return {
      team: {
        id: team.id as string,
        name: team.name as string,
      },
      athletes: rows,
      summary: {
        total,
        activeCount,
        inactiveCount,
        positionSummary,
      },
    };
  });
}
