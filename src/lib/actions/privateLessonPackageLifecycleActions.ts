"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { getCoachPermissions, hasCoachPermission } from "@/lib/auth/coachPermissions";
import { messageIfAthleteCannotOperate } from "@/lib/athlete/lifecycle";
import { messageIfCoachCannotOperate } from "@/lib/coach/lifecycle";
import { assertCriticalSchemaReady } from "@/lib/diagnostics/systemHealth";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import type { AuditAction } from "@/lib/audit/types";
import { appendPrivateLessonPackageEvent } from "@/lib/privateLessons/appendPrivateLessonPackageEvent";
import { appendOperationalTimeline } from "@/lib/operational/timeline";
import {
  canCancelPackage,
  canFreezePackage,
  canRefundPackage,
  canResumePackage,
  resolvePackageLifecycleStatus,
  type PackageLifecycleStatus,
} from "@/lib/privateLessons/packageStatus";
import { resolveSessionActor, toTenantProfileRow } from "@/lib/auth/resolveSessionActor";
import { withServerActionGuard } from "@/lib/observability/serverActionError";
import {
  getSchemaCapabilities,
  packageLifecycleUpdatePayload,
  runPackageLifecycleProbeWithCompat,
  userFacingDataError,
} from "@/lib/schemaCompat";

type Actor = {
  id: string;
  role: string;
  organization_id: string | null;
  is_active: boolean | null;
};

async function resolvePackageActor(): Promise<{ actor: Actor } | { error: string }> {
  const resolved = await resolveSessionActor();
  if ("error" in resolved) return resolved;
  const row = toTenantProfileRow(resolved.actor);
  const coachBlock = messageIfCoachCannotOperate(row.role, row.is_active);
  if (coachBlock) return { error: coachBlock };
  const athleteBlock = messageIfAthleteCannotOperate(row.role, row.is_active);
  if (athleteBlock) return { error: athleteBlock };
  return { actor: row as Actor };
}

async function assertManagementActor(actor: Actor): Promise<{ ok: true } | { ok: false; error: string }> {
  const role = getSafeRole(actor.role);
  if (role !== "admin" && role !== "coach") return { ok: false, error: "Bu islem icin yetkiniz yok." };
  if (!actor.organization_id) return { ok: false, error: "Organizasyon bilgisi eksik." };
  if (role === "coach") {
    const permissions = await getCoachPermissions(actor.id, actor.organization_id);
    if (!hasCoachPermission(permissions, "can_manage_training_notes")) {
      return { ok: false, error: "Ozel paket yonetimi yetkiniz yok." };
    }
  }
  return { ok: true };
}

type PkgRow = {
  id: string;
  organization_id: string;
  package_name: string;
  is_active: boolean;
  lifecycle_status: string | null;
  remaining_lessons: number;
  total_lessons: number;
  used_lessons: number;
  athlete_id: string;
};

function statusOf(row: PkgRow): PackageLifecycleStatus {
  return resolvePackageLifecycleStatus({
    lifecycleStatus: row.lifecycle_status,
    isActive: Boolean(row.is_active),
    remainingLessons: row.remaining_lessons ?? 0,
    totalLessons: row.total_lessons ?? 0,
    usedLessons: row.used_lessons ?? 0,
  });
}

async function fetchLifecyclePackageRow(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  packageId: string,
  organizationId: string
): Promise<{ row: PkgRow } | { error: string }> {
  const caps = await getSchemaCapabilities();
  const pkgFetch = await runPackageLifecycleProbeWithCompat(caps, async (select) => {
    const { data, error } = await adminClient
      .from("private_lesson_packages")
      .select(select)
      .eq("id", packageId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    return { data, error };
  });
  if (pkgFetch.error || !pkgFetch.data) {
    return { error: userFacingDataError("Paket bulunamadı", pkgFetch.error?.message) };
  }
  return { row: pkgFetch.data as unknown as PkgRow };
}

async function transitionLifecycle(
  packageId: string,
  nextStatus: PackageLifecycleStatus,
  opts: {
    auditAction: AuditAction;
    eventType: string;
    title: string;
    description: string;
    isActive: boolean;
  }
): Promise<{ success: true } | { error: string }> {
  const schemaError = await assertCriticalSchemaReady(["private_lesson_packages_ready"]);
  if (schemaError) return { error: schemaError };

  const resolved = await resolvePackageActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  const guard = await assertManagementActor(actor);
  if (!guard.ok) return { error: guard.error };

  const id = packageId.trim();
  if (!id) return { error: "Paket secimi zorunludur." };

  const adminClient = createSupabaseAdminClient();
  const caps = await getSchemaCapabilities();
  const loaded = await fetchLifecyclePackageRow(adminClient, id, actor.organization_id!);
  if ("error" in loaded) return loaded;
  const row = loaded.row;
  const { error: updErr } = await adminClient
    .from("private_lesson_packages")
    .update(packageLifecycleUpdatePayload(caps, nextStatus, opts.isActive))
    .eq("id", id)
    .eq("organization_id", actor.organization_id!);
  if (updErr) return { error: `Paket guncellenemedi: ${updErr.message}` };

  try {
    await logAuditEvent({
      organizationId: actor.organization_id!,
      actorUserId: actor.id,
      actorRole: actor.role,
      action: opts.auditAction,
      entityType: "private_lesson_package",
      entityId: id,
      metadata: { packageName: row.package_name, previousStatus: statusOf(row), nextStatus },
    });
  } catch {
    /* audit best-effort */
  }

  await appendPrivateLessonPackageEvent(adminClient, {
    packageId: id,
    organizationId: actor.organization_id!,
    actorId: actor.id,
    eventType: opts.eventType,
    title: opts.title,
    description: opts.description,
    metadata: { previousStatus: statusOf(row), nextStatus },
  });

  await appendOperationalTimeline(adminClient, {
    organizationId: actor.organization_id,
    eventType: opts.auditAction,
    summary: `${row.package_name}: ${opts.title}`,
    payload: { packageId: id, nextStatus },
    actorUserId: actor.id,
  });

  revalidatePath("/ozel-ders-paketleri");
  revalidatePath(`/ozel-ders-paketleri/${id}`);
  revalidatePath(`/sporcu/${row.athlete_id}`);
  revalidatePath("/muhasebe-finans");
  return { success: true as const };
}

export async function freezePrivateLessonPackage(packageId: string) {
  return withServerActionGuard("privateLesson.freezePrivateLessonPackage", async () => {
    const adminClient = createSupabaseAdminClient();
    const resolved = await resolvePackageActor();
    if ("error" in resolved) return { error: resolved.error };
    const { actor } = resolved;
    const guard = await assertManagementActor(actor);
    if (!guard.ok) return { error: guard.error };

    const id = packageId.trim();
    const loaded = await fetchLifecyclePackageRow(adminClient, id, actor.organization_id!);
    if ("error" in loaded) return loaded;
    const current = statusOf(loaded.row);
    if (!canFreezePackage(current)) return { error: "Bu paket dondurulamaz." };

    return transitionLifecycle(id, "paused", {
      auditAction: "private_lesson_package.freeze",
      eventType: "package_paused",
      title: "Paket donduruldu",
      description: "Paket operasyonel olarak duraklatıldı; ders kullanımı ve planlama kapalı.",
      isActive: false,
    });
  });
}

export async function resumePrivateLessonPackage(packageId: string) {
  return withServerActionGuard("privateLesson.resumePrivateLessonPackage", async () => {
    const adminClient = createSupabaseAdminClient();
    const resolved = await resolvePackageActor();
    if ("error" in resolved) return { error: resolved.error };
    const { actor } = resolved;
    const guard = await assertManagementActor(actor);
    if (!guard.ok) return { error: guard.error };

    const id = packageId.trim();
    const loaded = await fetchLifecyclePackageRow(adminClient, id, actor.organization_id!);
    if ("error" in loaded) return loaded;
    const current = statusOf(loaded.row);
    if (!canResumePackage(current)) return { error: "Bu paket yeniden aktif edilemez." };
    if ((loaded.row.remaining_lessons ?? 0) <= 0) return { error: "Kalan ders hakkı olmayan paket aktif edilemez." };

    return transitionLifecycle(id, "active", {
      auditAction: "private_lesson_package.resume",
      eventType: "package_resumed",
      title: "Paket yeniden aktif",
      description: "Paket tekrar aktif; planlama ve kullanım açıldı.",
      isActive: true,
    });
  });
}

export async function cancelPrivateLessonPackage(packageId: string, reason?: string | null) {
  return withServerActionGuard("privateLesson.cancelPrivateLessonPackage", async () => {
    const adminClient = createSupabaseAdminClient();
    const resolved = await resolvePackageActor();
    if ("error" in resolved) return { error: resolved.error };
    const { actor } = resolved;
    const guard = await assertManagementActor(actor);
    if (!guard.ok) return { error: guard.error };

    const id = packageId.trim();
    const { data: pkg } = await adminClient
      .from("private_lesson_packages")
      .select(
        "id, organization_id, package_name, is_active, lifecycle_status, remaining_lessons, total_lessons, used_lessons, athlete_id"
      )
      .eq("id", id)
      .eq("organization_id", actor.organization_id!)
      .maybeSingle();
    if (!pkg) return { error: "Paket bulunamadi." };
    const current = statusOf(pkg as PkgRow);
    if (!canCancelPackage(current)) return { error: "Bu paket iptal edilemez." };

    const note = reason?.trim() || null;
    const result = await transitionLifecycle(id, "cancelled", {
      auditAction: "private_lesson_package.cancel",
      eventType: "package_cancelled",
      title: "Paket iptal edildi",
      description: note || "Paket iptal edildi; yeni ödeme ve ders işlemi yapılamaz.",
      isActive: false,
    });
    return result;
  });
}

export async function refundPrivateLessonPackage(packageId: string, reason?: string | null) {
  return withServerActionGuard("privateLesson.refundPrivateLessonPackage", async () => {
    const adminClient = createSupabaseAdminClient();
    const resolved = await resolvePackageActor();
    if ("error" in resolved) return { error: resolved.error };
    const { actor } = resolved;
    const guard = await assertManagementActor(actor);
    if (!guard.ok) return { error: guard.error };

    const id = packageId.trim();
    const loaded = await fetchLifecyclePackageRow(adminClient, id, actor.organization_id!);
    if ("error" in loaded) return loaded;
    const current = statusOf(loaded.row);
    if (!canRefundPackage(current)) return { error: "Bu paket iade edilemez." };
    if (current === "refunded") return { error: "Paket zaten iade edilmiş." };

    const note = reason?.trim() || null;
    return transitionLifecycle(id, "refunded", {
      auditAction: "private_lesson_package.refund",
      eventType: "package_refunded",
      title: "Paket iade edildi",
      description: note || "Paket finansal olarak kapatıldı; yeni işlem yapılamaz.",
      isActive: false,
    });
  });
}
