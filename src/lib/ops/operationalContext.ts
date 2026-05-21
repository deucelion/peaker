import { randomUUID } from "node:crypto";
import type { AlertSeverity } from "@/lib/telemetry/alertRules";

export type OperationalActorScope = {
  organizationId?: string | null;
  userId?: string | null;
  role?: string | null;
};

export type OperationalFailureEnvelope = {
  userMessage: string;
  diagnosticsCode: string;
  severity: AlertSeverity;
  correlationId: string;
  requestId: string;
  scope: OperationalActorScope;
  /** Development-only technical hint (never shown in production UI). */
  devHint?: string | null;
};

export function createCorrelationId(): string {
  return randomUUID();
}

export function createRequestId(): string {
  return randomUUID();
}

/**
 * Standard operational failure for server actions / API routes.
 * `rawMessage` is logged server-side only — not returned to client in production.
 */
export function buildOperationalFailure(input: {
  userMessage: string;
  diagnosticsCode: string;
  severity?: AlertSeverity;
  scope?: OperationalActorScope;
  rawMessage?: string | null;
  correlationId?: string;
  requestId?: string;
}): OperationalFailureEnvelope {
  const correlationId = input.correlationId ?? createCorrelationId();
  const requestId = input.requestId ?? createRequestId();
  const isDev = process.env.NODE_ENV !== "production";
  return {
    userMessage: input.userMessage,
    diagnosticsCode: input.diagnosticsCode,
    severity: input.severity ?? "warning",
    correlationId,
    requestId,
    scope: input.scope ?? {},
    devHint: isDev && input.rawMessage ? String(input.rawMessage).slice(0, 500) : null,
  };
}

export function operationalFailureToClientError(envelope: OperationalFailureEnvelope): {
  error: string;
  diagnosticsCode: string;
  correlationId: string;
} {
  const suffix = `(Tanı: ${envelope.diagnosticsCode})`;
  return {
    error: `${envelope.userMessage} ${suffix}`.trim(),
    diagnosticsCode: envelope.diagnosticsCode,
    correlationId: envelope.correlationId,
  };
}
