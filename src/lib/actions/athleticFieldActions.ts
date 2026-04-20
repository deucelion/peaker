"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { getCoachPermissions, hasCoachPermission } from "@/lib/auth/coachPermissions";
import { messageIfCoachCannotOperate } from "@/lib/coach/lifecycle";
import { resolveSessionActor, toTenantProfileRow } from "@/lib/auth/resolveSessionActor";
import type { AthleticResultRow } from "@/types/domain";
import { isUuid } from "@/lib/validation/uuid";

function assertUuid(id: string | null | undefined): id is string {
  return isUuid(id);
}

function toUserFriendlyFieldTestWriteError(
  err: { message?: string | null; code?: string | null } | null | undefined,
  fallback: string
) {
  const code = (err?.code || "").toLowerCase();
  const msg = (err?.message || "").toLowerCase();

  if (code === "42p10" || msg.includes("no unique or exclusion constraint")) {
    return "Saha testi kayıt altyapısı eksik görünüyor. Lütfen tekrar deneyin veya yöneticinize bilgi verin.";
  }
  if (code === "23505" || msg.includes("duplicate key")) {
    return "Aynı sporcu, metrik ve tarih için yalnızca tek kayıt tutulabilir.";
  }
  return fallback;
}

type TestDefinitionOrgShape = {
  hasOrganizationId: boolean;
  hasOrgId: boolean;
};

async function resolveTestDefinitionsOrgShape(
  adminClient: ReturnType<typeof createSupabaseAdminClient>
): Promise<TestDefinitionOrgShape> {
  const orgProbe = await adminClient.from("test_definitions").select("id, organization_id").limit(1);
  const legacyProbe = await adminClient.from("test_definitions").select("id, org_id").limit(1);

  const hasOrganizationId = !orgProbe.error;
  const hasOrgId = !legacyProbe.error;

  if (hasOrganizationId || hasOrgId) {
    return { hasOrganizationId, hasOrgId };
  }

  // Legacy DB: test_definitions tablosunda organizasyon kolonu yok (global metrikler)
  const starProbe = await adminClient.from("test_definitions").select("id,name,unit,category,created_at").limit(1);
  if (!starProbe.error) return { hasOrganizationId: false, hasOrgId: false };

  throw new Error(
    orgProbe.error?.message || legacyProbe.error?.message || starProbe.error?.message || "test_definitions org kolon tespiti basarisiz"
  );
}

async function resolveFieldTestActor() {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
  if ("error" in resolved) return { error: resolved.error };
  const actor = toTenantProfileRow(resolved.actor);
  if (!actor.organization_id) return { error: "Kullanici profili dogrulanamadi." as const };

  const coachBlock = messageIfCoachCannotOperate(actor.role, actor.is_active);
  if (coachBlock) return { error: coachBlock };

  const role = getSafeRole(actor.role);
  if (role !== "admin" && role !== "coach") {
    return { error: "Saha testi yonetimi yalnizca yonetici veya koç icindir." as const };
  }

  if (role === "coach") {
    const perms = await getCoachPermissions(actor.id, actor.organization_id);
    if (!hasCoachPermission(perms, "can_view_reports")) {
      return { error: "Saha testleri icin rapor goruntuleme yetkiniz yok." as const };
    }
  }

  return { actorId: actor.id, organizationId: actor.organization_id, role, adminClient: createSupabaseAdminClient() };
}

export async function createFieldTestDefinition(formData: FormData) {
  const resolved = await resolveFieldTestActor();
  if ("error" in resolved) return { error: resolved.error };

  const name = formData.get("name")?.toString().trim().slice(0, 200) || "";
  const unit = formData.get("unit")?.toString().trim().slice(0, 40) || "";
  const category = formData.get("category")?.toString().trim().slice(0, 80) || "Genel";

  if (name.length < 2) return { error: "Metrik adi en az 2 karakter olmalidir." };
  if (unit.length < 1) return { error: "Birim zorunludur." };

  let orgShape: TestDefinitionOrgShape = { hasOrganizationId: true, hasOrgId: false };
  try {
    orgShape = await resolveTestDefinitionsOrgShape(resolved.adminClient);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Metrik tablo yapisi okunamadi: ${message}` as const };
  }

  const payload: Record<string, unknown> = { name, unit, category };
  if (orgShape.hasOrganizationId) payload.organization_id = resolved.organizationId;
  if (orgShape.hasOrgId) payload.org_id = resolved.organizationId;
  const { data: inserted, error } = await resolved.adminClient
    .from("test_definitions")
    .insert(payload)
    .select("id, name, unit, category, created_at")
    .single();

  if (error) return { error: `Metrik eklenemedi: ${error.message}` };

  revalidatePath("/saha-testleri");
  return { success: true as const, metric: inserted };
}

export async function listFieldTestDefinitionsForActor() {
  const resolved = await resolveFieldTestActor();
  if ("error" in resolved) return { error: resolved.error };

  let orgShape: TestDefinitionOrgShape = { hasOrganizationId: true, hasOrgId: false };
  try {
    orgShape = await resolveTestDefinitionsOrgShape(resolved.adminClient);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Metrik tablo yapisi okunamadi: ${message}` as const };
  }

  let query = resolved.adminClient
    .from("test_definitions")
    .select("id, name, unit, category, created_at")
    .order("created_at", { ascending: false });

  if (orgShape.hasOrganizationId && orgShape.hasOrgId) {
    query = query.or(`organization_id.eq.${resolved.organizationId},org_id.eq.${resolved.organizationId}`);
  } else if (orgShape.hasOrganizationId) {
    query = query.eq("organization_id", resolved.organizationId);
  } else if (orgShape.hasOrgId) {
    query = query.eq("org_id", resolved.organizationId);
  }

  const { data, error } = await query;

  if (error) return { error: `Metrikler alinamadi: ${error.message}` as const };
  return { metrics: (data || []) as Array<Record<string, unknown>> };
}

export async function deleteFieldTestDefinition(testDefinitionId: string) {
  const resolved = await resolveFieldTestActor();
  if ("error" in resolved) return { error: resolved.error };

  if (!assertUuid(testDefinitionId)) return { error: "Gecersiz metrik." };

  let orgShape: TestDefinitionOrgShape = { hasOrganizationId: true, hasOrgId: false };
  try {
    orgShape = await resolveTestDefinitionsOrgShape(resolved.adminClient);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Metrik tablo yapisi okunamadi: ${message}` as const };
  }

  let defQuery = resolved.adminClient.from("test_definitions").select("id").eq("id", testDefinitionId);
  if (orgShape.hasOrganizationId && orgShape.hasOrgId) {
    defQuery = defQuery.or(`organization_id.eq.${resolved.organizationId},org_id.eq.${resolved.organizationId}`);
  } else if (orgShape.hasOrganizationId) {
    defQuery = defQuery.eq("organization_id", resolved.organizationId);
  } else if (orgShape.hasOrgId) {
    defQuery = defQuery.eq("org_id", resolved.organizationId);
  }
  const { data: def } = await defQuery.maybeSingle();

  if (!def) return { error: "Metrik bulunamadi veya bu organizasyona ait degil." };

  const { error } = await resolved.adminClient.from("test_definitions").delete().eq("id", testDefinitionId);

  if (error) return { error: `Silinemedi: ${error.message}` };

  revalidatePath("/saha-testleri");
  revalidatePath("/saha-testleri/genel-rapor");
  return { success: true as const };
}

export type AthleticResultCell = {
  profileId: string;
  testId: string;
  value: number | null;
};

export async function saveAthleticFieldResults(input: {
  testDate: string;
  selectedProfileIds: string[];
  cells: AthleticResultCell[];
}) {
  const resolved = await resolveFieldTestActor();
  if ("error" in resolved) return { error: resolved.error };

  const testDate = input.testDate?.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(testDate)) return { error: "Gecersiz test tarihi." };

  const selected = input.selectedProfileIds.filter(assertUuid);
  if (selected.length === 0) return { error: "En az bir sporcu secilmelidir." };

  const selectedSet = new Set(selected);

  const { data: athletes } = await resolved.adminClient
    .from("profiles")
    .select("id")
    .eq("organization_id", resolved.organizationId)
    .eq("role", "sporcu")
    .in("id", selected);

  const validAthleteIds = new Set((athletes || []).map((a) => a.id));
  for (const id of selected) {
    if (!validAthleteIds.has(id)) return { error: "Secilen sporculardan biri bu organizasyonda degil." };
  }

  const cells = input.cells.filter((c) => assertUuid(c.profileId) && assertUuid(c.testId) && selectedSet.has(c.profileId));
  if (cells.length === 0) return { error: "Kaydedilecek hucre yok." };

  const testIds = Array.from(new Set(cells.map((c) => c.testId)));
  let orgShape: TestDefinitionOrgShape = { hasOrganizationId: true, hasOrgId: false };
  try {
    orgShape = await resolveTestDefinitionsOrgShape(resolved.adminClient);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Metrik tablo yapisi okunamadi: ${message}` as const };
  }
  let defsQuery = resolved.adminClient.from("test_definitions").select("id").in("id", testIds);
  if (orgShape.hasOrganizationId && orgShape.hasOrgId) {
    defsQuery = defsQuery.or(`organization_id.eq.${resolved.organizationId},org_id.eq.${resolved.organizationId}`);
  } else if (orgShape.hasOrganizationId) {
    defsQuery = defsQuery.eq("organization_id", resolved.organizationId);
  } else if (orgShape.hasOrgId) {
    defsQuery = defsQuery.eq("org_id", resolved.organizationId);
  }
  const { data: defs } = await defsQuery;

  const validTestIds = new Set((defs || []).map((d) => d.id));
  for (const tid of testIds) {
    if (!validTestIds.has(tid)) return { error: "Gecersiz veya baska organizasyona ait metrik." };
  }

  const orgId = resolved.organizationId;

  for (const cell of cells) {
    if (cell.value === null || Number.isNaN(cell.value)) {
      const { error: delErr } = await resolved.adminClient
        .from("athletic_results")
        .delete()
        .eq("profile_id", cell.profileId)
        .eq("test_id", cell.testId)
        .eq("test_date", testDate);
      if (delErr) return { error: toUserFriendlyFieldTestWriteError(delErr, "Saha testi kaydı silinemedi.") };
    } else {
      const v = Number(cell.value);
      if (!Number.isFinite(v)) return { error: "Gecersiz olcum degeri." };
      const { error: upErr } = await resolved.adminClient.from("athletic_results").upsert(
        {
          profile_id: cell.profileId,
          test_id: cell.testId,
          value: v,
          test_date: testDate,
          organization_id: orgId,
        },
        { onConflict: "profile_id,test_id,test_date" }
      );
      if (upErr) return { error: toUserFriendlyFieldTestWriteError(upErr, "Saha testi kaydı kaydedilemedi.") };
    }
  }

  revalidatePath("/saha-testleri");
  revalidatePath("/saha-testleri/genel-rapor");
  revalidatePath("/sporcu");
  return { success: true as const };
}

/** Saha testleri tablosu: seçili gün için org içi sporcu sonuçları (RLS yerine admin + tenant doğrulama). */
export async function listAthleticResultsForActorByDate(input: {
  profileIds: string[];
  testDate: string;
}) {
  const resolved = await resolveFieldTestActor();
  if ("error" in resolved) return { error: resolved.error };

  const testDate = input.testDate?.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(testDate)) {
    return { error: "Gecersiz test tarihi." as const };
  }

  const ids = input.profileIds.filter(assertUuid);
  if (ids.length === 0) {
    return { results: [] as AthleticResultRow[] };
  }

  const { data: athletes } = await resolved.adminClient
    .from("profiles")
    .select("id")
    .eq("organization_id", resolved.organizationId)
    .eq("role", "sporcu")
    .in("id", ids);

  const allowed = new Set((athletes || []).map((a) => a.id));
  const filteredIds = ids.filter((id) => allowed.has(id));
  if (filteredIds.length === 0) {
    return { results: [] as AthleticResultRow[] };
  }

  const { data, error } = await resolved.adminClient
    .from("athletic_results")
    .select("*")
    .in("profile_id", filteredIds)
    .eq("test_date", testDate);

  if (error) {
    return { error: `Sonuclar alinamadi: ${error.message}` as const };
  }

  return { results: (data || []) as AthleticResultRow[] };
}

export type FieldTestTeamChartRow = {
  name: string;
  deger: number;
  test: string;
  unit: string;
};

/** Genel rapor: kadro sayısı + tüm saha sonuçları (org içi, admin/koç + can_view_reports). */
export async function loadFieldTestTeamReportForActor() {
  const resolved = await resolveFieldTestActor();
  if ("error" in resolved) return { error: resolved.error };

  const orgId = resolved.organizationId;
  const admin = resolved.adminClient;

  const { count, error: countErr } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("role", "sporcu");

  if (countErr) {
    return { error: `Kadro sayisi alinamadi: ${countErr.message}` as const };
  }

  const { data, error } = await admin
    .from("athletic_results")
    .select(
      `
      value,
      profiles!inner (full_name, organization_id),
      test_definitions (name, unit)
    `
    )
    .eq("profiles.organization_id", orgId);

  if (error) {
    return { error: `Rapor verisi alinamadi: ${error.message}` as const };
  }

  type Joined = {
    value: number | string;
    profiles?: { full_name?: string | null; organization_id?: string | null } | null;
    test_definitions?: { name?: string | null; unit?: string | null } | null;
  };

  const chartRows: FieldTestTeamChartRow[] = ((data || []) as Joined[]).map((item) => ({
    name: item.profiles?.full_name?.split(" ")[0] || "Sporcu",
    deger: Number(item.value) || 0,
    test: item.test_definitions?.name || "Bilinmeyen Test",
    unit: item.test_definitions?.unit || "",
  }));

  return {
    totalPlayers: count ?? 0,
    chartRows,
  };
}
