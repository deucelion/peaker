/**
 * PostgREST / Supabase hata mesajları: eksik kolon, schema cache vb.
 * Okuma ve yazma (insert/update) yollarında aynı mantık kullanılır.
 */
export function isPaymentsSchemaCompatibilityError(message?: string | null): boolean {
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
  return (
    m.includes("schema cache") ||
    m.includes("could not find") ||
    m.includes("display_name") ||
    m.includes("payments.display_name") ||
    m.includes("payments.payment_kind") ||
    m.includes("payments.payment_scope") ||
    m.includes("payments.metadata_json") ||
    m.includes("payments.deleted_at") ||
    m.includes("payments.due_date") ||
    m.includes("payments.paid_at") ||
    m.includes("payments.package_id") ||
    m.includes("payments.created_at") ||
    m.includes("42703") ||
    (m.includes("column") && m.includes("does not exist")) ||
    m.includes("could not embed") ||
    m.includes("more than one relationship")
  );
}
