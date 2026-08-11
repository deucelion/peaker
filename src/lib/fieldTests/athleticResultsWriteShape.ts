import type { SupabaseClient } from "@supabase/supabase-js";
import {
  encodeNumericCellEditSeqMetadata,
  encodeTextCellWithEditSeq,
} from "@/lib/fieldTests/fieldTestEditSeqMetadata";

export type AthleticResultsWriteShape = {
  hasValueText: boolean;
  hasOrganizationId: boolean;
};

let cachedShape: AthleticResultsWriteShape | null = null;

/** Test-only */
export function resetAthleticResultsWriteShapeCache(): void {
  cachedShape = null;
}

/**
 * athletic_results yazma şekli — migration drift (value_text, organization_id) için.
 */
export async function resolveAthleticResultsWriteShape(
  adminClient: SupabaseClient
): Promise<AthleticResultsWriteShape> {
  if (cachedShape) return cachedShape;

  const full = await adminClient
    .from("athletic_results")
    .select("value, value_text, organization_id")
    .limit(0);

  if (!full.error) {
    cachedShape = { hasValueText: true, hasOrganizationId: true };
    return cachedShape;
  }

  const msg = (full.error.message || "").toLowerCase();
  const code = (full.error.code || "").toLowerCase();
  const missingValueText =
    code === "42703" ||
    code === "pgrst204" ||
    msg.includes("value_text") ||
    msg.includes("schema cache");

  if (missingValueText) {
    const legacy = await adminClient.from("athletic_results").select("value, organization_id").limit(0);
    const legacyMsg = (legacy.error?.message || "").toLowerCase();
    const legacyCode = (legacy.error?.code || "").toLowerCase();
    cachedShape = {
      hasValueText: false,
      hasOrganizationId: !(
        legacy.error &&
        (legacyCode === "42703" ||
          legacyCode === "pgrst204" ||
          legacyMsg.includes("organization_id"))
      ),
    };
    return cachedShape;
  }

  cachedShape = { hasValueText: false, hasOrganizationId: true };
  return cachedShape;
}

/** Text metriklerde `value` NOT NULL ise raporlama için nötr sayısal placeholder. */
export const FIELD_TEST_TEXT_VALUE_PLACEHOLDER = 0;

export function buildAthleticResultUpsertRow(params: {
  profileId: string;
  testId: string;
  testDate: string;
  organizationId: string;
  valueType: "number" | "text";
  valueNumber: number | null;
  valueText: string | null;
  editSeq?: number;
  shape: AthleticResultsWriteShape;
}): Record<string, unknown> {
  const row: Record<string, unknown> = {
    profile_id: params.profileId,
    test_id: params.testId,
    test_date: params.testDate,
  };
  if (params.shape.hasOrganizationId) {
    row.organization_id = params.organizationId;
  }

  const editSeq = params.editSeq ?? 0;

  if (params.valueType === "number") {
    row.value = params.valueNumber;
    if (params.shape.hasValueText) {
      row.value_text = editSeq > 0 ? encodeNumericCellEditSeqMetadata(editSeq) : null;
    }
    return row;
  }

  row.value = FIELD_TEST_TEXT_VALUE_PLACEHOLDER;
  if (params.shape.hasValueText) {
    const text = params.valueText?.trim() || "";
    row.value_text =
      editSeq > 0
        ? encodeTextCellWithEditSeq(text, editSeq)
        : text === ""
          ? null
          : text;
  }
  return row;
}
