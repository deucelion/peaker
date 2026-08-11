import { FIELD_TEST_TEXT_VALUE_PLACEHOLDER } from "@/lib/fieldTests/athleticResultsWriteShape";
import { parseStoredFieldTestEditSeq } from "@/lib/fieldTests/fieldTestEditSeqMetadata";
import type { MetricValueKind } from "@/lib/fieldTests/metricValueType";
import { isTextMetricValueType } from "@/lib/fieldTests/metricValueType";

export type FieldTestResultRowInput = {
  profile_id: string;
  test_id: string;
  value?: number | null;
  value_text?: string | null;
};

export type FieldTestCellDisplay =
  | { kind: "empty" }
  | { kind: "text"; value: string }
  | { kind: "number"; integerPart: string; decimalPart?: string };

/**
 * Salt okunur tablo hücresi için gösterim modeli.
 * Yazılı metriklerde placeholder 0 tek başına boş sayılır.
 */
export function formatFieldTestCellDisplayValue(params: {
  raw: string | number | null | undefined;
  valueType: MetricValueKind;
}): FieldTestCellDisplay {
  const raw = params.raw;
  if (raw === null || raw === undefined || raw === "") {
    return { kind: "empty" };
  }

  const str = String(raw).trim();
  if (str === "") return { kind: "empty" };

  if (params.valueType === "text") {
    if (str === "0" || str === String(FIELD_TEST_TEXT_VALUE_PLACEHOLDER)) {
      return { kind: "empty" };
    }
    return { kind: "text", value: str };
  }

  if (!Number.isFinite(Number(str))) {
    return { kind: "text", value: str };
  }

  const [integerPart, decimalPart] = str.split(".");
  if (!decimalPart) {
    return { kind: "number", integerPart };
  }
  return { kind: "number", integerPart, decimalPart };
}

/**
 * DB satırından form state değeri üretir.
 * Yazılı metriklerde value=0 placeholder olduğu için value_text önceliklidir.
 */
export function resolveFieldTestCellValueFromRow(params: {
  value: number | null | undefined;
  valueText: string | null | undefined;
  valueType: MetricValueKind;
}): string | number | undefined {
  const parsedText = parseStoredFieldTestEditSeq(params.valueText);
  const text = (parsedText.displayText ?? "").trim();

  if (params.valueType === "text") {
    return text !== "" ? text : undefined;
  }

  if (typeof params.value === "number" && Number.isFinite(params.value)) {
    if (params.value === FIELD_TEST_TEXT_VALUE_PLACEHOLDER && text !== "") {
      return text;
    }
    return params.value;
  }

  if (text !== "") return text;
  return undefined;
}

export type FieldTestPreviousCell = {
  testDate: string;
  display: string;
};

export type FieldTestPreviousResultRow = FieldTestResultRowInput & {
  test_date: string;
};

/** Oturum tarihinden önceki en güncel sonuç (profil + metrik başına). */
export function pickLatestFieldTestResultsBeforeDate(
  rows: FieldTestPreviousResultRow[],
  beforeTestDate: string
): FieldTestPreviousResultRow[] {
  const latest = new Map<string, FieldTestPreviousResultRow>();

  for (const row of rows) {
    const testDate = row.test_date?.trim();
    if (!testDate || testDate >= beforeTestDate) continue;
    const key = `${row.profile_id}-${row.test_id}`;
    const existing = latest.get(key);
    if (!existing || testDate > existing.test_date) {
      latest.set(key, row);
    }
  }

  return [...latest.values()];
}

export function formatFieldTestDisplayString(params: {
  raw: string | number | null | undefined;
  valueType: MetricValueKind;
  unit?: string | null;
}): string {
  const display = formatFieldTestCellDisplayValue({ raw: params.raw, valueType: params.valueType });
  if (display.kind === "empty") return "";

  const core =
    display.kind === "text"
      ? display.value
      : display.decimalPart !== undefined
        ? `${display.integerPart}.${display.decimalPart}`
        : display.integerPart;

  const unit = params.unit?.trim();
  if (display.kind === "number" && unit) return `${core} ${unit}`;
  return core;
}

export function buildPreviousFieldTestCellsMap(
  rows: FieldTestPreviousResultRow[],
  beforeTestDate: string,
  metricValueTypeByTestId: Record<string, MetricValueKind>,
  metricUnitByTestId: Record<string, string | null | undefined> = {}
): Record<string, FieldTestPreviousCell> {
  const map: Record<string, FieldTestPreviousCell> = {};
  const latest = pickLatestFieldTestResultsBeforeDate(rows, beforeTestDate);

  for (const row of latest) {
    const valueType = metricValueTypeByTestId[row.test_id] ?? "number";
    const cell = resolveFieldTestCellValueFromRow({
      value: row.value,
      valueText: row.value_text,
      valueType,
    });
    if (cell === undefined) continue;

    const display = formatFieldTestDisplayString({
      raw: cell,
      valueType,
      unit: metricUnitByTestId[row.test_id],
    });
    if (!display) continue;

    map[`${row.profile_id}-${row.test_id}`] = {
      testDate: row.test_date,
      display,
    };
  }

  return map;
}

export function buildFieldTestValuesMapFromResults(
  results: FieldTestResultRowInput[],
  metricValueTypeByTestId: Record<string, MetricValueKind>
): Record<string, string | number> {
  const map: Record<string, string | number> = {};

  for (const row of results) {
    const valueType = metricValueTypeByTestId[row.test_id] ?? "number";
    const cell = resolveFieldTestCellValueFromRow({
      value: row.value,
      valueText: row.value_text,
      valueType,
    });
    if (cell !== undefined) {
      map[`${row.profile_id}-${row.test_id}`] = cell;
    }
  }

  return map;
}

/** Sporcu detay kart/grid — tek satır sonuç gösterimi. */
export function fieldTestResultRowDisplay(row: {
  value: number | null;
  value_text?: string | null;
  value_type?: unknown;
}): FieldTestCellDisplay {
  const textMetric = isTextMetricValueType(row.value_type);
  const parsedText = parseStoredFieldTestEditSeq(row.value_text);
  if (textMetric) {
    return formatFieldTestCellDisplayValue({ raw: parsedText.displayText ?? "", valueType: "text" });
  }
  const note = (parsedText.displayText ?? "").trim();
  if (note && (row.value === 0 || row.value === null)) {
    return formatFieldTestCellDisplayValue({ raw: note, valueType: "text" });
  }
  return formatFieldTestCellDisplayValue({ raw: row.value ?? undefined, valueType: "number" });
}
