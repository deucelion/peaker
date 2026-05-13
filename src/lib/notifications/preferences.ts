/**
 * notification_preferences server-side helper (Faz 4.5).
 *
 * - getMutedTypesForUserIds(...): `insertNotificationsForUsers` içinde toplu lookup için.
 * - getMyPreferences(): kullanıcının kendi tercih satırını okur (yoksa varsayılan döner).
 * - upsertMyPreferences(...): kullanıcı toggle'larını kaydeder.
 *
 * Tablo henüz tüm kurulumlarda hazır olmayabilir → tüm fonksiyonlar fail-safe:
 * tablo yoksa veya RLS engellerse "muted hiç yok" davranışına düşer (mevcut sistemi
 * bozmaz, sadece tercih sistemi devre dışı kalır).
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type NotificationPreferenceRow = {
  user_id: string;
  organization_id: string | null;
  muted_types: string[];
  email_enabled: boolean;
  push_enabled: boolean;
  updated_at?: string | null;
};

export const DEFAULT_PREFERENCE: Omit<NotificationPreferenceRow, "user_id" | "organization_id"> = {
  muted_types: [],
  email_enabled: true,
  push_enabled: true,
};

/** Tek seferde birden çok kullanıcının muted_types listesini döndürür. */
export async function getMutedTypesForUserIds(
  adminClient: AdminClient,
  userIds: ReadonlyArray<string>
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return result;
  try {
    const { data, error } = await adminClient
      .from("notification_preferences")
      .select("user_id, muted_types")
      .in("user_id", unique);
    if (error) {
      // Tablo yoksa veya başka bir sebep — fail-safe: kimseyi mute sayma.
      return result;
    }
    for (const row of data || []) {
      const list = Array.isArray(row.muted_types) ? row.muted_types.filter((v) => typeof v === "string") : [];
      result.set(String(row.user_id), list as string[]);
    }
  } catch {
    // ignore — fail-safe
  }
  return result;
}

/** Kullanıcının kendi tercih satırını döndürür. Yoksa varsayılan (muted_types boş). */
export async function getPreferenceForUser(
  adminClient: AdminClient,
  userId: string,
  organizationId: string | null
): Promise<NotificationPreferenceRow> {
  try {
    const { data, error } = await adminClient
      .from("notification_preferences")
      .select("user_id, organization_id, muted_types, email_enabled, push_enabled, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) {
      return { user_id: userId, organization_id: organizationId, ...DEFAULT_PREFERENCE };
    }
    const muted = Array.isArray(data.muted_types) ? data.muted_types.filter((v) => typeof v === "string") : [];
    return {
      user_id: String(data.user_id),
      organization_id: data.organization_id ? String(data.organization_id) : organizationId,
      muted_types: muted as string[],
      email_enabled: Boolean(data.email_enabled),
      push_enabled: Boolean(data.push_enabled),
      updated_at: typeof data.updated_at === "string" ? data.updated_at : null,
    };
  } catch {
    return { user_id: userId, organization_id: organizationId, ...DEFAULT_PREFERENCE };
  }
}

/** Tek satırlık upsert. organization_id null kalabilir. */
export async function upsertPreferenceForUser(
  adminClient: AdminClient,
  input: {
    userId: string;
    organizationId: string | null;
    mutedTypes: string[];
    emailEnabled?: boolean;
    pushEnabled?: boolean;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const payload: Record<string, unknown> = {
      user_id: input.userId,
      organization_id: input.organizationId,
      muted_types: input.mutedTypes,
      updated_at: new Date().toISOString(),
    };
    if (typeof input.emailEnabled === "boolean") payload.email_enabled = input.emailEnabled;
    if (typeof input.pushEnabled === "boolean") payload.push_enabled = input.pushEnabled;
    const { error } = await adminClient
      .from("notification_preferences")
      .upsert(payload, { onConflict: "user_id" });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Bilinmeyen hata" };
  }
}
