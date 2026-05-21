/** FAZ 27 — Runtime telemetry event kinds (no PII). */

export type RuntimeTelemetryScope = {
  organizationId?: string | null;
  actorRole?: string | null;
  correlationId?: string | null;
  requestId?: string | null;
};

export type RuntimeSeverity = "info" | "warn" | "error";
