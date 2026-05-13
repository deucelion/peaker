/**
 * Faz 12.1 — Worker handler registry.
 *
 * İlk hedef handler'lar:
 *   - export.audit
 *   - export.payments
 *   - retention.notifications
 *   - retention.auditLogs
 *
 * Diğer job kind'ları (export.performance, export.fieldTests, batch.notifications,
 * report.snapshot) Faz 13'te eklenecek. Bu turda mevcut sync runJob fallback
 * korunur — async path opt-in.
 */

import type { JobKind } from "../jobTypes";
import type { WorkerHandler } from "./types";
import { retentionNotificationsHandler } from "./retentionNotifications";
import { retentionAuditLogsHandler } from "./retentionAuditLogs";
import { retentionJobsHandler } from "./retentionJobs";
import { exportAuditHandler } from "./exportAudit";
import { exportPaymentsHandler } from "./exportPayments";

const registry = new Map<JobKind, WorkerHandler>([
  ["retention.notifications", retentionNotificationsHandler],
  ["retention.auditLogs", retentionAuditLogsHandler],
  ["retention.jobs", retentionJobsHandler],
  ["export.audit", exportAuditHandler],
  ["export.payments", exportPaymentsHandler],
]);

export function getHandler(kind: JobKind): WorkerHandler | undefined {
  return registry.get(kind);
}

export function listSupportedKinds(): JobKind[] {
  return Array.from(registry.keys());
}
