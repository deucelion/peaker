"use server";


import { withServerActionGuard } from "@/lib/observability/serverActionError";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { getCoachPermissions, hasCoachPermission } from "@/lib/auth/coachPermissions";
import { messageIfCoachCannotOperate } from "@/lib/coach/lifecycle";
import { resolveSessionActor, toTenantProfileRow } from "@/lib/auth/resolveSessionActor";
import type { AthleticResultRow } from "@/types/domain";
import { isUuid } from "@/lib/validation/uuid";
import { isTextMetricValueType, normalizeMetricValueType } from "@/lib/fieldTests/metricValueType";
import { toDisplayName } from "@/lib/profile/displayName";
import { csvFilename } from "@/lib/export/csv";
import { buildCsvFromRows } from "@/lib/export/csvStream";
import { logger } from "@/lib/monitoring";
import { chunkedInQuery } from "@/lib/db/chunkedIn";
import {
  planFieldTestCellWrites,
  type FieldTestCellWriteSource,
} from "@/lib/fieldTests/fieldTestCellWriteGuard";
import { shouldFailFieldTestSaveWithNoAppliedWrites, shouldFailFieldTestSaveWithStaleSkipsOnline } from "@/lib/fieldTests/fieldTestSaveIntegrity";
import {
  buildAthleticResultUpsertRow,
  resolveAthleticResultsWriteShape,
} from "@/lib/fieldTests/athleticResultsWriteShape";
import {
  FIELDTEST_DIAG_SCHEMA,
  FIELDTEST_DIAG_VALIDATION,
  fieldTestSaveFailure,
  type FieldTestSaveFailure,
} from "@/lib/fieldTests/fieldTestSaveErrors";
import { fieldTestUserFacingText } from "@/lib/fieldTests/fieldTestEditSeqMetadata";
import { assertExportFeatureForOrg } from "@/lib/auth/exportFeatureAccess";
import { EXPORT_ENDPOINT_IDS } from "@/lib/organization/features/surfaces/exportEntitlementMap";
import { paginatePostgrestSelect } from "@/lib/db/paginatePostgrestRange";

function assertUuid(id: string | null | undefined): id is string {
  return isUuid(id);
}

type TestDefinitionOrgShape = {
  hasOrganizationId: boolean;
  hasOrgId: boolean;
};

export type MetricValueType = "number" | "text";
export type MetricImprovementDirection = "higher_better" | "lower_better" | "unknown";

function normalizeImprovementDirection(raw: unknown): MetricImprovementDirection {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "higher_better" || s === "lower_better" || s === "unknown") return s;
  return "unknown";
}

/**
 * test_definitions.improvement_direction kolonu eski kurulumlarda olmayabilir.
 * Yazma sırasında 42703/column-not-exist hatası olursa kolon tek seferde
 * düşürülür ve insert/update fallback olarak yeniden denenir.
 */
function dropDirectionFieldIfSchemaMissing(
  payload: Record<string, unknown>,
  err: { message?: string | null; code?: string | null } | null | undefined
): boolean {
  const code = (err?.code || "").toLowerCase();
  const msg = (err?.message || "").toLowerCase();
  if (code === "42703" || msg.includes("improvement_direction") || msg.includes("does not exist")) {
    if ("improvement_direction" in payload) {
      delete payload.improvement_direction;
      return true;
    }
  }
  return false;
}

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

/** Saha testi PDF basligi icin org gorunen adi (sol ust). */
export async function getFieldTestOrganizationDisplayName() {
  return withServerActionGuard("fieldTest.getFieldTestOrganizationDisplayName", async () => {
  const resolved = await resolveFieldTestActor();
  if ("error" in resolved) return { error: resolved.error };

  const { data, error } = await resolved.adminClient
    .from("organizations")
    .select("name")
    .eq("id", resolved.organizationId)
    .maybeSingle();

  if (error) return { error: `Organizasyon adi alinamadi: ${error.message}` as const };

  const trimmed = data?.name?.trim();
  return { orgName: trimmed && trimmed.length >= 2 ? trimmed : "PEAKER" };
  });
}

export async function createFieldTestDefinition(formData: FormData) {
  return withServerActionGuard("fieldTest.createFieldTestDefinition", async () => {
  const resolved = await resolveFieldTestActor();
  if ("error" in resolved) return { error: resolved.error };

  const name = formData.get("name")?.toString().trim().slice(0, 200) || "";
  const unit = formData.get("unit")?.toString().trim().slice(0, 40) || "";
  const category = formData.get("category")?.toString().trim().slice(0, 80) || "Genel";
  const valueTypeRaw = formData.get("valueType")?.toString().trim() || "number";
  const valueType: MetricValueType = normalizeMetricValueType(valueTypeRaw);
  const improvementDirectionRaw = formData.get("improvementDirection")?.toString();
  const improvementDirection: MetricImprovementDirection =
    valueType === "number" ? normalizeImprovementDirection(improvementDirectionRaw) : "unknown";

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
    improvement_direction: improvementDirection,
  };
  if (orgShape.hasOrganizationId) payload.organization_id = resolved.organizationId;
  if (orgShape.hasOrgId) payload.org_id = resolved.organizationId;
  let inserted: Record<string, unknown> | null = null;
  let insertError: { message?: string | null; code?: string | null } | null = null;
  {
    const first = await resolved.adminClient
      .from("test_definitions")
      .insert(payload)
      .select("id, name, unit, category, value_type, sort_order, created_at, improvement_direction")
      .single();
    inserted = (first.data as Record<string, unknown> | null) ?? null;
    insertError = first.error;
  }

  if (insertError && dropDirectionFieldIfSchemaMissing(payload, insertError)) {
    const retry = await resolved.adminClient
      .from("test_definitions")
      .insert(payload)
      .select("id, name, unit, category, value_type, sort_order, created_at")
      .single();
    inserted = (retry.data as Record<string, unknown> | null) ?? null;
    insertError = retry.error;
  }

  if (insertError) return { error: `Metrik eklenemedi: ${insertError.message ?? "bilinmeyen hata"}` };

  revalidatePath("/saha-testleri", "layout");
  return { success: true as const, metric: inserted };
  });
}

export async function listFieldTestDefinitionsForActor() {
  return withServerActionGuard("fieldTest.listFieldTestDefinitionsForActor", async () => {
  const resolved = await resolveFieldTestActor();
  if ("error" in resolved) return { error: resolved.error };

  let orgShape: TestDefinitionOrgShape = { hasOrganizationId: true, hasOrgId: false };
  try {
    orgShape = await resolveTestDefinitionsOrgShape(resolved.adminClient);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Metrik tablo yapisi okunamadi: ${message}` as const };
  }

  const buildQuery = (selectCols: string) => {
    let q = resolved.adminClient
      .from("test_definitions")
      .select(selectCols)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (orgShape.hasOrganizationId && orgShape.hasOrgId) {
      q = q.or(`organization_id.eq.${resolved.organizationId},org_id.eq.${resolved.organizationId}`);
    } else if (orgShape.hasOrganizationId) {
      q = q.eq("organization_id", resolved.organizationId);
    } else if (orgShape.hasOrgId) {
      q = q.eq("org_id", resolved.organizationId);
    }
    return q;
  };

  let listData: unknown[] | null = null;
  let listError: { message?: string | null; code?: string | null } | null = null;
  {
    const first = await buildQuery(
      "id, name, unit, category, value_type, sort_order, created_at, improvement_direction"
    );
    listData = (first.data as unknown[] | null) ?? null;
    listError = first.error;
  }
  if (listError) {
    const code = (listError.code || "").toLowerCase();
    const msg = (listError.message || "").toLowerCase();
    if (code === "42703" || msg.includes("improvement_direction") || msg.includes("does not exist")) {
      const retry = await buildQuery("id, name, unit, category, value_type, sort_order, created_at");
      listData = (retry.data as unknown[] | null) ?? null;
      listError = retry.error;
    }
  }

  if (listError) return { error: `Metrikler alinamadi: ${listError.message ?? "bilinmeyen hata"}` as const };
  return { metrics: (listData || []) as Array<Record<string, unknown>> };
  });
}

export async function updateFieldTestDefinition(input: {
  testDefinitionId: string;
  name: string;
  unit: string;
  category: string;
  valueType: MetricValueType;
  improvementDirection?: MetricImprovementDirection;
}) {
  return withServerActionGuard("fieldTest.updateFieldTestDefinition", async () => {
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

  const direction: MetricImprovementDirection =
    input.valueType === "number" ? normalizeImprovementDirection(input.improvementDirection) : "unknown";
  const updatePayload: Record<string, unknown> = {
    name: safeName,
    unit: safeUnit || (input.valueType === "text" ? "not" : ""),
    category: safeCategory,
    value_type: input.valueType,
    improvement_direction: direction,
  };
  let updateError: { message?: string | null; code?: string | null } | null = null;
  {
    const first = await resolved.adminClient
      .from("test_definitions")
      .update(updatePayload)
      .eq("id", input.testDefinitionId);
    updateError = first.error;
  }

  if (updateError && dropDirectionFieldIfSchemaMissing(updatePayload, updateError)) {
    const retry = await resolved.adminClient
      .from("test_definitions")
      .update(updatePayload)
      .eq("id", input.testDefinitionId);
    updateError = retry.error;
  }

  if (updateError) return { error: `Metrik guncellenemedi: ${updateError.message ?? "bilinmeyen hata"}` as const };
  revalidatePath("/saha-testleri", "layout");
  return { success: true as const };
  });
}

export async function saveFieldTestDefinitionOrder(input: { orderedMetricIds: string[] }) {
  return withServerActionGuard("fieldTest.saveFieldTestDefinitionOrder", async () => {
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

  revalidatePath("/saha-testleri", "layout");
  return { success: true as const };
  });
}

export async function deleteFieldTestDefinition(testDefinitionId: string) {
  return withServerActionGuard("fieldTest.deleteFieldTestDefinition", async () => {
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

  revalidatePath("/saha-testleri", "layout");
  revalidatePath("/saha-testleri/genel-rapor");
  return { success: true as const };
  });
}

export type AthleticResultCell = {
  profileId: string;
  testId: string;
  valueNumber: number | null;
  valueText: string | null;
  /** Monotonic per-cell edit generation for stale-write protection. */
  editSeq?: number;
};

export type FieldTestSaveResult =
  | { success: true; skippedStaleCells?: number }
  | FieldTestSaveFailure;

export async function saveAthleticFieldResults(input: {
  testDate: string;
  selectedProfileIds: string[];
  cells: AthleticResultCell[];
  notes?: Array<{ profileId: string; note: string | null }>;
  writeSource?: FieldTestCellWriteSource;
}): Promise<FieldTestSaveResult> {
  return withServerActionGuard("fieldTest.saveAthleticFieldResults", async () => {
  const resolved = await resolveFieldTestActor();
  if ("error" in resolved) {
    return fieldTestSaveFailure(resolved.error ?? "Yetki doğrulanamadı.", {
      diagnosticsCode: FIELDTEST_DIAG_VALIDATION,
    });
  }

  const testDate = input.testDate?.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(testDate)) {
    return fieldTestSaveFailure("Geçersiz test tarihi.", { diagnosticsCode: FIELDTEST_DIAG_VALIDATION });
  }

  const selected = input.selectedProfileIds.filter(assertUuid);
  if (selected.length === 0) {
    return fieldTestSaveFailure("En az bir sporcu seçilmelidir.", {
      diagnosticsCode: FIELDTEST_DIAG_VALIDATION,
    });
  }

  const selectedSet = new Set(selected);

  const { data: athletes } = await resolved.adminClient
    .from("profiles")
    .select("id")
    .eq("organization_id", resolved.organizationId)
    .eq("role", "sporcu")
    .in("id", selected);

  const validAthleteIds = new Set((athletes || []).map((a) => a.id));
  for (const id of selected) {
    if (!validAthleteIds.has(id)) {
      return fieldTestSaveFailure("Seçilen sporculardan biri bu organizasyonda değil.", {
        diagnosticsCode: FIELDTEST_DIAG_VALIDATION,
      });
    }
  }

  const cells = input.cells.filter((c) => assertUuid(c.profileId) && assertUuid(c.testId) && selectedSet.has(c.profileId));
  const notes = (input.notes || []).filter((n) => assertUuid(n.profileId) && selectedSet.has(n.profileId));
  if (cells.length === 0 && notes.length === 0) {
    return fieldTestSaveFailure("Kaydedilecek değişiklik yok.", { diagnosticsCode: FIELDTEST_DIAG_VALIDATION });
  }

  const orgId = resolved.organizationId;
  let skippedStaleCells = 0;
  let appliedWrites = 0;
  const writeSource: FieldTestCellWriteSource = input.writeSource ?? "online";

  if (cells.length > 0) {
    const testIds = Array.from(new Set(cells.map((c) => c.testId)));
    let orgShape: TestDefinitionOrgShape = { hasOrganizationId: true, hasOrgId: false };
    try {
      orgShape = await resolveTestDefinitionsOrgShape(resolved.adminClient);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return fieldTestSaveFailure("Metrik tablo yapısı okunamadı.", { rawMessage: message });
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
      if (!validTestIds.has(tid)) {
        return fieldTestSaveFailure("Geçersiz veya başka organizasyona ait metrik.", {
          diagnosticsCode: FIELDTEST_DIAG_VALIDATION,
        });
      }
    }

    let writeShape;
    try {
      writeShape = await resolveAthleticResultsWriteShape(resolved.adminClient);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return fieldTestSaveFailure("Saha testi tablo yapısı okunamadı.", { rawMessage: message });
    }

    const hasTextCells = cells.some(
      (c) => (valueTypeByTestId.get(c.testId) || "number") === "text" && (c.valueText?.trim() || "")
    );
    if (hasTextCells && !writeShape.hasValueText) {
      return fieldTestSaveFailure(
        "Yazılı not metrikleri için veritabanı güncellemesi gerekli (value_text kolonu).",
        { diagnosticsCode: FIELDTEST_DIAG_SCHEMA }
      );
    }

    if (process.env.NODE_ENV !== "production") {
      logger.info("field_test.save.start", "field test save", {
        testDate,
        selectedCount: selected.length,
        cellCount: cells.length,
        organizationId: orgId,
        writeShape,
        writeSource: input.writeSource ?? "online",
      });
    }

    const storedRowsByKey = new Map<
      string,
      { value: number | null; value_text: string | null }
    >();

    if (cells.length > 0) {
      const profileIds = Array.from(new Set(cells.map((c) => c.profileId)));
      const testIds = Array.from(new Set(cells.map((c) => c.testId)));
      const { data: existingRows, error: existingErr } = await resolved.adminClient
        .from("athletic_results")
        .select("profile_id, test_id, value, value_text")
        .eq("organization_id", orgId)
        .eq("test_date", testDate)
        .in("profile_id", profileIds)
        .in("test_id", testIds);

      if (existingErr) {
        return fieldTestSaveFailure("Mevcut saha testi kayitlari okunamadi.", {
          rawMessage: existingErr.message,
          pgCode: existingErr.code,
        });
      }

      for (const row of existingRows ?? []) {
        const key = `${row.profile_id}-${row.test_id}`;
        storedRowsByKey.set(key, {
          value: row.value as number | null,
          value_text: (row.value_text as string | null) ?? null,
        });
      }
    }

    const writePlans = planFieldTestCellWrites({
      cells,
      valueTypeByTestId,
      storedRowsByKey,
      writeSource,
    });

    for (const plan of writePlans) {
      if (!plan.apply) {
        skippedStaleCells += 1;
        continue;
      }

      const cell = plan.cell;
      const valueType = valueTypeByTestId.get(cell.testId) || "number";
      const normalizedText = cell.valueText?.trim() || null;
      const editSeq = cell.editSeq ?? 0;
      if (valueType === "number") {
        if (cell.valueNumber === null || Number.isNaN(cell.valueNumber)) {
          const { error: delErr } = await resolved.adminClient
            .from("athletic_results")
            .delete()
            .eq("profile_id", cell.profileId)
            .eq("test_id", cell.testId)
            .eq("test_date", testDate);
          if (delErr) {
            return fieldTestSaveFailure("Saha testi kaydı silinemedi.", {
              rawMessage: delErr.message,
              pgCode: delErr.code,
            });
          }
          appliedWrites += 1;
          continue;
        }
        const v = Number(cell.valueNumber);
        if (!Number.isFinite(v)) {
          return fieldTestSaveFailure("Geçersiz ölçüm değeri.", { diagnosticsCode: FIELDTEST_DIAG_VALIDATION });
        }
        const row = buildAthleticResultUpsertRow({
          profileId: cell.profileId,
          testId: cell.testId,
          testDate,
          organizationId: orgId,
          valueType: "number",
          valueNumber: v,
          valueText: null,
          editSeq,
          shape: writeShape,
        });
        const { error: upErr } = await resolved.adminClient
          .from("athletic_results")
          .upsert(row, { onConflict: "profile_id,test_id,test_date" });
        if (upErr) {
          logger.warn("field_test.cell_write_failed", "upsert failed", {
            profileId: cell.profileId,
            testId: cell.testId,
            valueType,
            code: upErr.code,
            ...(process.env.NODE_ENV !== "production" ? { message: upErr.message } : {}),
          });
          return fieldTestSaveFailure("Saha testi kaydı kaydedilemedi.", {
            rawMessage: upErr.message,
            pgCode: upErr.code,
          });
        }
        appliedWrites += 1;
        continue;
      }

      if (!normalizedText) {
        const { error: delErr } = await resolved.adminClient
          .from("athletic_results")
          .delete()
          .eq("profile_id", cell.profileId)
          .eq("test_id", cell.testId)
          .eq("test_date", testDate);
        if (delErr) {
          return fieldTestSaveFailure("Saha testi kaydı silinemedi.", {
            rawMessage: delErr.message,
            pgCode: delErr.code,
          });
        }
        appliedWrites += 1;
      } else {
        const row = buildAthleticResultUpsertRow({
          profileId: cell.profileId,
          testId: cell.testId,
          testDate,
          organizationId: orgId,
          valueType: "text",
          valueNumber: null,
          valueText: normalizedText,
          editSeq,
          shape: writeShape,
        });
        const { error: upErr } = await resolved.adminClient
          .from("athletic_results")
          .upsert(row, { onConflict: "profile_id,test_id,test_date" });
        if (upErr) {
          logger.warn("field_test.cell_write_failed", "upsert failed", {
            profileId: cell.profileId,
            testId: cell.testId,
            valueType,
            code: upErr.code,
            ...(process.env.NODE_ENV !== "production" ? { message: upErr.message } : {}),
          });
          return fieldTestSaveFailure("Saha testi kaydı kaydedilemedi.", {
            rawMessage: upErr.message,
            pgCode: upErr.code,
          });
        }
        appliedWrites += 1;
      }
    }

    if (process.env.NODE_ENV !== "production" && skippedStaleCells > 0) {
      logger.info("field_test.save.stale_skipped", "skipped stale cell writes", {
        skippedStaleCells,
        writeSource,
      });
    }
  }

  for (const noteRow of notes) {
    const note = noteRow.note?.trim() || null;
    if (!note) {
      const { error: delErr } = await resolved.adminClient
        .from("athletic_result_notes")
        .delete()
        .eq("organization_id", orgId)
        .eq("profile_id", noteRow.profileId)
        .eq("test_date", testDate);
      if (delErr) {
        return fieldTestSaveFailure("Genel not silinemedi.", {
          rawMessage: delErr.message,
          pgCode: delErr.code,
        });
      }
      appliedWrites += 1;
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
    if (upErr) {
      return fieldTestSaveFailure("Genel not kaydedilemedi.", {
        rawMessage: upErr.message,
        pgCode: upErr.code,
      });
    }
    appliedWrites += 1;
  }

  if (shouldFailFieldTestSaveWithNoAppliedWrites(appliedWrites, cells.length, notes.length)) {
    return fieldTestSaveFailure(
      "Girilen degerler kaydedilemedi; sunucudaki kayit daha guncel. Sayfayi yenileyip tekrar deneyin.",
      { diagnosticsCode: FIELDTEST_DIAG_VALIDATION }
    );
  }

  if (shouldFailFieldTestSaveWithStaleSkipsOnline(skippedStaleCells, writeSource)) {
    return fieldTestSaveFailure(
      "Bazi degerler kaydedilemedi; sunucudaki kayit daha guncel. Sayfayi yenileyip tekrar deneyin.",
      { diagnosticsCode: FIELDTEST_DIAG_VALIDATION }
    );
  }

  revalidatePath("/saha-testleri", "layout");
  revalidatePath("/saha-testleri/genel-rapor");
  revalidatePath("/sporcu");
  return skippedStaleCells > 0 ? { success: true, skippedStaleCells } : { success: true };
  });
}

/**
 * Faz 2.1 — Performance Merkezi için saha testleri özet sinyali.
 *
 * Amaç:
 *   Performans dashboard'unda sporcu için son N gün içinde alınan saha
 *   testlerinin sayısı + son ölçüm tarihi gösterilebilsin. Karar sistemine
 *   sinyal vermez (yorumlama "iyileşme/gerileme" yönü metric başına bilinmez);
 *   sadece "veri var/yok ve ne zaman" işareti.
 *
 * Güvenlik:
 *   - resolveFieldTestActor: admin veya yetkili koç (can_view_reports).
 *   - athlete bu organizasyona ait olmalı; aksi halde 403.
 *
 * Performans:
 *   - Tek count + tek aggregate query; yan etki yok.
 *
 * Geriye dönük:
 *   - Yeni eylem; mevcut listeleme/yazma yollarını değiştirmez.
 */
export type FieldTestTrendStatus = "improved" | "regressed" | "stable" | "unknown" | "insufficient_data";

export type FieldTestMetricTrend = {
  metricId: string;
  metricName: string;
  unit: string;
  improvementDirection: MetricImprovementDirection;
  status: FieldTestTrendStatus;
  /** En son ölçüm değeri (numeric only). */
  lastValue: number | null;
  /** Bir önceki ölçüm değeri (numeric only). */
  previousValue: number | null;
  /** previousValue → lastValue % değişim (signed). */
  changePercent: number | null;
  measurementCount: number;
  lastTestDate: string | null;
};

export type FieldTestSignalSummary = {
  totalMeasurements: number;
  distinctMetricCount: number;
  lastTestDate: string | null;
  firstTestDate: string | null;
  sinceDays: number;
  /** v2: direction-aware trend (numeric metrikler için). text metrikler trend dışı. */
  trends: FieldTestMetricTrend[];
  trendCounts: Record<FieldTestTrendStatus, number>;
};

const TREND_STABLE_THRESHOLD_PCT = 2; // ±%2 stabil sayılır

function classifyTrend(
  direction: MetricImprovementDirection,
  previous: number | null,
  last: number | null
): FieldTestTrendStatus {
  if (previous === null || last === null) return "insufficient_data";
  if (!Number.isFinite(previous) || !Number.isFinite(last)) return "insufficient_data";
  if (previous === 0 && last === 0) return "stable";

  const base = previous === 0 ? Math.abs(last) : Math.abs(previous);
  const pct = base === 0 ? 0 : ((last - previous) / base) * 100;
  if (Math.abs(pct) <= TREND_STABLE_THRESHOLD_PCT) return "stable";

  if (direction === "higher_better") return last > previous ? "improved" : "regressed";
  if (direction === "lower_better") return last < previous ? "improved" : "regressed";
  return "unknown";
}

export async function summarizeFieldTestSignalsForAthlete(input: {
  athleteId: string;
  sinceDays?: number;
}): Promise<{ error: string } | FieldTestSignalSummary> {
  return withServerActionGuard("fieldTest.summarizeFieldTestSignalsForAthlete", async () => {
  const resolved = await resolveFieldTestActor();
  if ("error" in resolved) return { error: resolved.error ?? "Yetki kontrolu basarisiz." };

  const athleteId = (input.athleteId || "").trim();
  if (!assertUuid(athleteId)) return { error: "Gecersiz sporcu kimligi." as const };

  const since = Math.max(7, Math.min(365, Number(input.sinceDays) || 90));

  const { data: athleteRow } = await resolved.adminClient
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", athleteId)
    .maybeSingle();
  if (
    !athleteRow ||
    athleteRow.organization_id !== resolved.organizationId ||
    String(athleteRow.role) !== "sporcu"
  ) {
    return { error: "Sporcu bulunamadi veya bu organizasyona ait degil." as const };
  }

  const sinceDate = new Date();
  sinceDate.setUTCDate(sinceDate.getUTCDate() - since);
  const sinceKey = sinceDate.toISOString().slice(0, 10);

  const { data, error } = await resolved.adminClient
    .from("athletic_results")
    .select("test_id, value, value_text, test_date")
    .eq("profile_id", athleteId)
    .gte("test_date", sinceKey)
    .order("test_date", { ascending: true });

  if (error) return { error: `Saha test sinyali alinamadi: ${error.message}` as const };

  const rows = (data || []) as Array<{
    test_id: string;
    value: number | null;
    value_text: string | null;
    test_date: string;
  }>;

  const distinctMetrics = new Set<string>();
  let lastTestDate: string | null = null;
  let firstTestDate: string | null = null;
  for (const r of rows) {
    if (r.test_id) distinctMetrics.add(r.test_id);
    if (r.test_date) {
      if (!lastTestDate || r.test_date > lastTestDate) lastTestDate = r.test_date;
      if (!firstTestDate || r.test_date < firstTestDate) firstTestDate = r.test_date;
    }
  }

  // Trend hesabı: numeric değerlere sahip metrikleri grupla, son 2 ölçümü karşılaştır.
  const baseSummary = {
    totalMeasurements: rows.length,
    distinctMetricCount: distinctMetrics.size,
    lastTestDate,
    firstTestDate,
    sinceDays: since,
  };

  if (rows.length === 0) {
    return {
      ...baseSummary,
      trends: [],
      trendCounts: { improved: 0, regressed: 0, stable: 0, unknown: 0, insufficient_data: 0 },
    };
  }

  const metricIds = Array.from(distinctMetrics);

  let metricMeta = new Map<
    string,
    { name: string; unit: string; valueType: MetricValueType; direction: MetricImprovementDirection }
  >();
  if (metricIds.length > 0) {
    const fetchMeta = async (selectCols: string) =>
      resolved.adminClient.from("test_definitions").select(selectCols).in("id", metricIds);
    let { data: defs, error: defsErr } = await fetchMeta(
      "id, name, unit, value_type, improvement_direction"
    );
    if (defsErr) {
      const code = (defsErr.code || "").toLowerCase();
      const msg = (defsErr.message || "").toLowerCase();
      if (code === "42703" || msg.includes("improvement_direction") || msg.includes("does not exist")) {
        const retry = await fetchMeta("id, name, unit, value_type");
        defs = retry.data;
        defsErr = retry.error;
      }
    }
    if (!defsErr) {
      type DefRow = {
        id?: string | null;
        name?: string | null;
        unit?: string | null;
        value_type?: string | null;
        improvement_direction?: string | null;
      };
      metricMeta = new Map(
        (defs as DefRow[] | null || []).map((d) => [
          String(d?.id),
          {
            name: typeof d?.name === "string" && d.name ? d.name : "Metrik",
            unit: typeof d?.unit === "string" ? d.unit : "",
            valueType: normalizeMetricValueType(d?.value_type),
            direction: normalizeImprovementDirection(d?.improvement_direction),
          },
        ])
      );
    }
  }

  const grouped = new Map<string, Array<{ value: number | null; date: string }>>();
  for (const r of rows) {
    if (!r.test_id) continue;
    const list = grouped.get(r.test_id) || [];
    list.push({ value: r.value, date: r.test_date });
    grouped.set(r.test_id, list);
  }

  const trends: FieldTestMetricTrend[] = [];
  const trendCounts = { improved: 0, regressed: 0, stable: 0, unknown: 0, insufficient_data: 0 };

  for (const [metricId, list] of grouped) {
    const meta = metricMeta.get(metricId);
    if (!meta) continue;
    if (meta.valueType !== "number") continue; // text metrikler trend dışı

    const numericList = list
      .filter((x) => typeof x.value === "number" && Number.isFinite(x.value))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (numericList.length === 0) continue;

    const last = numericList[numericList.length - 1]!;
    const previous = numericList.length >= 2 ? numericList[numericList.length - 2]! : null;
    const status: FieldTestTrendStatus =
      previous === null
        ? "insufficient_data"
        : meta.direction === "unknown"
          ? "unknown"
          : classifyTrend(meta.direction, previous.value, last.value);

    const lastValue = typeof last.value === "number" ? last.value : null;
    const prevValue = previous && typeof previous.value === "number" ? previous.value : null;
    const changePercent =
      lastValue !== null && prevValue !== null && prevValue !== 0
        ? ((lastValue - prevValue) / Math.abs(prevValue)) * 100
        : null;

    trends.push({
      metricId,
      metricName: meta.name,
      unit: meta.unit,
      improvementDirection: meta.direction,
      status,
      lastValue,
      previousValue: prevValue,
      changePercent,
      measurementCount: numericList.length,
      lastTestDate: last.date || null,
    });
    trendCounts[status] += 1;
  }

  trends.sort((a, b) => {
    const order: Record<FieldTestTrendStatus, number> = {
      regressed: 0,
      improved: 1,
      stable: 2,
      unknown: 3,
      insufficient_data: 4,
    };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return a.metricName.localeCompare(b.metricName, "tr");
  });

  return {
    ...baseSummary,
    trends,
    trendCounts,
  };
  });
}

export type FieldTestSessionSummary = {
  testDate: string;
  athleteCount: number;
  entryCount: number;
  hasNotes: boolean;
};

/** Org içindeki saha test oturumları (distinct test_date, sonuç + not birleşimi). */
export async function listFieldTestSessionSummariesForActor() {
  return withServerActionGuard("fieldTest.listFieldTestSessionSummariesForActor", async () => {
    const resolved = await resolveFieldTestActor();
    if ("error" in resolved) return { error: resolved.error };

    const orgId = resolved.organizationId;
    const admin = resolved.adminClient;

    const [resultsRes, notesRes] = await Promise.all([
      paginatePostgrestSelect(async (from, to) =>
        admin
          .from("athletic_results")
          .select("test_date, profile_id, profiles!inner(organization_id)")
          .eq("profiles.organization_id", orgId)
          .order("test_date", { ascending: false })
          .range(from, to)
      ),
      paginatePostgrestSelect(async (from, to) =>
        admin
          .from("athletic_result_notes")
          .select("test_date, profile_id, profiles!inner(organization_id)")
          .eq("profiles.organization_id", orgId)
          .order("test_date", { ascending: false })
          .range(from, to)
      ),
    ]);

    if (resultsRes.error) {
      return { error: `Oturum listesi alinamadi: ${resultsRes.error.message}` as const };
    }
    if (notesRes.error) {
      return { error: `Oturum listesi alinamadi: ${notesRes.error.message}` as const };
    }

    type ResultRow = { test_date?: string | null; profile_id?: string | null };
    const byDate = new Map<string, { athletes: Set<string>; entries: number; hasNotes: boolean }>();

    for (const row of resultsRes.data as ResultRow[]) {
      const testDate = row.test_date?.trim();
      if (!testDate) continue;
      let slot = byDate.get(testDate);
      if (!slot) {
        slot = { athletes: new Set(), entries: 0, hasNotes: false };
        byDate.set(testDate, slot);
      }
      if (row.profile_id) slot.athletes.add(row.profile_id);
      slot.entries += 1;
    }

    for (const row of notesRes.data as ResultRow[]) {
      const testDate = row.test_date?.trim();
      if (!testDate) continue;
      let slot = byDate.get(testDate);
      if (!slot) {
        slot = { athletes: new Set(), entries: 0, hasNotes: false };
        byDate.set(testDate, slot);
      }
      slot.hasNotes = true;
      if (row.profile_id) slot.athletes.add(row.profile_id);
    }

    const sessions: FieldTestSessionSummary[] = [...byDate.entries()]
      .map(([testDate, slot]) => ({
        testDate,
        athleteCount: slot.athletes.size,
        entryCount: slot.entries,
        hasNotes: slot.hasNotes,
      }))
      .sort((a, b) => b.testDate.localeCompare(a.testDate));

    return { sessions };
  });
}

/** Saha testleri tablosu: seçili gün için org içi sporcu sonuçları (RLS yerine admin + tenant doğrulama). */
export async function listAthleticResultsForActorByDate(input: {
  profileIds: string[];
  testDate: string;
}) {
  return withServerActionGuard("fieldTest.listAthleticResultsForActorByDate", async () => {
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

  // Faz 9.2 — chunked .in() for large team result fetch.
  const chunkedRes = await chunkedInQuery(
    filteredIds,
    async (chunk) =>
      await resolved.adminClient
        .from("athletic_results")
        .select("*")
        .in("profile_id", chunk)
        .eq("test_date", testDate),
    { scope: "athleticFieldActions.listAthleticResultsByDate" }
  );

  if (chunkedRes.error) {
    return { error: `Sonuclar alinamadi: ${chunkedRes.error.message}` as const };
  }

  return { results: (chunkedRes.data || []) as AthleticResultRow[] };
  });
}

export type FieldTestPreviousResultRow = {
  profile_id: string;
  test_id: string;
  test_date: string;
  value: number | null;
  value_text: string | null;
};

/** Oturum tarihinden önceki son test sonuçları (profil + metrik başına en güncel). */
/** Önceki ölçüm hidrasyonu için sayfalama tavanı (kadro × metrik × tarih). */
const PREVIOUS_RESULTS_MAX_ROWS = 20000;

export async function listPreviousFieldTestResultsForActor(input: {
  profileIds: string[];
  beforeTestDate: string;
}) {
  return withServerActionGuard("fieldTest.listPreviousFieldTestResultsForActor", async () => {
    const resolved = await resolveFieldTestActor();
    if ("error" in resolved) return { error: resolved.error };

    const beforeTestDate = input.beforeTestDate?.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(beforeTestDate)) {
      return { error: "Gecersiz test tarihi." as const };
    }

    const ids = input.profileIds.filter(assertUuid);
    if (ids.length === 0) {
      return { results: [] as FieldTestPreviousResultRow[] };
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
      return { results: [] as FieldTestPreviousResultRow[] };
    }

    // PostgREST tek istekte 1000 satır döner; sayfalama olmadan kalabalık
    // kadrolarda bazı sporcuların "önceki ölçüm" değeri sessizce kaybolur.
    const chunkedRes = await chunkedInQuery(
      filteredIds,
      async (chunk) =>
        await paginatePostgrestSelect<FieldTestPreviousResultRow>(
          async (from, to) =>
            await resolved.adminClient
              .from("athletic_results")
              .select("profile_id, test_id, test_date, value, value_text")
              .in("profile_id", chunk)
              .lt("test_date", beforeTestDate)
              .order("test_date", { ascending: false })
              .order("profile_id", { ascending: true })
              .order("test_id", { ascending: true })
              .range(from, to),
          1000,
          PREVIOUS_RESULTS_MAX_ROWS
        ),
      { scope: "athleticFieldActions.listPreviousFieldTestResults" }
    );

    if (chunkedRes.error) {
      return { error: `Onceki sonuclar alinamadi: ${chunkedRes.error.message}` as const };
    }

    return { results: (chunkedRes.data || []) as FieldTestPreviousResultRow[] };
  });
}

export type AthleticResultNoteRow = {
  profile_id: string;
  test_date: string;
  note: string | null;
};

export async function listAthleticResultNotesByDate(input: { profileIds: string[]; testDate: string }) {
  return withServerActionGuard("fieldTest.listAthleticResultNotesByDate", async () => {
  const resolved = await resolveFieldTestActor();
  if ("error" in resolved) return { error: resolved.error };

  const testDate = input.testDate?.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(testDate)) return { error: "Gecersiz test tarihi." as const };
  const ids = input.profileIds.filter(assertUuid);
  if (ids.length === 0) return { notes: [] as AthleticResultNoteRow[] };

  const chunkedNotes = await chunkedInQuery(
    ids,
    async (chunk) =>
      await resolved.adminClient
        .from("athletic_result_notes")
        .select("profile_id, test_date, note")
        .eq("organization_id", resolved.organizationId)
        .eq("test_date", testDate)
        .in("profile_id", chunk),
    { scope: "athleticFieldActions.listAthleticResultNotesByDate" }
  );
  if (chunkedNotes.error) return { error: `Genel notlar alinamadi: ${chunkedNotes.error.message}` as const };
  return { notes: (chunkedNotes.data || []) as AthleticResultNoteRow[] };
  });
}

export type FieldTestTeamChartRow = {
  name: string;
  deger: number;
  test: string;
  unit: string;
};

/** Genel rapor: kadro sayısı + tüm saha sonuçları (org içi, admin/koç + can_view_reports). */
export async function loadFieldTestTeamReportForActor() {
  return withServerActionGuard("fieldTest.loadFieldTestTeamReportForActor", async () => {
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

  const resultsRes = await paginatePostgrestSelect(async (from, to) =>
    admin
      .from("athletic_results")
      .select(
        `
      value,
      value_text,
      test_date,
      id,
      profiles!inner (full_name, organization_id),
      test_definitions (name, unit, value_type)
    `
      )
      .eq("profiles.organization_id", orgId)
      .order("test_date", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to)
  );

  if (resultsRes.error) {
    return { error: `Rapor verisi alinamadi: ${resultsRes.error.message}` as const };
  }

  type Joined = {
    value: number | string | null;
    value_text?: string | null;
    profiles?: { full_name?: string | null; organization_id?: string | null } | null;
    test_definitions?: { name?: string | null; unit?: string | null; value_type?: string | null } | null;
  };

  const chartRows: FieldTestTeamChartRow[] = (resultsRes.data as Joined[])
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
  });
}

/**
 * Faz 5.4 — Saha testi sonuçları CSV export.
 *
 * Org içindeki tüm saha testi sonuçlarını (`athletic_results`) tek CSV'ye yazar.
 * Aynı yetki çerçevesi (`resolveFieldTestActor`) ile org scope korunur.
 *
 * Filtreler:
 *   - dateFrom / dateTo (YYYY-MM-DD), opsiyonel
 *   - athleteProfileId, opsiyonel — verilmezse tüm aktif sporcular
 *
 * Cap: 10000 satır.
 *
 * Çıktı kolonları:
 *   Tarih · Sporcu · Metrik · Kategori · Birim · Değer · Metin Değer · İyileşme Yönü
 */
const FIELD_TEST_EXPORT_HARD_CAP = 10000;

export async function exportFieldTestResultsCSV(input: {
  dateFrom?: string | null;
  dateTo?: string | null;
  athleteProfileId?: string | null;
} = {}) {
  return withServerActionGuard("fieldTest.exportFieldTestResultsCSV", async () => {
  const resolved = await resolveFieldTestActor();
  if ("error" in resolved) return { error: resolved.error ?? "Yetki kontrolu başarısız." };

  const featureDenial = await assertExportFeatureForOrg(
    EXPORT_ENDPOINT_IDS.fieldTestResultsCsv,
    resolved.organizationId
  );
  if (featureDenial) {
    return { error: featureDenial.error };
  }

  const dateFrom = input.dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(input.dateFrom) ? input.dateFrom : null;
  const dateTo = input.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(input.dateTo) ? input.dateTo : null;
  if (dateFrom && dateTo && dateFrom > dateTo) {
    return { error: "Başlangıç tarihi bitiş tarihinden sonra olamaz." as const };
  }
  const wantAthlete = input.athleteProfileId && assertUuid(input.athleteProfileId) ? input.athleteProfileId : null;

  // Önce org içindeki sporcu kimlikleri (org-scope güvenliği için).
  let profileQuery = resolved.adminClient
    .from("profiles")
    .select("id, full_name, email")
    .eq("organization_id", resolved.organizationId)
    .eq("role", "sporcu");
  if (wantAthlete) profileQuery = profileQuery.eq("id", wantAthlete);
  const { data: athletes, error: athleteErr } = await profileQuery;
  if (athleteErr) return { error: `Sporcu listesi alınamadı: ${athleteErr.message}` };
  const athleteList = (athletes || []).map((a) => ({
    id: a.id,
    full_name: toDisplayName(a.full_name, a.email, "Sporcu"),
  }));
  if (athleteList.length === 0) {
    const { csv } = buildCsvFromRows(
      ["Tarih", "Sporcu", "Metrik", "Kategori", "Birim", "Değer", "Metin Değer", "İyileşme Yönü"],
      []
    );
    return {
      csv,
      filename: csvFilename("saha-testleri", "sonuclar", { from: dateFrom, to: dateTo, athlete: wantAthlete }),
      rowCount: 0,
      truncated: false,
    };
  }
  const profileIds = athleteList.map((a) => a.id);
  const profileMap = new Map(athleteList.map((a) => [a.id, a.full_name]));

  // Test definitions: org-scope (improvement_direction kolonu opsiyonel; yoksa fallback).
  // Eski kurulumlarda kolon yoksa schema cache 42703 atar; tek seferde dönüp geniş seçim yaparız.
  let metricsRaw: Record<string, unknown>[] | null = null;
  let metricsErr: { message?: string | null } | null = null;
  {
    const primary = await resolved.adminClient
      .from("test_definitions")
      .select("id, name, unit, category, value_type, improvement_direction")
      .eq("organization_id", resolved.organizationId);
    metricsRaw = primary.data as Record<string, unknown>[] | null;
    metricsErr = primary.error;
    if (metricsErr && /improvement_direction/i.test(metricsErr.message || "")) {
      const retry = await resolved.adminClient
        .from("test_definitions")
        .select("id, name, unit, category, value_type")
        .eq("organization_id", resolved.organizationId);
      metricsRaw = retry.data as Record<string, unknown>[] | null;
      metricsErr = retry.error;
    }
  }
  if (metricsErr) return { error: `Metrik tanımları alınamadı: ${metricsErr.message}` };
  type MetricMeta = {
    id: string;
    name: string;
    unit: string;
    category: string;
    value_type: string;
    improvement_direction: string;
  };
  const metricMap = new Map<string, MetricMeta>(
    (metricsRaw || []).map((m: Record<string, unknown>) => [
      String(m.id),
      {
        id: String(m.id),
        name: String(m.name || ""),
        unit: String(m.unit || ""),
        category: String(m.category || ""),
        value_type: String(m.value_type || "number"),
        improvement_direction: String(m.improvement_direction || "unknown"),
      },
    ])
  );

  let resultsQuery = resolved.adminClient
    .from("athletic_results")
    .select("profile_id, test_id, value, value_text, test_date")
    .in("profile_id", profileIds)
    .order("test_date", { ascending: false })
    .limit(FIELD_TEST_EXPORT_HARD_CAP);
  if (dateFrom) resultsQuery = resultsQuery.gte("test_date", dateFrom);
  if (dateTo) resultsQuery = resultsQuery.lte("test_date", dateTo);
  const { data: resultRows, error: resultErr } = await resultsQuery;
  if (resultErr) return { error: `Saha testi sonuçları alınamadı: ${resultErr.message}` };

  const headers = ["Tarih", "Sporcu", "Metrik", "Kategori", "Birim", "Değer", "Metin Değer", "İyileşme Yönü"];
  const directionLabel: Record<string, string> = {
    higher_better: "Yüksek iyi",
    lower_better: "Düşük iyi",
    unknown: "Belirsiz",
  };
  const rows = (resultRows || []).map((r: AthleticResultRow) => {
    const meta = metricMap.get(String(r.test_id));
    return [
      String(r.test_date || ""),
      profileMap.get(String(r.profile_id)) || "",
      meta?.name || "",
      meta?.category || "",
      meta?.unit || "",
      r.value != null && Number.isFinite(r.value) ? r.value : "",
      fieldTestUserFacingText(r.value_text),
      directionLabel[meta?.improvement_direction || "unknown"] || "Belirsiz",
    ];
  });

  const built = buildCsvFromRows(headers, rows, { maxRows: FIELD_TEST_EXPORT_HARD_CAP });
  const filename = csvFilename("saha-testleri", "sonuclar", {
    from: dateFrom,
    to: dateTo,
    athlete: wantAthlete,
  });
  const truncated = built.truncated || rows.length >= FIELD_TEST_EXPORT_HARD_CAP;
  logger.info("export.fieldTests", "field tests csv built", {
    rowCount: built.rowCount,
    truncated,
    cap: FIELD_TEST_EXPORT_HARD_CAP,
    dateFrom,
    dateTo,
  });
  return {
    csv: built.csv,
    filename,
    rowCount: built.rowCount,
    truncated,
    cap: FIELD_TEST_EXPORT_HARD_CAP,
  };
  });
}
