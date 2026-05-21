import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/monitoring/logger";
import type { PackageEventType } from "@/lib/privateLessons/packageEventTypes";

export type AppendPackageEventInput = {
  packageId: string;
  organizationId: string;
  actorId?: string | null;
  eventType: PackageEventType | string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
};

export async function appendPrivateLessonPackageEvent(
  adminClient: SupabaseClient,
  input: AppendPackageEventInput
): Promise<void> {
  try {
    const { error } = await adminClient.from("private_lesson_package_events").insert({
      package_id: input.packageId,
      organization_id: input.organizationId,
      actor_id: input.actorId ?? null,
      event_type: input.eventType,
      title: input.title.slice(0, 200),
      description: input.description?.slice(0, 1000) ?? null,
      metadata: input.metadata ?? {},
    });
    if (error) {
      logger.warn("package.event", "insert failed", { reason: error.message, eventType: input.eventType });
    }
  } catch (e) {
    logger.warn("package.event", "insert exception", { reason: (e as Error).message });
  }
}
