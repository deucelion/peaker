/**
 * Faz 11.1 — Queue adapter setup.
 *
 * Server-side modülde import edildiği anda ENV bayrağına göre aktif adapter'ı
 * register eder.
 *
 *   PEAKER_QUEUE_ADAPTER=pgmq    → pgmqAdapter
 *   (default)                    → inMemoryAdapter (mevcut davranış)
 *
 * Mevcut tüm `runJob` çağrıları synchronous çalışmaya devam eder; bu modül
 * yalnızca `enqueueJob` ile çağrıldığında etkilidir. Production rollout için
 * önce migration uygulanır, sonra ENV bayrağı set edilir.
 */

import { logger } from "@/lib/monitoring/logger";
import { registerQueueAdapter, inMemoryAdapter, getQueueAdapter } from "./queueAdapter";
import { createPgmqAdapter } from "./pgmqAdapter";

let setupRan = false;

export function ensureQueueAdapterSetup(): void {
  if (setupRan) return;
  setupRan = true;
  const choice = (process.env.PEAKER_QUEUE_ADAPTER || "").toLowerCase().trim();
  if (choice === "pgmq") {
    registerQueueAdapter(createPgmqAdapter());
    logger.info("queue.setup", "pgmq adapter aktif", { adapter: "pgmq" });
    return;
  }
  registerQueueAdapter(inMemoryAdapter);
  logger.info("queue.setup", "in-memory adapter aktif (default)", { adapter: "in-memory" });
}

export function debugCurrentQueueAdapter(): string {
  return getQueueAdapter().name;
}
