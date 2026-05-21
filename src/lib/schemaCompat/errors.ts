/**
 * PostgREST / Postgres schema drift detection (missing column, cache).
 */

export function isMissingColumnError(message?: string | null, columnHint?: string): boolean {
  const m = String(message || "").toLowerCase();
  if (!m) return false;
  if (
    m.includes("permission denied") ||
    m.includes("rls policy") ||
    m.includes("row-level security") ||
    m.includes("jwt") ||
    m.includes("invalid api key")
  ) {
    return false;
  }
  const generic =
    m.includes("schema cache") ||
    m.includes("could not find") ||
    m.includes("42703") ||
    (m.includes("column") && m.includes("does not exist"));
  if (!generic) return false;
  if (!columnHint) return true;
  const hint = columnHint.toLowerCase();
  return m.includes(hint) || m.includes(`public.${hint}`);
}

export function isSchemaCompatibilityError(message?: string | null): boolean {
  const m = String(message || "").toLowerCase();
  if (!m) return false;
  if (
    m.includes("permission denied") ||
    m.includes("rls policy") ||
    m.includes("row-level security")
  ) {
    return false;
  }
  return (
    isMissingColumnError(message) ||
    m.includes("could not embed") ||
    m.includes("more than one relationship")
  );
}
