import type { AthleticResultCell } from "@/lib/actions/athleticFieldActions";
import { isTextMetricValueType, type MetricValueKind } from "@/lib/fieldTests/metricValueType";

export type FieldTestMetricInput = {
  id: string;
  valueType: MetricValueKind;
};

export function buildFieldTestCells(params: {
  selectedProfileIds: string[];
  metrics: FieldTestMetricInput[];
  testValues: Record<string, string | number>;
  /** Verilirse yalnızca bu hücre anahtarları kayda dahil edilir (dokunulmayan boş hücreler silinmez). */
  onlyCellKeys?: ReadonlySet<string>;
}): { cells: AthleticResultCell[]; error?: string } {
  const cells: AthleticResultCell[] = [];
  const metricById = new Map(params.metrics.map((m) => [m.id, m]));

  const pairs: Array<{ profileId: string; metric: FieldTestMetricInput }> = [];
  if (params.onlyCellKeys && params.onlyCellKeys.size > 0) {
    for (const key of params.onlyCellKeys) {
      const parsed = parseFieldTestCellKey(key);
      if (!parsed) continue;
      if (!params.selectedProfileIds.includes(parsed.profileId)) continue;
      const metric = metricById.get(parsed.testId);
      if (!metric) continue;
      pairs.push({ profileId: parsed.profileId, metric });
    }
  } else {
    for (const profileId of params.selectedProfileIds) {
      for (const metric of params.metrics) {
        pairs.push({ profileId, metric });
      }
    }
  }

  for (const { profileId, metric } of pairs) {
      const key = fieldTestCellKey(profileId, metric.id);
      const raw = params.testValues[key];
      const isText = metric.valueType === "text";

      if (isText) {
        const str =
          typeof raw === "string"
            ? raw.trim()
            : raw === null || raw === undefined
              ? ""
              : String(raw).trim();
        cells.push({
          profileId,
          testId: metric.id,
          valueNumber: null,
          valueText: str === "" ? null : str,
        });
        continue;
      }

      const str = typeof raw === "string" ? raw.trim() : raw;
      const numeric =
        str === "" || str === null || str === undefined ? null : Number(str);
      if (numeric !== null && Number.isNaN(numeric)) {
        return { cells: [], error: "Geçersiz sayısal değer." };
      }
      cells.push({
        profileId,
        testId: metric.id,
        valueNumber: numeric,
        valueText: null,
      });
  }

  return { cells };
}

/** profile_id + test_id birleşik anahtar (her iki id UUID). */
export function fieldTestCellKey(profileId: string, testId: string): string {
  return `${profileId}-${testId}`;
}

export function parseFieldTestCellKey(key: string): { profileId: string; testId: string } | null {
  if (key.length < 38) return null;
  const profileId = key.slice(0, 36);
  if (key[36] !== "-") return null;
  const testId = key.slice(37);
  if (profileId.length !== 36 || testId.length !== 36) return null;
  return { profileId, testId };
}

export function metricValueKindFromRow(row: {
  value_type?: unknown;
  valueType?: unknown;
}): MetricValueKind {
  return isTextMetricValueType(row.value_type ?? row.valueType) ? "text" : "number";
}
