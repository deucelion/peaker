"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { getCoachPermissions, hasCoachPermission } from "@/lib/auth/coachPermissions";
import { messageIfCoachCannotOperate } from "@/lib/coach/lifecycle";
import { resolveSessionActor, toTenantProfileRow } from "@/lib/auth/resolveSessionActor";
import type { AthleticResultRow } from "@/types/domain";
import { isUuid } from "@/lib/validation/uuid";
import { isTextMetricValueType, normalizeMetricValueType } from "@/lib/fieldTests/metricValueType";

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

export type MetricValueType = "number" | "text";

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
  const valueTypeRaw = formData.get("valueType")?.toString().trim() || "number";
  const valueType: MetricValueType = normalizeMetricValueType(valueTypeRaw);

  if (name.length < 2) return { error: "Metrik adi en az 2 karakter olmalidir." };
  if (valueType === "number" && unit.length < 1) return { error: "Sayisal metrikte birim zorunludur." };

  let orgShape: TestDefinitionOrgShape = { hasOrganizationId: true, hasOrgId: false };
  try {
    orgShape = await resolveTestDefinitionsOrgShape(resolved.adminClient);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Metrik tablo yapisi okunamadi: ${message}` as const };
  }

  let query = resolved.adminClient
    .from("test_definitions")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);
  if (orgShape.hasOrganizationId && orgShape.hasOrgId) {
    query = query.or(`organization_id.eq.${resolved.organizationId},org_id.eq.${resolved.organizationId}`);
  } else if (orgShape.hasOrganizationId) {
    query = query.eq("organization_id", resolved.organizationId);
  } else if (orgShape.hasOrgId) {
    query = query.eq("org_id", resolved.organizationId);
  }
  const { data: maxSortRows } = await query;
  const nextSort = Number(maxSortRows?.[0]?.sort_order ?? 0) + 1;

  const payload: Record<string, unknown> = {
    name,
    unit: unit || (valueType === "text" ? "not" : ""),
    category,
    value_type: valueType,
    sort_order: nextSort,
  };
  if (orgShape.hasOrganizationId) payload.organization_id = resolved.organizationId;
  if (orgShape.hasOrgId) payload.org_id = resolved.organizationId;
  const { data: inserted, error } = await resolved.adminClient
    .from("test_definitions")
    .insert(payload)
    .select("id, name, unit, category, value_type, sort_order, created_at")
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
    .select("id, name, unit, category, value_type, sort_order, created_at")
    .order("sort_order", { ascending: true, nullsFirst: false })
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

export async function updateFieldTestDefinition(input: {
  testDefinitionId: string;
  name: string;
  unit: string;
  category: string;
  valueType: MetricValueType;
}) {
  const resolved = await resolveFieldTestActor();
  if ("error" in resolved) return { error: resolved.error };
  if (!assertUuid(input.testDefinitionId)) return { error: "Gecersiz metrik." as const };

  let orgShape: TestDefinitionOrgShape = { hasOrganizationId: true, hasOrgId: false };
  try {
    orgShape = await resolveTestDefinitionsOrgShape(resolved.adminClient);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Metrik tablo yapisi okunamadi: ${message}` as const };
  }

  let defQuery = resolved.adminClient.from("test_definitions").select("id").eq("id", input.testDefinitionId);
  if (orgShape.hasOrganizationId && orgShape.hasOrgId) {
    defQuery = defQuery.or(`organization_id.eq.${resolved.organizationId},org_id.eq.${resolved.organizationId}`);
  } else if (orgShape.hasOrganizationId) {
    defQuery = defQuery.eq("organization_id", resolved.organizationId);
  } else if (orgShape.hasOrgId) {
    defQuery = defQuery.eq("org_id", resolved.organizationId);
  }
  const { data: def } = await defQuery.maybeSingle();
  if (!def) return { error: "Metrik bulunamadi veya bu organizasyona ait degil." as const };

  const safeName = input.name.trim().slice(0, 200);
  const safeUnit = input.unit.trim().slice(0, 40);
  const safeCategory = input.category.trim().slice(0, 80) || "Genel";
  if (safeName.length < 2) return { error: "Metrik adi en az 2 karakter olmalidir." as const };
  if (input.valueType === "number" && safeUnit.length < 1) return { error: "Sayisal metrikte birim zorunludur." as const };

  const { error } = await resolved.adminClient
    .from("test_definitions")
    .update({
      name: safeName,
      unit: safeUnit || (input.valueType === "text" ? "not" : ""),
      category: safeCategory,
      value_type: input.valueType,
    })
    .eq("id", input.testDefinitionId);

  if (error) return { error: `Metrik guncellenemedi: ${error.message}` as const };
  revalidatePath("/saha-testleri");
  return { success: true as const };
}

export async function saveFieldTestDefinitionOrder(input: { orderedMetricIds: string[] }) {
  const resolved = await resolveFieldTestActor();
  if ("error" in resolved) return { error: resolved.error };
  if (!Array.isArray(input.orderedMetricIds) || input.orderedMetricIds.length === 0) {
    return { error: "Gecersiz metrik sirasi." as const };
  }
  if (!input.orderedMetricIds.every((id) => assertUuid(id))) {
    return { error: "Gecersiz metrik sirasi." as const };
  }

  const listed = await listFieldTestDefinitionsForActor();
  if ("error" in listed) return { error: listed.error };
  const validIds = new Set((listed.metrics || []).map((r) => String(r.id)));
  if (validIds.size !== input.orderedMetricIds.length) return { error: "Metrik listesi uyusmuyor." as const };
  if (input.orderedMetricIds.some((id) => !validIds.has(id))) return { error: "Metrik listesi uyusmuyor." as const };

  for (let i = 0; i < input.orderedMetricIds.length; i += 1) {
    const metricId = input.orderedMetricIds[i]!;
    const { error: upErr } = await resolved.adminClient
      .from("test_definitions")
      .update({ sort_order: i + 1 })
      .eq("id", metricId);
    if (upErr) return { error: `Metrik sirasi kaydedilemedi: ${upErr.message}` as const };
  }

  revalidatePath("/saha-testleri");
  return { success: true as const };
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
  valueNumber: number | null;
  valueText: string | null;
};

export async function saveAthleticFieldResults(input: {
  testDate: string;
  selectedProfileIds: string[];
  cells: AthleticResultCell[];
  notes?: Array<{ profileId: string; note: string | null }>;
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
  let defsQuery = resolved.adminClient.from("test_definitions").select("id, value_type").in("id", testIds);
  if (orgShape.hasOrganizationId && orgShape.hasOrgId) {
    defsQuery = defsQuery.or(`organization_id.eq.${resolved.organizationId},org_id.eq.${resolved.organizationId}`);
  } else if (orgShape.hasOrganizationId) {
    defsQuery = defsQuery.eq("organization_id", resolved.organizationId);
  } else if (orgShape.hasOrgId) {
    defsQuery = defsQuery.eq("org_id", resolved.organizationId);
  }
  const { data: defs } = await defsQuery;

  const validTestIds = new Set((defs || []).map((d) => d.id));
  const valueTypeByTestId = new Map<string, MetricValueType>(
    (defs || []).map((d) => [String(d.id), normalizeMetricValueType(d.value_type) as MetricValueType])
  );
  for (const tid of testIds) {
    if (!validTestIds.has(tid)) return { error: "Gecersiz veya baska organizasyona ait metrik." };
  }

  const orgId = resolved.organizationId;

  for (const cell of cells) {
    const valueType = valueTypeByTestId.get(cell.testId) || "number";
    const normalizedText = cell.valueText?.trim() || null;
    if (valueType === "number") {
      if (cell.valueNumber === null || Number.isNaN(cell.valueNumber)) {
        const { error: delErr } = await resolved.adminClient
          .from("athletic_results")
          .delete()
          .eq("profile_id", cell.profileId)
          .eq("test_id", cell.testId)
          .eq("test_date", testDate);
        if (delErr) return { error: toUserFriendlyFieldTestWriteError(delErr, "Saha testi kaydı silinemedi.") };
        continue;
      }
      const v = Number(cell.valueNumber);
      if (!Number.isFinite(v)) return { error: "Gecersiz olcum degeri." };
      const { error: upErr } = await resolved.adminClient.from("athletic_results").upsert(
        {
          profile_id: cell.profileId,
          test_id: cell.testId,
          value: v,
          value_text: null,
          test_date: testDate,
          organization_id: orgId,
        },
        { onConflict: "profile_id,test_id,test_date" }
      );
      if (upErr) return { error: toUserFriendlyFieldTestWriteError(upErr, "Saha testi kaydı kaydedilemedi.") };
      continue;
    }

    if (!normalizedText) {
      const { error: delErr } = await resolved.adminClient
        .from("athletic_results")
        .delete()
        .eq("profile_id", cell.profileId)
        .eq("test_id", cell.testId)
        .eq("test_date", testDate);
      if (delErr) return { error: toUserFriendlyFieldTestWriteError(delErr, "Saha testi kaydı silinemedi.") };
    } else {
      const { error: upErr } = await resolved.adminClient.from("athletic_results").upsert(
        {
          profile_id: cell.profileId,
          test_id: cell.testId,
          value: null,
          value_text: normalizedText,
          test_date: testDate,
          organization_id: orgId,
        },
        { onConflict: "profile_id,test_id,test_date" }
      );
      if (upErr) return { error: toUserFriendlyFieldTestWriteError(upErr, "Saha testi kaydı kaydedilemedi.") };
    }
  }

  const notes = (input.notes || []).filter((n) => assertUuid(n.profileId) && selectedSet.has(n.profileId));
  for (const noteRow of notes) {
    const note = noteRow.note?.trim() || null;
    if (!note) {
      const { error: delErr } = await resolved.adminClient
        .from("athletic_result_notes")
        .delete()
        .eq("organization_id", orgId)
        .eq("profile_id", noteRow.profileId)
        .eq("test_date", testDate);
      if (delErr) return { error: `Genel not silinemedi: ${delErr.message}` as const };
      continue;
    }
    const { error: upErr } = await resolved.adminClient.from("athletic_result_notes").upsert(
      {
        organization_id: orgId,
        profile_id: noteRow.profileId,
        test_date: testDate,
        note,
      },
      { onConflict: "profile_id,test_date" }
    );
    if (upErr) return { error: `Genel not kaydedilemedi: ${upErr.message}` as const };
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

export type AthleticResultNoteRow = {
  profile_id: string;
  test_date: string;
  note: string | null;
};

export async function listAthleticResultNotesByDate(input: { profileIds: string[]; testDate: string }) {
  const resolved = await resolveFieldTestActor();
  if ("error" in resolved) return { error: resolved.error };

  const testDate = input.testDate?.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(testDate)) return { error: "Gecersiz test tarihi." as const };
  const ids = input.profileIds.filter(assertUuid);
  if (ids.length === 0) return { notes: [] as AthleticResultNoteRow[] };

  const { data, error } = await resolved.adminClient
    .from("athletic_result_notes")
    .select("profile_id, test_date, note")
    .eq("organization_id", resolved.organizationId)
    .eq("test_date", testDate)
    .in("profile_id", ids);

  if (error) return { error: `Genel notlar alinamadi: ${error.message}` as const };
  return { notes: (data || []) as AthleticResultNoteRow[] };
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
      value_text,
      profiles!inner (full_name, organization_id),
      test_definitions (name, unit, value_type)
    `
    )
    .eq("profiles.organization_id", orgId);

  if (error) {
    return { error: `Rapor verisi alinamadi: ${error.message}` as const };
  }

  type Joined = {
    value: number | string | null;
    value_text?: string | null;
    profiles?: { full_name?: string | null; organization_id?: string | null } | null;
    test_definitions?: { name?: string | null; unit?: string | null; value_type?: string | null } | null;
  };

  const chartRows: FieldTestTeamChartRow[] = ((data || []) as Joined[])
    .filter((item) => !isTextMetricValueType(item.test_definitions?.value_type))
    .map((item) => ({
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
