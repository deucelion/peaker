import { logger } from "@/lib/monitoring";

export function reportSchemaCompatFallback(scope: string, detail: Record<string, unknown>): void {
  logger.warn("telemetry.schema_compat.fallback", "schema compatibility fallback", {
    scope,
    ...detail,
  });
}

export function reportMigrationDriftDetected(scope: string, missing: string[]): void {
  logger.warn("telemetry.schema_compat.drift", "migration drift detected", {
    scope,
    missingColumns: missing,
  });
}
