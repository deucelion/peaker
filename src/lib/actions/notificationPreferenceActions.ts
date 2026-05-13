"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { resolveSessionActor, toTenantProfileRow } from "@/lib/auth/resolveSessionActor";
import {
  getPreferenceForUser,
  upsertPreferenceForUser,
  type NotificationPreferenceRow,
} from "@/lib/notifications/preferences";
import {
  buildMutedTypesFromCategoryToggles,
  type NotificationCategory,
} from "@/lib/notifications/types";

export type GetMyNotificationPreferencesResult =
  | { ok: true; preference: NotificationPreferenceRow }
  | { error: string };

export async function getMyNotificationPreferences(): Promise<GetMyNotificationPreferencesResult> {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: false });
  if ("error" in resolved) return { error: resolved.error };
  const actor = toTenantProfileRow(resolved.actor);
  const adminClient = createSupabaseAdminClient();
  const preference = await getPreferenceForUser(adminClient, actor.id, actor.organization_id ?? null);
  return { ok: true, preference };
}

export type UpdateMyNotificationPreferencesInput = {
  enabledCategories: Partial<Record<NotificationCategory, boolean>>;
  emailEnabled?: boolean;
  pushEnabled?: boolean;
};

export async function updateMyNotificationPreferences(
  input: UpdateMyNotificationPreferencesInput
): Promise<{ ok: true } | { error: string }> {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: false });
  if ("error" in resolved) return { error: resolved.error };
  const actor = toTenantProfileRow(resolved.actor);
  const adminClient = createSupabaseAdminClient();

  const muted = buildMutedTypesFromCategoryToggles(input.enabledCategories || {});
  const res = await upsertPreferenceForUser(adminClient, {
    userId: actor.id,
    organizationId: actor.organization_id ?? null,
    mutedTypes: muted,
    emailEnabled: input.emailEnabled,
    pushEnabled: input.pushEnabled,
  });
  if (!res.ok) return { error: `Tercihler kaydedilemedi: ${res.error}` };

  revalidatePath("/bildirimler");
  return { ok: true };
}
