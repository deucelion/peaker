/**
 * App Router dinamik segmentleri bazen `string | string[] | undefined` gelir; tek değer bekleyen sorgular için normalize eder.
 */
export function asSingleDynamicParam(value: string | string[] | undefined): string {
  if (typeof value === "string") {
    try {
      return decodeURIComponent(value).trim();
    } catch {
      return value.trim();
    }
  }
  if (Array.isArray(value) && value[0] != null && value[0] !== "") {
    const first = String(value[0]);
    try {
      return decodeURIComponent(first).trim();
    } catch {
      return first.trim();
    }
  }
  return "";
}
