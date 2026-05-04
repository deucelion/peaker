/** test_definitions.value_type ve API varyantları için tek kaynak. */
export type MetricValueKind = "number" | "text";

export function normalizeMetricValueType(raw: unknown): MetricValueKind {
  const s = String(raw ?? "").trim().toLowerCase();
  if (
    s === "text" ||
    s === "yazi" ||
    s === "yazı" ||
    s === "string" ||
    s === "note" ||
    s === "not" ||
    s === "written" ||
    s === "yazili" ||
    s === "yazılı"
  ) {
    return "text";
  }
  return "number";
}

export function isTextMetricValueType(raw: unknown): boolean {
  return normalizeMetricValueType(raw) === "text";
}
