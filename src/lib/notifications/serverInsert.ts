import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { CRITICAL_NOTIFICATION_TYPES, type NotificationType } from "./types";
import { getMutedTypesForUserIds } from "./preferences";

export type InsertNotificationsResult = { ok: true } | { ok: false; error: string };

/**
 * Tek yerden kullanici bildirimi (grup dersi, program, ozel paket, finans).
 *
 * Faz 4.5 değişiklikleri:
 *  - Opsiyonel `type` parametresi eklendi. Tip verilirse:
 *    * `notifications.type` kolonuna yazılır (kullanıcı geçmişi tip bazlı filtrelenebilir).
 *    * `notification_preferences` lookup yapılır; muted kullanıcılar atlanır.
 *    * Kritik tipler (lesson.cancelled, payment.overdue, ...) mute edilse de gönderilir.
 *  - Tip verilmezse legacy davranış: muted_types kontrolü yapılmaz.
 */
export async function insertNotificationsForUsers(
  userIds: string[],
  message: string,
  type?: NotificationType
): Promise<InsertNotificationsResult> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0 || !message.trim()) return { ok: true };

  try {
    const adminClient = createSupabaseAdminClient();

    let recipients = unique;
    if (type && !CRITICAL_NOTIFICATION_TYPES.has(type)) {
      const muteMap = await getMutedTypesForUserIds(adminClient, unique);
      recipients = unique.filter((id) => {
        const mutedList = muteMap.get(id);
        if (!mutedList || mutedList.length === 0) return true;
        return !mutedList.includes(type);
      });
    }
    if (recipients.length === 0) return { ok: true };

    const rows = recipients.map((id) => {
      const base: Record<string, unknown> = { user_id: id, message: message.trim() };
      if (type) base.type = type;
      return base;
    });

    const { error } = await adminClient.from("notifications").insert(rows);
    if (error) {
      const code = (error.code || "").toLowerCase();
      const msg = (error.message || "").toLowerCase();
      // Eski şema (type kolonu olmayan kurulum): tekrar dene tip alanı olmadan.
      if (
        type &&
        (code === "42703" || msg.includes("column") || msg.includes("does not exist") || msg.includes("schema cache"))
      ) {
        const fallbackRows = recipients.map((id) => ({ user_id: id, message: message.trim() }));
        const { error: fallbackErr } = await adminClient.from("notifications").insert(fallbackRows);
        if (fallbackErr) {
          console.error("[insertNotificationsForUsers]", fallbackErr.message);
          return { ok: false, error: fallbackErr.message };
        }
        return { ok: true };
      }
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
