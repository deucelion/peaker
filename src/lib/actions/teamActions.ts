"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { getCoachPermissions } from "@/lib/auth/coachPermissions";
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
    const gate = await assertCanManageTeams(actor.actorUserId, actor.role, actor.organizationId);
    if (!gate.ok) return { error: gate.error };

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

async function assertCanManageTeams(actorUserId: string, role: ManagementRole, organizationId: string) {
  if (role === "admin") return { ok: true as const };
  const perms = await getCoachPermissions(actorUserId, organizationId);
  if (!perms.can_manage_teams) {
    return { ok: false as const, error: "Takim yonetimi yetkiniz yok." };
  }
  return { ok: true as const };
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

    const manageGate = await assertCanManageTeams(actor.actorUserId, actor.role, actor.organizationId);
    const { data: allAthletesRows, error: allAthletesErr } = await adminClient
      .from("profiles")
      .select("id, full_name, email, role, team")
      .eq("organization_id", actor.organizationId)
      .eq("role", "sporcu")
      .order("full_name");
    if (allAthletesErr) return { error: `Sporcu havuzu alinamadi: ${allAthletesErr.message}` };
    const availableAthletes = (allAthletesRows || [])
      .filter((row) => (row.team || "").trim() !== team.name)
      .map((row) => ({
        id: row.id as string,
        fullName: toDisplayName(row.full_name as string | null, row.email as string | null, "Sporcu"),
      }));

    return {
      team: {
        id: team.id as string,
        name: team.name as string,
      },
      athletes: rows,
      availableAthletes,
      canManageTeamMembers: manageGate.ok,
      summary: {
        total,
        activeCount,
        inactiveCount,
        positionSummary,
      },
    };
  });
}

export async function assignAthleteToTeam(teamId: string, athleteId: string) {
  return withServerActionGuard("team.assignAthleteToTeam", async () => {
    const actor = await resolveTeamActor();
    if ("error" in actor) return { error: actor.error };
    const gate = await assertCanManageTeams(actor.actorUserId, actor.role, actor.organizationId);
    if (!gate.ok) return { error: gate.error };

    const id = teamId.trim();
    const athlete = athleteId.trim();
    if (!id || !athlete) return { error: "Takim ve sporcu secimi zorunludur." };

    const adminClient = createSupabaseAdminClient();
    const { data: team } = await adminClient
      .from("teams")
      .select("id, name")
      .eq("id", id)
      .eq("organization_id", actor.organizationId)
      .maybeSingle();
    if (!team) return { error: "Takim bulunamadi." };

    const { data: athleteRow } = await adminClient
      .from("profiles")
      .select("id, role, organization_id")
      .eq("id", athlete)
      .eq("organization_id", actor.organizationId)
      .maybeSingle();
    if (!athleteRow || getSafeRole(athleteRow.role) !== "sporcu") {
      return { error: "Sporcu bulunamadi." };
    }

    const { error } = await adminClient
      .from("profiles")
      .update({ team: team.name })
      .eq("id", athlete)
      .eq("organization_id", actor.organizationId);
    if (error) return { error: `Sporcu takima eklenemedi: ${error.message}` };

    revalidatePath(`/takimlar/${id}`);
    revalidatePath("/takimlar");
    revalidatePath("/oyuncular");
    revalidatePath(`/sporcu/${athlete}`);
    return { success: true as const };
  });
}

export async function removeAthleteFromTeam(teamId: string, athleteId: string) {
  return withServerActionGuard("team.removeAthleteFromTeam", async () => {
    const actor = await resolveTeamActor();
    if ("error" in actor) return { error: actor.error };
    const gate = await assertCanManageTeams(actor.actorUserId, actor.role, actor.organizationId);
    if (!gate.ok) return { error: gate.error };

    const id = teamId.trim();
    const athlete = athleteId.trim();
    if (!id || !athlete) return { error: "Takim ve sporcu secimi zorunludur." };

    const adminClient = createSupabaseAdminClient();
    const { data: team } = await adminClient
      .from("teams")
      .select("id, name")
      .eq("id", id)
      .eq("organization_id", actor.organizationId)
      .maybeSingle();
    if (!team) return { error: "Takim bulunamadi." };

    const { data: athleteRow } = await adminClient
      .from("profiles")
      .select("id, role, organization_id, team")
      .eq("id", athlete)
      .eq("organization_id", actor.organizationId)
      .maybeSingle();
    if (!athleteRow || getSafeRole(athleteRow.role) !== "sporcu") {
      return { error: "Sporcu bulunamadi." };
    }
    if ((athleteRow.team || "").trim() !== team.name) {
      return { error: "Sporcu bu takimda degil." };
    }

    const { error } = await adminClient
      .from("profiles")
      .update({ team: null })
      .eq("id", athlete)
      .eq("organization_id", actor.organizationId);
    if (error) return { error: `Sporcu takimdan cikarilamadi: ${error.message}` };

    revalidatePath(`/takimlar/${id}`);
    revalidatePath("/takimlar");
    revalidatePath("/oyuncular");
    revalidatePath(`/sporcu/${athlete}`);
    return { success: true as const };
  });
}
