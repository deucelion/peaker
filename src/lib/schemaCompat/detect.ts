import "server-only";

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  DEFAULT_SCHEMA_CAPABILITIES,
  buildDriftWarnings,
  type SchemaCapabilities,
} from "@/lib/schemaCompat/capabilities";
import { isMissingColumnError } from "@/lib/schemaCompat/errors";
import { reportMigrationDriftDetected } from "@/lib/schemaCompat/telemetry";

async function probeColumn(table: string, column: string): Promise<boolean> {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from(table).select(column).limit(0);
    if (!error) return true;
    if (isMissingColumnError(error.message, column)) return false;
    return true;
  } catch {
    return false;
  }
}

async function probeTable(table: string): Promise<boolean> {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from(table).select("id").limit(0);
    if (!error) return true;
    if (isMissingColumnError(error.message)) return false;
    return true;
  } catch {
    return false;
  }
}

async function probeRpc(name: string): Promise<boolean> {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.rpc(name, {
      p_plp_id: "00000000-0000-0000-0000-000000000000",
      p_organization_id: "00000000-0000-0000-0000-000000000000",
      p_actor_id: "00000000-0000-0000-0000-000000000000",
      p_reason: "schema_probe",
    });
    if (!error) return true;
    const m = String(error.message || "").toLowerCase();
    if (m.includes("could not find the function") || m.includes("42883")) return false;
    return true;
  } catch {
    return false;
  }
}

async function detectSchemaCapabilitiesInternal(): Promise<SchemaCapabilities> {
  const [lifecycleStatus, installmentCount, packageEventsTable, voidedAt, voidRpc] = await Promise.all([
    probeColumn("private_lesson_packages", "lifecycle_status"),
    probeColumn("private_lesson_packages", "installment_count"),
    probeTable("private_lesson_package_events"),
    probeColumn("private_lesson_payments", "voided_at"),
    probeRpc("private_lesson_void_ledger_payment_atomic"),
  ]);

  const core = {
    packages: {
      lifecycleStatus,
      installmentFields: installmentCount,
      packageEventsTable,
    },
    payments: {
      privateLessonVoidedAt: voidedAt,
      privateLessonVoidRpc: voidRpc,
    },
  };

  const driftWarnings = buildDriftWarnings(core);
  if (driftWarnings.length) {
    reportMigrationDriftDetected("schema.detect", driftWarnings);
  }

  return {
    ...core,
    driftWarnings,
    detectedAt: new Date().toISOString(),
  };
}

const getCachedCapabilities = unstable_cache(
  detectSchemaCapabilitiesInternal,
  ["peaker-schema-capabilities-v1"],
  { revalidate: 120, tags: ["schema-capabilities"] }
);

export async function getSchemaCapabilities(): Promise<SchemaCapabilities> {
  try {
    return await getCachedCapabilities();
  } catch {
    return { ...DEFAULT_SCHEMA_CAPABILITIES, detectedAt: new Date().toISOString() };
  }
}
