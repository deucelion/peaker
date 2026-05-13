/**
 * Faz 12.1 — Worker handler interface.
 *
 * Her async job kind için bir handler kaydedilir; worker mesajı aldığında
 * registry'den handler'ı çözer ve `run` ile çalıştırır.
 *
 * Karar:
 *   - Handler synchronous değil; uzun süreli iş için Promise döner.
 *   - Result blob ≤ 100KB; büyük çıktılar (CSV) için `result.storagePath`
 *     döner ve Supabase Storage'a yazılır (Faz 12.4'te storage çıktısı eklenecek).
 *   - Hata throw edilirse worker errorKind classification yapar ve retry
 *     veya DLQ kararı verir.
 *   - Idempotency: handler kendi içinde verir; aynı payload tekrar gelirse
 *     duplicate fiili işlem yapmamalı.
 */

import type { JobKind } from "../jobTypes";

export type WorkerJobContext = {
  jobKind: JobKind;
  logId: string;
  attempts: number;
  maxAttempts: number;
  organizationId: string | null;
  idempotencyKey: string | null;
  payload: Record<string, unknown>;
  /** Worker tick içindeki correlation id (telemetry). */
  workerId: string;
  /** Mesajın visibility timeout deadline'ı; handler bunu aşmamalı. */
  visibilityDeadline: number;
};

export type WorkerHandlerResult = {
  /** Büyük çıktılar storage'a yazıldıysa path. */
  storagePath?: string | null;
  /** Bookkeeping için summary (PII içermez). */
  summary?: Record<string, unknown>;
  /** Toplam işlenen satır sayısı. */
  rowCount?: number;
  /** Cap aşıldıysa true. */
  truncated?: boolean;
};

export interface WorkerHandler {
  readonly kind: JobKind;
  /**
   * İş işlenir. Hata throw edilirse worker retry/DLQ kararı verir.
   * Handler kendi içinde idempotency check yapmalı (örn. payload.idempotencyKey
   * ile aynı sonuç daha önce yazıldı mı diye).
   */
  run(ctx: WorkerJobContext): Promise<WorkerHandlerResult>;
}
