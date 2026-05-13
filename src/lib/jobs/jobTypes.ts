/**
 * Faz 8.2 — Async job foundation: type definitions.
 *
 * Hedef:
 *   - Export, retention, batch notification gibi uzun-süreli operasyonları
 *     ortak abstraction ile sarmalamak.
 *   - Henüz gerçek queue (BullMQ / Trigger.dev / pg_cron-task) entegrasyonu YOK.
 *   - Mevcut server action davranışı korunur; bu modül sadece foundation.
 *
 * Geleceğe yönelik kullanım:
 *   const ctx = createJobContext({ kind: "export.payments", initiatorId: actor.id });
 *   const result = await runJob(ctx, async () => { ... });
 *   // result.status, result.durationMs, result.rowCount vs.
 *
 * Mevcut kullanım:
 *   Action'lar `runJob` ile sarılır; senkron çalışır, telemetry üretir.
 *   Bu sayede ileride queue eklendiğinde signature değişmez.
 */

export type JobKind =
  | "export.audit"
  | "export.payments"
  | "export.performance"
  | "export.fieldTests"
  | "retention.notifications"
  | "retention.auditLogs"
  | "retention.jobs"
  | "batch.notifications"
  | "report.snapshot";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "truncated";

export type JobInitiator =
  | { kind: "user"; id: string; role: string }
  | { kind: "system"; id: "scheduler" | "internal" };

export type JobContext = {
  kind: JobKind;
  jobId: string;
  initiator: JobInitiator;
  organizationId?: string | null;
  startedAt: number;
  /** Telemetry için ek attribute'lar (PII içermez). */
  attributes: Record<string, unknown>;
};

export type JobResult<T = unknown> = {
  jobId: string;
  kind: JobKind;
  status: JobStatus;
  durationMs: number;
  /** Truncated/failed durumlarında bile partial data dönülebilir. */
  data?: T;
  /** İşlenen kayıt sayısı (varsa). */
  rowCount?: number;
  /** Cap aşılmışsa true. */
  truncated?: boolean;
  cap?: number;
  /** Hata mesajı (kullanıcı için Türkçe). */
  error?: string;
  /** Telemetry attribute'ları. */
  attributes: Record<string, unknown>;
};
