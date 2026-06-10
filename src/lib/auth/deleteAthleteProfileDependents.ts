import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * profiles silmeden once profile_id FK'si olan sporcu verilerini temizler.
 * hardDeleteAthlete ve onboarding rollback icin ortak sira.
 */
export async function deleteAthleteProfileDependents(
  adminClient: SupabaseClient,
  profileId: string
): Promise<{ error: string | null }> {
  const tables = ["training_loads", "wellness_reports", "athlete_metrics"] as const;
  for (const table of tables) {
    const { error } = await adminClient.from(table).delete().eq("profile_id", profileId);
    if (error) return { error: `${table} silinemedi: ${error.message}` };
  }
  return { error: null };
}
