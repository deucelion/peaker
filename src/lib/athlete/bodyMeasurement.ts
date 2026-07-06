export type AthleteBodyMeasurementRow = {
  id: string;
  measurement_date: string;
  height: number | null;
  weight: number | null;
  body_fat: number | null;
  note: string | null;
  recorded_by: string | null;
  recorded_by_name: string | null;
};

export type ParsedBodyMeasurementInput = {
  measurementDate: string;
  height: number | null;
  weight: number | null;
  note: string | null;
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function todayDateKeyUtc(): string {
  return new Date().toISOString().split("T")[0]!;
}

export function parseMeasurementDate(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!DATE_KEY.test(v)) return null;
  const d = new Date(`${v}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return v;
}

export function parseHeightCm(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const h = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(h) || h < 50 || h > 260) return null;
  return Math.round(h);
}

export function parseWeightKg(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const w = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(w) || w < 20 || w > 300) return null;
  return Math.round(w * 10) / 10;
}

export function parseBodyMeasurementInput(input: {
  measurementDate?: string | null;
  height?: string | number | null;
  weight?: string | number | null;
  note?: string | null;
}): { ok: true; value: ParsedBodyMeasurementInput } | { ok: false; error: string } {
  const measurementDate = parseMeasurementDate(input.measurementDate ?? todayDateKeyUtc());
  if (!measurementDate) return { ok: false, error: "Geçersiz ölçüm tarihi." };

  const height = parseHeightCm(input.height);
  const weight = parseWeightKg(input.weight);
  if (height == null && weight == null) {
    return { ok: false, error: "Boy veya kilo değerlerinden en az biri girilmelidir." };
  }

  const note = (input.note ?? "").trim().slice(0, 500) || null;
  return { ok: true, value: { measurementDate, height, weight, note } };
}

export function mapBodyMeasurementRow(row: Record<string, unknown>): AthleteBodyMeasurementRow {
  return {
    id: String(row.id ?? ""),
    measurement_date: String(row.measurement_date ?? ""),
    height: row.height != null ? Number(row.height) : null,
    weight: row.weight != null ? Number(row.weight) : null,
    body_fat: row.body_fat != null ? Number(row.body_fat) : null,
    note: row.note != null ? String(row.note) : null,
    recorded_by: row.recorded_by != null ? String(row.recorded_by) : null,
    recorded_by_name:
      row.recorded_by_profile && typeof row.recorded_by_profile === "object" && row.recorded_by_profile !== null
        ? String((row.recorded_by_profile as { full_name?: string }).full_name ?? "")
        : null,
  };
}
