/**
 * Faz 8.2 — Job foundation barrel.
 *
 * Bu modül henüz gerçek queue içermez. Senkron `runJob` ile başlar; ileride
 * `enqueueJob` / `executeQueuedJob` eklenecek. Şu an export ve retention
 * action'larını telemetry/standart hata akışıyla sarmalamak için kullanılır.
 */

export type {
  JobKind,
  JobStatus,
  JobInitiator,
  JobContext,
  JobResult,
} from "./jobTypes";
export { createJobContext, runJob, type JobRunOutcome } from "./createJobContext";
export { jobStatusLabel, jobStatusTone } from "./jobStatus";
export {
  inMemoryAdapter,
  getQueueAdapter,
  registerQueueAdapter,
  jobContextToQueuePayload,
  decideRetry,
  type QueueAdapter,
  type QueueJobPayload,
  type QueueEnqueueResult,
  type QueueCancelResult,
  type JobRetryClassification,
  type JobRetryDecision,
} from "./queueAdapter";
export { createPgmqAdapter } from "./pgmqAdapter";
export { enqueueJob, type EnqueueJobOptions } from "./enqueueJob";
export { ensureQueueAdapterSetup, debugCurrentQueueAdapter } from "./setupQueueAdapter";
