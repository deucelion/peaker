"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { AuditEventInput } from "@/lib/audit/types";

/**
 * Best-effort audit logging.
 * Audit insert failure must not break business action.
 */
export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    const adminClient = createSupabaseAdminClient();
    await adminClient.from("audit_logs").insert({
      organization_id: input.organizationId,
      user_id: input.actorUserId,
      role: input.actorRole,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      metadata: input.metadata ?? {},
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[audit] insert failed: ${message}`);
  }
}
