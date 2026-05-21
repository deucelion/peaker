import type { PrivateLessonPaymentStatus } from "@/lib/types";
import { resolvePackageLifecycleStatus, type PackageLifecycleStatus } from "@/lib/privateLessons/packageStatus";
import { toDisplayName } from "@/lib/profile/displayName";
import type { SchemaCapabilities } from "@/lib/schemaCompat/capabilities";
import { isMissingColumnError } from "@/lib/schemaCompat/errors";
import { reportSchemaCompatFallback } from "@/lib/schemaCompat/telemetry";
import type { PrivateLessonPackage } from "@/lib/types";

const PACKAGE_PROFILE_JOINS =
  ", athlete_profile:profiles!private_lesson_packages_athlete_id_fkey(full_name, email), coach_profile:profiles!private_lesson_packages_coach_id_fkey(full_name, email)";

const PACKAGE_CORE =
  "id, organization_id, athlete_id, coach_id, package_type, package_name, total_lessons, used_lessons, remaining_lessons, total_price, amount_paid, payment_status, is_active, created_at, updated_at";

/** Liste / detay SELECT — migration durumuna göre. */
export function buildPrivateLessonPackageSelect(caps: SchemaCapabilities): string {
  let cols = PACKAGE_CORE;
  if (caps.packages.lifecycleStatus) cols += ", lifecycle_status";
  if (caps.packages.installmentFields) {
    cols += ", installment_count, installment_interval_days, next_payment_due_at";
  }
  return cols + PACKAGE_PROFILE_JOINS;
}

/** Minimal SELECT (retry). */
export function buildPrivateLessonPackageSelectLegacy(): string {
  return PACKAGE_CORE + PACKAGE_PROFILE_JOINS;
}

export type RawPackageRow = {
  id: string;
  organization_id: string;
  athlete_id: string;
  coach_id: string | null;
  package_type: string;
  package_name: string;
  total_lessons: number;
  used_lessons: number;
  remaining_lessons: number;
  total_price: number;
  amount_paid: number;
  payment_status: PrivateLessonPaymentStatus;
  is_active: boolean;
  lifecycle_status?: string | null;
  installment_count?: number | null;
  installment_interval_days?: number | null;
  next_payment_due_at?: string | null;
  created_at: string;
  updated_at: string;
  athlete_profile?: { full_name?: string | null; email?: string | null } | { full_name?: string | null; email?: string | null }[] | null;
  coach_profile?: { full_name?: string | null; email?: string | null } | { full_name?: string | null; email?: string | null }[] | null;
};

export function mapPackageRowCompat(raw: RawPackageRow): PrivateLessonPackage {
  const athlete = Array.isArray(raw.athlete_profile) ? raw.athlete_profile[0] : raw.athlete_profile;
  const coach = Array.isArray(raw.coach_profile) ? raw.coach_profile[0] : raw.coach_profile;
  return {
    id: raw.id,
    organizationId: raw.organization_id,
    athleteId: raw.athlete_id,
    athleteName: toDisplayName(athlete?.full_name, athlete?.email, "Sporcu"),
    coachId: raw.coach_id,
    coachName: coach ? toDisplayName(coach?.full_name, coach?.email, "Koc") : null,
    packageType: raw.package_type,
    packageName: raw.package_name,
    totalLessons: raw.total_lessons,
    usedLessons: raw.used_lessons,
    remainingLessons: raw.remaining_lessons,
    totalPrice: Number(raw.total_price) || 0,
    amountPaid: Number(raw.amount_paid) || 0,
    paymentStatus: raw.payment_status,
    isActive: raw.is_active,
    lifecycleStatus: resolvePackageLifecycleStatus({
      lifecycleStatus: raw.lifecycle_status,
      isActive: raw.is_active,
      remainingLessons: raw.remaining_lessons,
      totalLessons: raw.total_lessons,
      usedLessons: raw.used_lessons,
    }),
    installmentCount: raw.installment_count != null ? Number(raw.installment_count) : null,
    installmentIntervalDays:
      raw.installment_interval_days != null ? Number(raw.installment_interval_days) : null,
    nextPaymentDueAt: raw.next_payment_due_at ?? null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export function packageLifecycleUpdatePayload(
  caps: SchemaCapabilities,
  nextStatus: PackageLifecycleStatus,
  isActive: boolean
): Record<string, unknown> {
  const u: Record<string, unknown> = { is_active: isActive, updated_at: new Date().toISOString() };
  if (caps.packages.lifecycleStatus) u.lifecycle_status = nextStatus;
  return u;
}

export function packageCompletedUpdatePayload(
  caps: SchemaCapabilities,
  nextRemaining: number
): Record<string, unknown> {
  if (nextRemaining > 0) return {};
  return packageLifecycleUpdatePayload(caps, "completed", false);
}

export type PackageQueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
  usedCompatFallback: boolean;
};

/** PostgREST query builder ile uyumlu: `.select(build...).` zincirine uygulanır. */
export async function runPackageSelectWithCompat<T>(
  caps: SchemaCapabilities,
  run: (select: string) => Promise<{ data: T | null; error: { message: string } | null }>
): Promise<PackageQueryResult<T>> {
  return runCompatSelectWithFallback(
    buildPrivateLessonPackageSelect,
    buildPrivateLessonPackageSelectLegacy,
    caps,
    run,
    "private_lesson_packages.select"
  );
}

/** Alacak / lifecycle probe / session planlama için dar SELECT. */
export function buildPackageLifecycleProbeSelect(caps: SchemaCapabilities): string {
  const base =
    "id, organization_id, athlete_id, coach_id, is_active, remaining_lessons, total_lessons, used_lessons, package_name";
  if (caps.packages.lifecycleStatus) return `${base}, lifecycle_status`;
  return base;
}

export function buildPackagePaymentGuardSelect(caps: SchemaCapabilities): string {
  const base = "id, is_active, remaining_lessons, total_lessons, used_lessons, amount_paid, total_price";
  if (caps.packages.lifecycleStatus) return `${base}, lifecycle_status`;
  return base;
}

export function buildPackagePaymentGuardSelectLegacy(): string {
  return "id, is_active, remaining_lessons, total_lessons, used_lessons, amount_paid, total_price";
}

export async function runPackagePaymentGuardWithCompat<T>(
  caps: SchemaCapabilities,
  run: (select: string) => Promise<{ data: T | null; error: { message: string } | null }>
): Promise<PackageQueryResult<T>> {
  return runCompatSelectWithFallback(
    buildPackagePaymentGuardSelect,
    buildPackagePaymentGuardSelectLegacy,
    caps,
    run,
    "private_lesson_packages.payment_guard"
  );
}

const RECEIVABLE_PKG_CORE =
  "id, package_name, athlete_id, total_price, amount_paid, payment_status, is_active, created_at";

export function buildReceivablePackageSelect(caps: SchemaCapabilities): string {
  let cols = RECEIVABLE_PKG_CORE;
  if (caps.packages.lifecycleStatus) cols += ", lifecycle_status";
  if (caps.packages.installmentFields) cols += ", next_payment_due_at";
  return (
    cols +
    ", athlete_profile:profiles!private_lesson_packages_athlete_id_fkey(full_name, email, team)"
  );
}

export function buildReceivablePackageSelectLegacy(): string {
  return (
    RECEIVABLE_PKG_CORE +
    ", athlete_profile:profiles!private_lesson_packages_athlete_id_fkey(full_name, email, team)"
  );
}

export async function runCompatSelectWithFallback<T>(
  buildPrimary: (caps: SchemaCapabilities) => string,
  buildLegacy: () => string,
  caps: SchemaCapabilities,
  run: (select: string) => Promise<{ data: T | null; error: { message: string } | null }>,
  telemetryTag: string
): Promise<PackageQueryResult<T>> {
  const primarySelect = buildPrimary(caps);
  let res = await run(primarySelect);
  if (!res.error) return { ...res, usedCompatFallback: false };

  if (isMissingColumnError(res.error.message)) {
    reportSchemaCompatFallback(telemetryTag, { message: res.error.message });
    res = await run(buildLegacy());
    return { ...res, usedCompatFallback: true };
  }
  return { ...res, usedCompatFallback: false };
}

export async function runReceivablePackageSelectWithCompat<T>(
  caps: SchemaCapabilities,
  run: (select: string) => Promise<{ data: T | null; error: { message: string } | null }>
): Promise<PackageQueryResult<T>> {
  return runCompatSelectWithFallback(
    buildReceivablePackageSelect,
    buildReceivablePackageSelectLegacy,
    caps,
    run,
    "private_lesson_packages.receivable_select"
  );
}

const PACKAGE_LIFECYCLE_PROBE_LEGACY =
  "id, organization_id, athlete_id, coach_id, is_active, remaining_lessons, total_lessons, used_lessons, package_name";

export function buildPackageLifecycleProbeSelectLegacy(): string {
  return PACKAGE_LIFECYCLE_PROBE_LEGACY;
}

export async function runPackageLifecycleProbeWithCompat<T>(
  caps: SchemaCapabilities,
  run: (select: string) => Promise<{ data: T | null; error: { message: string } | null }>
): Promise<PackageQueryResult<T>> {
  return runCompatSelectWithFallback(
    buildPackageLifecycleProbeSelect,
    buildPackageLifecycleProbeSelectLegacy,
    caps,
    run,
    "private_lesson_packages.probe"
  );
}
