import "server-only";

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { SystemHealthCheckResult, SystemHealthReport } from "@/lib/types";
import { scanProfileIntegrity } from "@/lib/diagnostics/profileIntegrity";

type CriticalCheckKey =
  | "coach_permissions"
  | "athlete_permissions"
  | "athlete_programs_lifecycle"
  | "attendance_status"
  | "notifications_ready"
  | "organizations_ready"
  | "organization_lifecycle"
  | "private_lesson_packages_ready"
  | "payments_profile_id"
  | "profiles_integrity";

async function runChecksInternal(): Promise<SystemHealthReport> {
  let adminClient: ReturnType<typeof createSupabaseAdminClient> | null = null;
  let adminClientInitError: string | null = null;
  try {
    adminClient = createSupabaseAdminClient();
  } catch (error: unknown) {
    adminClientInitError = error instanceof Error ? error.message : "Admin client olusturulamadi.";
  }
  const checks: SystemHealthCheckResult[] = [];

  async function checkColumns(
    key: CriticalCheckKey,
    title: string,
    table: string,
    columns: string[],
    migration: string
  ) {
    if (!adminClient) {
      checks.push({
        key,
        title,
        passed: false,
        details: `Health check calisamadi: ${adminClientInitError || "SUPABASE_SERVICE_ROLE_KEY eksik."}`,
        migration,
      });
      return;
    }
    const { error } = await adminClient.from(table).select(columns.join(",")).limit(1);
    checks.push({
      key,
      title,
      passed: !error,
      details: error ? error.message : "Schema uyumlu.",
      migration,
    });
  }

  await checkColumns(
    "coach_permissions",
    "Coach permissions schema",
    "coach_permissions",
    [
      "coach_id",
      "organization_id",
      "can_create_lessons",
      "can_edit_lessons",
      "can_view_all_athletes",
      "can_add_athletes_to_lessons",
      "can_take_attendance",
      "can_view_reports",
      "can_manage_training_notes",
    ],
    "20260330_coach_permissions.sql"
  );

  await checkColumns(
    "athlete_permissions",
    "Athlete visibility permissions schema",
    "athlete_permissions",
    [
      "athlete_id",
      "organization_id",
      "can_view_morning_report",
      "can_view_programs",
      "can_view_calendar",
      "can_view_notifications",
      "can_view_rpe_entry",
      "can_view_development_profile",
      "can_view_financial_status",
      "can_view_performance_metrics",
      "can_view_wellness_metrics",
      "can_view_skill_radar",
    ],
    "20260330_athlete_permissions.sql"
  );

  await checkColumns(
    "athlete_programs_lifecycle",
    "Athlete programs lifecycle fields",
    "athlete_programs",
    ["id", "organization_id", "athlete_id", "coach_id", "title", "content", "created_at", "updated_at", "is_read", "is_active", "week_start"],
    "20260330_athlete_programs_lifecycle.sql"
  );

  await checkColumns(
    "attendance_status",
    "Attendance normalization fields",
    "training_participants",
    ["training_id", "profile_id", "attendance_status", "marked_by", "marked_at", "is_present"],
    "20260330_attendance_status_normalization.sql"
  );

  await checkColumns(
    "notifications_ready",
    "Notification readiness",
    "notifications",
    ["id", "user_id", "message", "read", "created_at"],
    "20260331_lessons_notifications_foundation.sql"
  );

  await checkColumns(
    "organizations_ready",
    "Organization base readability",
    "organizations",
    ["id", "name"],
    "core schema"
  );

  await checkColumns(
    "organization_lifecycle",
    "Organization lifecycle & license columns",
    "organizations",
    ["id", "name", "status", "starts_at", "ends_at"],
    "20260403_organization_lifecycle.sql"
  );

  await checkColumns(
    "private_lesson_packages_ready",
    "Private lesson packages schema",
    "private_lesson_packages",
    [
      "id",
      "organization_id",
      "athlete_id",
      "coach_id",
      "package_type",
      "package_name",
      "total_lessons",
      "used_lessons",
      "remaining_lessons",
      "total_price",
      "amount_paid",
      "payment_status",
      "is_active",
      "created_at",
      "updated_at",
    ],
    "20260408_private_lesson_packages.sql"
  );

  await checkColumns(
    "payments_profile_id",
    "Payments table (aidat): owner = profile_id",
    "payments",
    [
      "id",
      "organization_id",
      "profile_id",
      "amount",
      "payment_type",
      "due_date",
      "payment_date",
      "status",
      "total_sessions",
      "remaining_sessions",
      "description",
      "month_name",
      "year_int",
      "created_at",
    ],
    "20260412_payments_profile_id_canonical.sql"
  );

  try {
    const integrity = await scanProfileIntegrity();
    const problems = [
      `missing_profile=${integrity.missingProfileCount}`,
      `orphan_profile=${integrity.orphanProfileCount}`,
      `missing_org=${integrity.missingOrganizationCount}`,
      `invalid_role=${integrity.invalidRoleCount}`,
      `super_admin_role_mismatch=${integrity.superAdminRoleMismatchCount}`,
    ].join(", ");
    const passed =
      integrity.missingProfileCount === 0 &&
      integrity.orphanProfileCount === 0 &&
      integrity.missingOrganizationCount === 0 &&
      integrity.invalidRoleCount === 0 &&
      integrity.superAdminRoleMismatchCount === 0;
    checks.push({
      key: "profiles_integrity",
      title: "Profiles integrity (auth/profile consistency)",
      passed,
      details: passed ? "Auth/Profile butunlugu temiz." : problems,
      migration: "integrity scan / repair script",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Profile integrity scan basarisiz.";
    checks.push({
      key: "profiles_integrity",
      title: "Profiles integrity (auth/profile consistency)",
      passed: false,
      details: message,
      migration: "integrity scan / repair script",
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    overallPassed: checks.every((check) => check.passed),
    checks,
  };
}

const getCachedReport = unstable_cache(async () => runChecksInternal(), ["system-health-report"], {
  revalidate: 60,
  tags: ["system-health-report"],
});

export async function getSystemHealthReport() {
  return getCachedReport();
}

export async function assertCriticalSchemaReady(required: CriticalCheckKey[]) {
  const report = await getCachedReport();
  const failed = report.checks.filter((check) => required.includes(check.key as CriticalCheckKey) && !check.passed);
  if (failed.length === 0) return null;
  return `Sistem health check basarisiz: ${failed.map((f) => `${f.title} (${f.migration})`).join(", ")}`;
}
