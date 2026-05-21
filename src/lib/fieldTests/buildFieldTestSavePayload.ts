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
}): { cells: AthleticResultCell[]; error?: string } {
  const cells: AthleticResultCell[] = [];

  for (const profileId of params.selectedProfileIds) {
    for (const metric of params.metrics) {
      const key = `${profileId}-${metric.id}`;
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
  }

  return { cells };
}

export function metricValueKindFromRow(row: {
  value_type?: unknown;
  valueType?: unknown;
}): MetricValueKind {
  return isTextMetricValueType(row.value_type ?? row.valueType) ? "text" : "number";
}
