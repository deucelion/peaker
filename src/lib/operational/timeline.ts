/**
 * Faz 13.7 — Operational timeline append (service_role insert).
 * PII-free summary + JSON payload (ids, kinds, counts only).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/monitoring/logger";

export type OperationalTimelineInput = {
  organizationId: string | null;
  eventType: string;
  severity?: "info" | "warning" | "critical";
  summary: string;
  payload?: Record<string, unknown>;
  actorUserId?: string | null;
};

export async function appendOperationalTimeline(
  adminClient: SupabaseClient,
  input: OperationalTimelineInput
): Promise<void> {
  try {
    const { error } = await adminClient.from("peaker_operational_timeline").insert({
      organization_id: input.organizationId,
      event_type: input.eventType,
      severity: input.severity ?? "info",
      summary: input.summary.slice(0, 500),
      payload: input.payload ?? {},
      actor_user_id: input.actorUserId ?? null,
    });
    if (error) {
      logger.warn("operational.timeline", "insert failed", { reason: error.message });
    }
  } catch (e) {
    logger.warn("operational.timeline", "insert exception", { reason: (e as Error).message });
  }
}
