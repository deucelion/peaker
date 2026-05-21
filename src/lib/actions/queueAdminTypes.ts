/** Faz 15 — Queue admin action result types (no "use server"). */

export type QueueAdminActionResult<T extends Record<string, unknown> = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; error: string; errorKind?: "auth" | "permission" | "validation" | "fetch" };
