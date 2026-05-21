import type { QueryErrorKind } from "@/lib/ui/queryState";
import { auditListUserMessage } from "@/lib/schemaCompat/userMessages";

/** Faz 16 — Audit list fetch client diagnostics (development only). */
export function debugAuditLogFetch(event: string, payload: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== "development") return;
  console.debug("[audit-log]", event, payload);
}

export function auditListErrorMessage(kind: QueryErrorKind, serverMessage?: string | null): {
  title: string;
  description: string;
  diagnosticsCode: string;
} {
  const mapped = auditListUserMessage(kind, serverMessage);
  return {
    title: mapped.title,
    description: mapped.description,
    diagnosticsCode: mapped.diagnosticsCode,
  };
}
