export const AUDIT_ACTIONS = [
  "lesson.create",
  "lesson.update",
  "lesson.cancel",
  "lesson.participant.add",
  "lesson.participant.remove",
  "attendance.status.update",
  "program.create",
  "program.update",
  "payment.create",
  "payment.status.update",
  "permission.coach.update",
  "permission.athlete.update",
  "coach.lifecycle.update",
  "athlete.lifecycle.update",
  "organization.lifecycle.update",
  "organization.license.update",
  "organization.create",
  "job.queue.retry_single",
  "job.queue.retry_all",
  "job.queue.dlq_requeue",
  "job.queue.cancel",
  "job.queue.purge_completed",
  "operational.alert.acknowledge",
  "operational.alert.resolve",
  "operational.replay.evaluate_alerts",
  "operational.replay.export_audit",
  "operational.replay.retention_audit",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ENTITY_TYPES = [
  "lesson",
  "training_participant",
  "attendance",
  "program",
  "payment",
  "coach_permission",
  "athlete_permission",
  "coach",
  "athlete",
  "organization",
  "async_job",
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export type AuditMetadata = Record<string, unknown>;

export type AuditEventInput = {
  organizationId: string | null;
  actorUserId: string;
  actorRole: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  metadata?: AuditMetadata;
};
