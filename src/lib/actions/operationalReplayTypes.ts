/** Faz 15 — Operational replay result types (no "use server"). */

export type OperationalReplayResult<T = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; error: string; errorKind?: "auth" | "permission" | "validation" | "fetch" };
