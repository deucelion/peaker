import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type InsertNotificationsResult = { ok: true } | { ok: false; error: string };

/** Tek yerden kullanici bildirimi (grup dersi, program, ozel paket, finans). */
export async function insertNotificationsForUsers(
  userIds: string[],
  message: string
): Promise<InsertNotificationsResult> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0 || !message.trim()) return { ok: true };
  try {
    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient
      .from("notifications")
      .insert(unique.map((id) => ({ user_id: id, message: message.trim() })));
    if (error) {
      console.error("[insertNotificationsForUsers]", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bilinmeyen hata";
    console.error("[insertNotificationsForUsers]", msg);
    return { ok: false, error: msg };
  }
}
