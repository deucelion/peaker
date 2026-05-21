import type { SupabaseClient } from "@supabase/supabase-js";

const REPLAY_COOLDOWN_MS = 60_000;

/**
 * Faz 16 — Replay storm önleme: aynı aktör + aksiyon için kısa cooldown.
 */
export async function assertOperationalReplayCooldown(
  adminClient: SupabaseClient,
  actorUserId: string,
  auditActions: string[]
): Promise<{ ok: true } | { ok: false; error: string; retryAfterSeconds: number }> {
  const since = new Date(Date.now() - REPLAY_COOLDOWN_MS).toISOString();
  const { count, error } = await adminClient
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", actorUserId)
    .in("action", auditActions)
    .gte("created_at", since);
  if (error) {
    return { ok: true };
  }
  if ((count ?? 0) > 0) {
    const sec = Math.ceil(REPLAY_COOLDOWN_MS / 1000);
    return {
      ok: false,
      error: `Bu işlem ${sec} saniye içinde zaten tetiklendi. Lütfen bekleyin.`,
      retryAfterSeconds: sec,
    };
  }
  return { ok: true };
}
