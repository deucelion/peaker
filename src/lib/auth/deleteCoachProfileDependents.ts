import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * profiles silmeden once coach_id FK'si olan kayitlari temizler.
 * private_lesson_sessions.coach_id ON DELETE RESTRICT oldugu icin oturumlar once silinir.
 */
export async function deleteCoachProfileDependents(
  adminClient: SupabaseClient,
  coachId: string,
  organizationId: string
): Promise<{ error: string | null }> {
  const { error: sessionsErr } = await adminClient
    .from("private_lesson_sessions")
    .delete()
    .eq("coach_id", coachId)
    .eq("organization_id", organizationId);
  if (sessionsErr) {
    return { error: `Özel ders oturumları silinemedi: ${sessionsErr.message}` };
  }
  return { error: null };
}
