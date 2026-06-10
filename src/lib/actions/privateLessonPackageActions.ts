"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { getCoachPermissions, hasCoachPermission } from "@/lib/auth/coachPermissions";
import { messageIfAthleteCannotOperate } from "@/lib/athlete/lifecycle";
import { messageIfCoachCannotOperate } from "@/lib/coach/lifecycle";
import { assertCriticalSchemaReady } from "@/lib/diagnostics/systemHealth";
import { insertNotificationsForUsers } from "@/lib/notifications/serverInsert";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { appendPrivateLessonPackageEvent } from "@/lib/privateLessons/appendPrivateLessonPackageEvent";
import { assertValidTRYMoneyAmount, calculatePackageFinanceSummary } from "@/lib/privateLessons/packageFinance";
import { computePaymentStatus, normalizeMoney, parseTRYMoneyInput } from "@/lib/privateLessons/packageMath";
import { parseInstallmentFieldsFromForm } from "@/lib/privateLessons/parseInstallmentFields";
import {
  packageAllowsCoreEdit,
  packageAllowsPayment,
  packageAllowsUsage,
  resolveLifecycleAfterCoreUpdate,
  resolvePackageLifecycleStatus,
} from "@/lib/privateLessons/packageStatus";
import { buildPackageUsageLessonRows } from "@/lib/privateLessons/packageUsageLessonRows";
import {
  getSchemaCapabilities,
  mapPackageRowCompat,
  runPackageSelectWithCompat,
  runPackageLifecycleProbeWithCompat,
  runPackagePaymentGuardWithCompat,
  packageCompletedUpdatePayload,
  packageLifecycleUpdatePayload,
  applyPrivateLessonPaymentActiveFilter,
  userFacingDataError,
  type RawPackageRow,
} from "@/lib/schemaCompat";
import { appendOperationalTimeline } from "@/lib/operational/timeline";
import {
  applyPrivateLessonPackagePaymentWithPaymentRow,
  paymentBookkeepingFromPaidAtIso,
} from "@/lib/privateLessons/packagePaymentSync";
import { resolveOrganizationTimeZone } from "@/lib/organization/timeZone";
import type {
  PrivateLessonPackage,
  PrivateLessonPackageDetailSnapshot,
  PrivateLessonPackageEventRow,
  PrivateLessonPayment,
  PrivateLessonUsage,
} from "@/lib/types";
import { toDisplayName } from "@/lib/profile/displayName";
import { resolveSessionActor, toTenantProfileRow } from "@/lib/auth/resolveSessionActor";
import { withServerActionGuard } from "@/lib/observability/serverActionError";
import { captureServerActionSignal } from "@/lib/observability/serverActionError";

type Actor = {
  id: string;
  role: string;
  organization_id: string | null;
  is_active: boolean | null;
};

function mapPackage(raw: RawPackageRow): PrivateLessonPackage {
  return mapPackageRowCompat(raw);
}

async function markPackageCompletedIfNeeded(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  packageId: string,
  organizationId: string,
  nextRemaining: number
): Promise<void> {
  if (nextRemaining > 0) return;
  const caps = await getSchemaCapabilities();
  const payload = packageCompletedUpdatePayload(caps, nextRemaining);
  if (!Object.keys(payload).length) return;
  await adminClient
    .from("private_lesson_packages")
    .update(payload)
    .eq("id", packageId)
    .eq("organization_id", organizationId);
}

type PackageListResult = { packages: PrivateLessonPackage[]; schemaWarnings?: string[] } | { error: string };

async function fetchPackageList(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  buildQuery: (
    select: string
  ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<PackageListResult> {
  const caps = await getSchemaCapabilities();
  const result = await runPackageSelectWithCompat(caps, async (select) => {
    const { data, error } = await buildQuery(select);
    return { data, error };
  });
  if (result.error) {
    return { error: userFacingDataError("Paketler alınamadı", result.error.message) };
  }
  const warnings =
    result.usedCompatFallback || caps.driftWarnings.length ? [...caps.driftWarnings] : undefined;
  return {
    packages: ((result.data || []) as RawPackageRow[]).map((row) => mapPackage(row)),
    schemaWarnings: warnings,
  };
}

function mapPaymentRow(raw: {
  id: string;
  package_id: string;
  athlete_id: string;
  coach_id: string | null;
  amount: number;
  paid_at: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}): PrivateLessonPayment {
  return {
    id: raw.id,
    packageId: raw.package_id,
    athleteId: raw.athlete_id,
    coachId: raw.coach_id,
    amount: normalizeMoney(raw.amount),
    paidAt: raw.paid_at,
    note: raw.note,
    createdBy: raw.created_by,
    createdAt: raw.created_at,
  };
}

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

export async function listPrivateLessonPackagesForManagement(): Promise<
  { packages: PrivateLessonPackage[]; schemaWarnings?: string[] } | { error: string }
> {
  const schemaError = await assertCriticalSchemaReady(["private_lesson_packages_ready", "coach_permissions"]);
  if (schemaError) return { error: schemaError };

  const resolved = await resolvePackageActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  const guard = await assertManagementActor(actor);
  if (!guard.ok) return { error: guard.error };
  const role = getSafeRole(actor.role);

  const adminClient = createSupabaseAdminClient();
  return fetchPackageList(adminClient, async (select) => {
    let packagesQuery = adminClient
      .from("private_lesson_packages")
      .select(select)
      .eq("organization_id", actor.organization_id!)
      .order("created_at", { ascending: false });
    if (role === "coach") {
      const permissions = await getCoachPermissions(actor.id, actor.organization_id!);
      if (!permissions.can_view_all_organization_lessons) {
        packagesQuery = packagesQuery.eq("coach_id", actor.id);
      }
    }
    return packagesQuery;
  });
}

export async function listPrivateLessonPackagesForAthlete(): Promise<
  { packages: PrivateLessonPackage[] } | { error: string }
> {
  const schemaError = await assertCriticalSchemaReady(["private_lesson_packages_ready", "athlete_permissions"]);
  if (schemaError) return { error: schemaError };

  const resolved = await resolvePackageActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  if (getSafeRole(actor.role) !== "sporcu") {
    return { error: "Bu sayfa yalnizca sporcular icindir." };
  }
  if (!actor.organization_id) return { error: "Organizasyon bilgisi eksik." };

  const adminClient = createSupabaseAdminClient();
  return fetchPackageList(adminClient, async (select) =>
    adminClient
      .from("private_lesson_packages")
      .select(select)
      .eq("organization_id", actor.organization_id)
      .eq("athlete_id", actor.id)
      .order("created_at", { ascending: false })
  );
}

export async function listPrivateLessonPackagesForAthleteId(
  athleteId: string
): Promise<{ packages: PrivateLessonPackage[] } | { error: string }> {
  const schemaError = await assertCriticalSchemaReady(["private_lesson_packages_ready", "coach_permissions"]);
  if (schemaError) return { error: schemaError };

  const resolved = await resolvePackageActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  const guard = await assertManagementActor(actor);
  if (!guard.ok) return { error: guard.error };
  const role = getSafeRole(actor.role);

  const id = athleteId.trim();
  if (!id) return { error: "Sporcu seçimi zorunludur." };

  const adminClient = createSupabaseAdminClient();
  const { data: athlete } = await adminClient
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", id)
    .eq("organization_id", actor.organization_id!)
    .maybeSingle();
  if (!athlete || getSafeRole(athlete.role) !== "sporcu") return { error: "Sporcu bulunamadı." };

  return fetchPackageList(adminClient, async (select) => {
    let packagesQuery = adminClient
      .from("private_lesson_packages")
      .select(select)
      .eq("organization_id", actor.organization_id!)
      .eq("athlete_id", id)
      .order("created_at", { ascending: false });
    if (role === "coach") {
      const permissions = await getCoachPermissions(actor.id, actor.organization_id!);
      if (!permissions.can_view_all_organization_lessons) {
        packagesQuery = packagesQuery.eq("coach_id", actor.id);
      }
    }
    return packagesQuery;
  });
}

/** Faz 17 — Mevcut sporcuya paket tanımlama (createPrivateLessonPackage ile aynı). */
export async function createPrivateLessonPackageForAthlete(formData: FormData) {
  return createPrivateLessonPackage(formData);
}

export async function listPrivateLessonFormOptions(): Promise<
  {
    athletes: Array<{ id: string; full_name: string }>;
    coaches: Array<{ id: string; full_name: string }>;
    viewerRole: "admin" | "coach";
    viewerId: string;
  } | { error: string }
> {
  const resolved = await resolvePackageActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  const role = getSafeRole(actor.role);
  const guard = await assertManagementActor(actor);
  if (!guard.ok) return { error: guard.error };
  const canViewAllOrganizationLessons =
    role !== "coach" || (await getCoachPermissions(actor.id, actor.organization_id!)).can_view_all_organization_lessons;

  const adminClient = createSupabaseAdminClient();
  const [athletesRes, coachesRes] = await Promise.all([
    adminClient
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("organization_id", actor.organization_id!)
      .order("full_name"),
    adminClient
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("organization_id", actor.organization_id!)
      .order("full_name"),
  ]);

  if (athletesRes.error || coachesRes.error) {
    return { error: `Form verisi alinamadi: ${athletesRes.error?.message || coachesRes.error?.message}` };
  }

  const athletes = (athletesRes.data || [])
    .filter((row) => getSafeRole(row.role) === "sporcu")
    .map((row) => ({ id: row.id, full_name: toDisplayName(row.full_name, row.email, "Sporcu") }));
  const coaches = (coachesRes.data || [])
    .filter((row) => getSafeRole(row.role) === "coach")
    .filter((row) => canViewAllOrganizationLessons || row.id === actor.id)
    .map((row) => ({ id: row.id, full_name: toDisplayName(row.full_name, row.email, "Koc") }));

  return { athletes, coaches, viewerRole: role as "admin" | "coach", viewerId: actor.id };
}

export async function createPrivateLessonPackage(formData: FormData) {
  return withServerActionGuard("privateLesson.createPrivateLessonPackage", async () => {
  const schemaError = await assertCriticalSchemaReady(["private_lesson_packages_ready", "coach_permissions"]);
  if (schemaError) return { error: schemaError };

  const resolved = await resolvePackageActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  const guard = await assertManagementActor(actor);
  if (!guard.ok) return { error: guard.error };

  const athleteId = formData.get("athleteId")?.toString().trim() || "";
  const coachIdInput = formData.get("coachId")?.toString().trim() || "";
  const packageType = formData.get("packageType")?.toString().trim() || "";
  const packageName = formData.get("packageName")?.toString().trim() || "";
  const totalLessons = Math.floor(Number(formData.get("totalLessons")?.toString() || "0"));
  const totalPrice = parseTRYMoneyInput(formData.get("totalPrice")?.toString());
  const initialPayment = parseTRYMoneyInput(formData.get("amountPaid")?.toString() || "0") ?? 0;
  const role = getSafeRole(actor.role);

  if (!athleteId || !packageType || !packageName) return { error: "Sporcu, paket tipi ve paket adi zorunludur." };
  if (!Number.isFinite(totalLessons) || totalLessons <= 0) return { error: "Toplam ders sayisi 1 veya daha buyuk olmali." };
  if (totalPrice == null || totalPrice <= 0) return { error: "Toplam ücret geçerli ve sıfırdan büyük olmalıdır." };
  const totalPriceValid = assertValidTRYMoneyAmount(totalPrice, "Toplam ücret");
  if (!totalPriceValid.ok) return { error: totalPriceValid.error };
  if (initialPayment > 0) {
    const initialValid = assertValidTRYMoneyAmount(initialPayment, "İlk ödeme");
    if (!initialValid.ok) return { error: initialValid.error };
  }
  if (initialPayment < 0 || initialPayment > totalPriceValid.amount) {
    return { error: "İlk ödeme negatif olamaz ve toplam ücreti aşamaz." };
  }

  const installmentParsed = parseInstallmentFieldsFromForm(formData);
  if ("error" in installmentParsed) return { error: installmentParsed.error };

  const adminClient = createSupabaseAdminClient();

  const { data: athlete } = await adminClient
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", athleteId)
    .eq("organization_id", actor.organization_id!)
    .maybeSingle();
  if (!athlete || getSafeRole(athlete.role) !== "sporcu") return { error: "Sporcu bulunamadi." };

  let coachId: string | null = null;
  if (coachIdInput) {
    if (role === "coach" && coachIdInput !== actor.id) {
      return { error: "Koç kullanıcı yalnızca kendisine paket atayabilir." };
    }
    const { data: coachProfile } = await adminClient
      .from("profiles")
      .select("id, role, organization_id")
      .eq("id", coachIdInput)
      .eq("organization_id", actor.organization_id!)
      .maybeSingle();
    if (!coachProfile || getSafeRole(coachProfile.role) !== "coach") {
      return { error: "Secilen koc bulunamadi." };
    }
    coachId = coachProfile.id;
  } else if (role === "coach") {
    coachId = actor.id;
  }

  const caps = await getSchemaCapabilities();
  const insertPayload: Record<string, unknown> = {
    organization_id: actor.organization_id,
    athlete_id: athleteId,
    coach_id: coachId,
    package_type: packageType,
    package_name: packageName,
    total_lessons: totalLessons,
    used_lessons: 0,
    remaining_lessons: totalLessons,
    total_price: totalPriceValid.amount,
    amount_paid: 0,
    payment_status: "unpaid",
    is_active: true,
    created_by: actor.id,
  };
  if (caps.packages.lifecycleStatus) insertPayload.lifecycle_status = "active";
  if (caps.packages.installmentFields) {
    insertPayload.installment_count = installmentParsed.installmentCount;
    insertPayload.installment_interval_days = installmentParsed.installmentIntervalDays;
    insertPayload.next_payment_due_at = installmentParsed.nextPaymentDueAt;
  }

  const { data: insertedRow, error } = await adminClient
    .from("private_lesson_packages")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error || !insertedRow?.id) return { error: `Paket olusturulamadi: ${error?.message || "unknown"}` };

  const packageId = insertedRow.id as string;
  let paymentStatus = computePaymentStatus(totalPriceValid.amount, 0);

  if (initialPayment > 0) {
    const paidAt = new Date().toISOString();
    const orgTimeZone = await resolveOrganizationTimeZone(actor.organization_id!);
    const { dueDateKey, monthName, yearInt } = paymentBookkeepingFromPaidAtIso(paidAt, orgTimeZone);
    const sync = await applyPrivateLessonPackagePaymentWithPaymentRow({
      organizationId: actor.organization_id!,
      packageId,
      athleteProfileId: athleteId,
      amount: initialPayment,
      paidAtIso: paidAt,
      dueDateKey,
      monthName,
      yearInt,
      rpcActorProfileId: actor.id,
      paymentsDescription: "Paket oluşturma — ilk tahsilat",
      rpcNote: "Paket oluşturma — ilk tahsilat",
    });
    if (!sync.ok) {
      await adminClient.from("private_lesson_packages").delete().eq("id", packageId);
      return { error: sync.error };
    }
    paymentStatus = sync.paymentStatus;
  }

  try {
    await logAuditEvent({
      organizationId: actor.organization_id,
      actorUserId: actor.id,
      actorRole: actor.role,
      action: "private_lesson_package.create",
      entityType: "private_lesson_package",
      entityId: packageId,
      metadata: {
        athleteId,
        coachId,
        packageName,
        totalLessons,
        totalPrice,
        initialPayment,
        paymentStatus,
      },
    });
  } catch {
    /* audit best-effort */
  }

  await appendPrivateLessonPackageEvent(adminClient, {
    packageId,
    organizationId: actor.organization_id!,
    actorId: actor.id,
    eventType: "package_created",
    title: "Paket oluşturuldu",
    description: `${packageName} — ${totalLessons} ders, ₺${totalPriceValid.amount}`,
    metadata: { totalLessons, totalPrice: totalPriceValid.amount, initialPayment },
  });

  if (initialPayment > 0) {
    await appendPrivateLessonPackageEvent(adminClient, {
      packageId,
      organizationId: actor.organization_id!,
      actorId: actor.id,
      eventType: "payment_added",
      title: "İlk ödeme alındı",
      description: `₺${initialPayment}`,
      metadata: { amount: initialPayment },
    });
  }

  try {
    await insertNotificationsForUsers(
      [athleteId],
      `Ozel ders paketi: "${packageName}" (${totalLessons} ders). Odeme durumu: ${paymentStatus}.`,
      "package.created"
    );
  } catch {
    /* bildirim tablosu yoksa ana akisi bozma */
  }

  revalidatePath("/ozel-ders-paketleri");
  revalidatePath("/ozel-ders-paketlerim");
  revalidatePath(`/sporcu/${athleteId}`);
  revalidatePath("/muhasebe-finans");
  revalidatePath("/finans");
  return { success: true as const, packageId };
  });
}

export async function updatePrivateLessonPackageCore(formData: FormData) {
  return withServerActionGuard("privateLesson.updatePrivateLessonPackageCore", async () => {
    const schemaError = await assertCriticalSchemaReady(["private_lesson_packages_ready", "coach_permissions"]);
    if (schemaError) return { error: schemaError };

    const resolved = await resolvePackageActor();
    if ("error" in resolved) return { error: resolved.error };
    const { actor } = resolved;
    const guard = await assertManagementActor(actor);
    if (!guard.ok) return { error: guard.error };

    const role = getSafeRole(actor.role);
    const packageId = formData.get("packageId")?.toString().trim() || "";
    const packageName = formData.get("packageName")?.toString().trim() || "";
    const coachIdInput = formData.get("coachId")?.toString().trim() || "";
    const totalLessons = Math.floor(Number(formData.get("totalLessons")?.toString() || "0"));
    const totalPriceParsed = parseTRYMoneyInput(formData.get("totalPrice")?.toString());
    const isActiveInput = formData.get("isActive")?.toString().trim() || "true";
    const isActive = isActiveInput === "true";

    if (!packageId) return { error: "Paket secimi zorunludur." };
    if (!packageName) return { error: "Paket adi zorunludur." };
    if (!Number.isFinite(totalLessons) || totalLessons <= 0) return { error: "Toplam ders sayisi pozitif tamsayi olmalidir." };
    if (totalPriceParsed == null || totalPriceParsed < 0) return { error: "Toplam ücret geçerli olmalıdır." };
    const totalPriceCheck = assertValidTRYMoneyAmount(totalPriceParsed, "Toplam ücret");
    if (!totalPriceCheck.ok) return { error: totalPriceCheck.error };
    const totalPrice = totalPriceCheck.amount;

    const installmentParsed = parseInstallmentFieldsFromForm(formData);
    if ("error" in installmentParsed) return { error: installmentParsed.error };

    const adminClient = createSupabaseAdminClient();
    const { data: pkg, error: pkgErr } = await adminClient
      .from("private_lesson_packages")
      .select(
        "id, organization_id, athlete_id, package_type, coach_id, package_name, used_lessons, total_lessons, remaining_lessons, total_price, amount_paid, is_active"
      )
      .eq("id", packageId)
      .eq("organization_id", actor.organization_id!)
      .maybeSingle();

    if (pkgErr || !pkg) return { error: "Paket bulunamadi." };

    if (totalLessons < (pkg.used_lessons || 0)) {
      return { error: "Toplam ders sayisi kullanilan ders sayisindan kucuk olamaz." };
    }
    if (totalPrice < normalizeMoney(pkg.amount_paid || 0)) {
      return { error: "Toplam ucret, odenen tutardan kucuk olamaz." };
    }

    let coachId: string | null = null;
    if (role === "coach") {
      if (coachIdInput && coachIdInput !== actor.id) {
        return { error: "Koç kullanıcı yalnızca kendisine paket atayabilir." };
      }
      coachId = actor.id;
    } else {
      if (coachIdInput) {
        const { data: coachProfile } = await adminClient
          .from("profiles")
          .select("id, role, organization_id")
          .eq("id", coachIdInput)
          .eq("organization_id", actor.organization_id!)
          .maybeSingle();
        if (!coachProfile || getSafeRole(coachProfile.role) !== "coach") {
          return { error: "Secilen koc bulunamadi." };
        }
        coachId = coachProfile.id;
      } else {
        coachId = null;
      }
    }

    if (!isActive) {
      const sessionsSchemaError = await assertCriticalSchemaReady(["private_lesson_sessions_ready"]);
      if (!sessionsSchemaError) {
        const { count: plannedCount, error: plannedErr } = await adminClient
          .from("private_lesson_sessions")
          .select("id", { count: "exact", head: true })
          .eq("package_id", packageId)
          .eq("organization_id", actor.organization_id!)
          .eq("status", "planned");
        if (plannedErr) return { error: `Plan kontrolu basarisiz: ${plannedErr.message}` };
        if ((plannedCount || 0) > 0) return { error: "Açık planlı oturum varken paket pasife alınamaz." };
      }
    }

    const nextRemaining = totalLessons - (pkg.used_lessons || 0);
    const nextPaymentStatus = computePaymentStatus(totalPrice, normalizeMoney(pkg.amount_paid || 0));
    const currentLifecycle = resolvePackageLifecycleStatus({
      lifecycleStatus: (pkg as { lifecycle_status?: string }).lifecycle_status,
      isActive: Boolean(pkg.is_active),
      remainingLessons: pkg.remaining_lessons ?? 0,
      totalLessons: pkg.total_lessons ?? 0,
      usedLessons: pkg.used_lessons ?? 0,
    });
    if (!packageAllowsCoreEdit(currentLifecycle)) {
      return { error: "İptal edilmiş veya iade edilmiş paket düzenlenemez." };
    }
    const nextLifecycle = resolveLifecycleAfterCoreUpdate({
      current: currentLifecycle,
      isActiveRequested: isActive,
      nextRemaining,
    });
    const nextIsActive = nextLifecycle === "active";

    const caps = await getSchemaCapabilities();
    const updatePayload: Record<string, unknown> = {
      package_name: packageName,
      coach_id: coachId,
      total_lessons: totalLessons,
      total_price: totalPrice,
      is_active: nextIsActive,
      remaining_lessons: nextRemaining,
      payment_status: nextPaymentStatus,
      updated_at: new Date().toISOString(),
      ...packageLifecycleUpdatePayload(caps, nextLifecycle, nextIsActive),
    };
    if (caps.packages.installmentFields) {
      updatePayload.installment_count = installmentParsed.installmentCount;
      updatePayload.installment_interval_days = installmentParsed.installmentIntervalDays;
      updatePayload.next_payment_due_at = installmentParsed.nextPaymentDueAt;
    }
    const { error: updateErr } = await adminClient
      .from("private_lesson_packages")
      .update(updatePayload)
      .eq("id", packageId)
      .eq("organization_id", actor.organization_id!);
    if (updateErr) return { error: userFacingDataError("Paket güncellenemedi", updateErr.message) };

    try {
      await logAuditEvent({
        organizationId: actor.organization_id,
        actorUserId: actor.id,
        actorRole: actor.role,
        action: "private_lesson_package.update",
        entityType: "private_lesson_package",
        entityId: packageId,
        metadata: {
          packageName,
          totalLessons,
          totalPrice,
          isActive: nextIsActive,
          lifecycle: nextLifecycle,
          coachId,
          previous: {
            package_name: pkg.package_name,
            total_lessons: pkg.total_lessons,
            total_price: pkg.total_price,
            is_active: pkg.is_active,
            coach_id: pkg.coach_id,
          },
        },
      });
    } catch {
      /* audit best-effort */
    }

    await appendPrivateLessonPackageEvent(adminClient, {
      packageId,
      organizationId: actor.organization_id!,
      actorId: actor.id,
      eventType: "package_updated",
      title:
        currentLifecycle === "completed" && nextLifecycle === "active"
          ? "Paket güncellendi — ders eklenerek yeniden aktifleştirildi"
          : "Paket güncellendi",
      description: packageName,
      metadata: { totalLessons, totalPrice, isActive: nextIsActive, nextLifecycle },
    });

    revalidatePath("/ozel-ders-paketleri");
    revalidatePath(`/ozel-ders-paketleri/${packageId}`);
    revalidatePath(`/sporcu/${pkg.athlete_id}`);
    revalidatePath("/antrenman-yonetimi");
    return { success: true as const, packageId };
  });
}

/** Faz 17 — Paket düzenleme (updatePrivateLessonPackageCore alias). */
export async function updatePrivateLessonPackage(formData: FormData) {
  return updatePrivateLessonPackageCore(formData);
}

export async function listPrivateLessonUsageForPackage(
  packageId: string
): Promise<
  | { rows: Array<{ id: string; usedAt: string; note: string | null }> }
  | { error: string }
> {
  const schemaError = await assertCriticalSchemaReady(["private_lesson_packages_ready", "production_hardening_atomicity_ready"]);
  if (schemaError) return { error: schemaError };

  const resolved = await resolvePackageActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  const guard = await assertManagementActor(actor);
  if (!guard.ok) return { error: guard.error };

  const id = packageId?.trim() || "";
  if (!id) return { error: "Paket secimi zorunludur." };

  const adminClient = createSupabaseAdminClient();
  const { data: pkg } = await adminClient
    .from("private_lesson_packages")
    .select("id")
    .eq("id", id)
    .eq("organization_id", actor.organization_id!)
    .maybeSingle();
  if (!pkg) return { error: "Paket bulunamadi." };

  const { data, error } = await adminClient
    .from("private_lesson_usage")
    .select("id, used_at, note")
    .eq("package_id", id)
    .order("used_at", { ascending: false })
    .limit(80);

  if (error) return { error: `Kullanim gecmisi alinamadi: ${error.message}` };
  return {
    rows: (data || []).map((row) => ({
      id: row.id as string,
      usedAt: row.used_at as string,
      note: (row.note as string | null) ?? null,
    })),
  };
}

/**
 * Plansız / geçmiş ders kaydı: takvime bağlanmamış veya geçmişte yapılmış dersler için paketten 1 ders düşürür.
 * Planlı özel ders oturumları normalde `complete_private_lesson_session` (“Ders yapıldı”) ile düşer.
 * Açık plan varken manuel kayıt yalnızca kullanıcı açıkça onay verirse (forceWithOpenPlanned=true) kabul edilir.
 */
export async function addPrivateLessonUsage(formData: FormData) {
  return withServerActionGuard("privateLesson.addPrivateLessonUsage", async () => {
  const schemaError = await assertCriticalSchemaReady(["private_lesson_packages_ready"]);
  if (schemaError) return { error: schemaError };

  const resolved = await resolvePackageActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  const guard = await assertManagementActor(actor);
  if (!guard.ok) return { error: guard.error };

  const packageId = formData.get("packageId")?.toString().trim() || "";
  const usedAt = formData.get("usedAt")?.toString().trim() || new Date().toISOString();
  const note = formData.get("note")?.toString().trim() || null;
  const forceWithOpenPlanned = formData.get("forceWithOpenPlanned")?.toString().trim() === "true";

  if (!packageId) return { error: "Paket secimi zorunludur." };

  const adminClient = createSupabaseAdminClient();

  const sessionsSchemaError = await assertCriticalSchemaReady(["private_lesson_sessions_ready"]);
  if (!sessionsSchemaError) {
    const { count: plannedOpen, error: plannedErr } = await adminClient
      .from("private_lesson_sessions")
      .select("id", { count: "exact", head: true })
      .eq("package_id", packageId)
      .eq("organization_id", actor.organization_id!)
      .eq("status", "planned");
    if (plannedErr) {
      return { error: `Plan kontrolü başarısız: ${plannedErr.message}` };
    }
    if ((plannedOpen ?? 0) > 0 && !forceWithOpenPlanned) {
      return {
        error:
          "Bu pakette açık planlı ders var. Manuel kullanım eklerseniz paket hakkı ayrıca düşer. Devam etmek için onaylayarak tekrar deneyin.",
      };
    }
  }

  const caps = await getSchemaCapabilities();
  const pkgFetch = await runPackageLifecycleProbeWithCompat(caps, async (select) => {
    const { data, error } = await adminClient
      .from("private_lesson_packages")
      .select(select)
      .eq("id", packageId)
      .eq("organization_id", actor.organization_id!)
      .maybeSingle();
    return { data, error };
  });
  if (pkgFetch.error || !pkgFetch.data) {
    return { error: userFacingDataError("Paket bulunamadı", pkgFetch.error?.message) };
  }
  const pkg = pkgFetch.data as unknown as {
    organization_id: string;
    athlete_id: string;
    coach_id: string | null;
    used_lessons: number;
    total_lessons: number;
    remaining_lessons: number;
    is_active: boolean;
    lifecycle_status?: string | null;
    package_name?: string;
  };
  const lifecycle = resolvePackageLifecycleStatus({
    lifecycleStatus: pkg.lifecycle_status,
    isActive: Boolean(pkg.is_active),
    remainingLessons: pkg.remaining_lessons ?? 0,
    totalLessons: pkg.total_lessons ?? 0,
    usedLessons: pkg.used_lessons ?? 0,
  });
  if (!packageAllowsUsage(lifecycle)) {
    return { error: "Bu paket durumunda ders kullanımı yapılamaz." };
  }
  if (pkg.remaining_lessons <= 0 || pkg.used_lessons >= pkg.total_lessons) {
    return { error: "Paket dersi bitmis; yeni kullanim eklenemez." };
  }

  const usageCoachId = pkg.coach_id || (getSafeRole(actor.role) === "coach" ? actor.id : null);
  const { data: atomicRows, error: atomicErr } = await adminClient.rpc("private_lesson_apply_usage_atomic", {
    p_package_id: packageId,
    p_organization_id: actor.organization_id!,
    p_actor_id: actor.id,
    p_fallback_coach_id: usageCoachId,
    p_used_at: usedAt,
    p_note: note,
  });
  if (atomicErr) {
    captureServerActionSignal("privateLesson.addPrivateLessonUsage", "atomic_usage_rpc_failed", {
      packageId,
      organizationId: actor.organization_id,
      actorId: actor.id,
      errorMessage: atomicErr.message,
    });
    return { error: `Kullanim islemi tamamlanamadi: ${atomicErr.message}` };
  }
  if (!Array.isArray(atomicRows) || atomicRows.length === 0) {
    captureServerActionSignal("privateLesson.addPrivateLessonUsage", "atomic_usage_no_rows", {
      packageId,
      organizationId: actor.organization_id,
      actorId: actor.id,
    });
    return { error: "Kullanim islemi tamamlanamadi." };
  }
  const nextRemaining = Number((atomicRows[0] as { next_remaining?: number }).next_remaining ?? 0);

  await markPackageCompletedIfNeeded(adminClient, packageId, actor.organization_id!, nextRemaining);
  await appendPrivateLessonPackageEvent(adminClient, {
    packageId,
    organizationId: actor.organization_id!,
    actorId: actor.id,
    eventType: "lesson_used",
    title: "Ders hakkı kullanıldı",
    description: note || "Manuel kullanım",
    metadata: { nextRemaining },
  });
  await appendOperationalTimeline(adminClient, {
    organizationId: actor.organization_id,
    eventType: "private_lesson_package.lesson_used",
    summary: `Paket kullanımı: kalan ${nextRemaining}`,
    payload: { packageId },
    actorUserId: actor.id,
  });

  const label = (pkg as { package_name?: string }).package_name || "Ozel ders paketi";
  try {
    if (nextRemaining === 0) {
      await insertNotificationsForUsers(
        [pkg.athlete_id],
        `${label}: Son ders kullanimi islendi; paket tamamlandi. Yeni paket icin yoneticiyle iletisime gecebilirsiniz.`,
        "private_lesson.updated"
      );
    } else if (nextRemaining > 0 && nextRemaining < 3) {
      await insertNotificationsForUsers(
        [pkg.athlete_id],
        `${label}: Kalan ders sayisi dusuk (${nextRemaining}).`,
        "private_lesson.updated"
      );
    }
  } catch {
    /* bildirim opsiyonel */
  }

  revalidatePath("/ozel-ders-paketleri");
  revalidatePath("/ozel-ders-paketlerim");
  revalidatePath(`/ozel-ders-paketleri/${packageId}`);
  return { success: true as const };
  });
}

export async function updatePrivateLessonPayment(formData: FormData) {
  return withServerActionGuard("privateLesson.updatePrivateLessonPayment", async () => {
  const schemaError = await assertCriticalSchemaReady([
    "private_lesson_packages_ready",
    "private_lesson_payments_ready",
    "production_hardening_atomicity_ready",
  ]);
  if (schemaError) return { error: schemaError };

  const resolved = await resolvePackageActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  const guard = await assertManagementActor(actor);
  if (!guard.ok) return { error: guard.error };

  const packageId = formData.get("packageId")?.toString().trim() || "";
  const paymentAmountParsed = parseTRYMoneyInput(formData.get("paymentAmount")?.toString());
  const note = formData.get("note")?.toString().trim() || null;
  if (!packageId) return { error: "Paket secimi zorunludur." };
  if (paymentAmountParsed == null) return { error: "Tahsilat tutarı geçersiz." };
  const paymentValid = assertValidTRYMoneyAmount(paymentAmountParsed, "Tahsilat tutarı");
  if (!paymentValid.ok) return { error: paymentValid.error };
  const paymentAmount = paymentValid.amount;

  const adminClient = createSupabaseAdminClient();
  const { data: pkgRow } = await adminClient
    .from("private_lesson_packages")
    .select("athlete_id")
    .eq("id", packageId)
    .eq("organization_id", actor.organization_id!)
    .maybeSingle();
  if (!pkgRow?.athlete_id) return { error: "Paket bulunamadi." };

  const payCaps = await getSchemaCapabilities();
  const pkgFullFetch = await runPackagePaymentGuardWithCompat(payCaps, async (select) => {
    const { data, error } = await adminClient
      .from("private_lesson_packages")
      .select(select)
      .eq("id", packageId)
      .eq("organization_id", actor.organization_id!)
      .maybeSingle();
    return { data, error };
  });
  const pkgFull = pkgFullFetch.data as unknown as {
    is_active: boolean;
    lifecycle_status?: string | null;
    remaining_lessons: number;
    total_lessons: number;
    used_lessons: number;
  } | null;
  if (pkgFull) {
    const lifecycle = resolvePackageLifecycleStatus({
      lifecycleStatus: pkgFull.lifecycle_status,
      isActive: Boolean(pkgFull.is_active),
      remainingLessons: pkgFull.remaining_lessons ?? 0,
      totalLessons: pkgFull.total_lessons ?? 0,
      usedLessons: pkgFull.used_lessons ?? 0,
    });
    if (!packageAllowsPayment(lifecycle)) {
      return { error: "Bu paket durumunda tahsilat alınamaz." };
    }
  }

  const paidAt = new Date().toISOString();
  const orgTimeZone = await resolveOrganizationTimeZone(actor.organization_id!);
  const { dueDateKey, monthName, yearInt } = paymentBookkeepingFromPaidAtIso(paidAt, orgTimeZone);

  const sync = await applyPrivateLessonPackagePaymentWithPaymentRow({
    organizationId: actor.organization_id!,
    packageId,
    athleteProfileId: pkgRow.athlete_id as string,
    amount: paymentAmount,
    paidAtIso: paidAt,
    dueDateKey,
    monthName,
    yearInt,
    rpcActorProfileId: actor.id,
    paymentsDescription: note,
    rpcNote: note?.trim() || "Paket detayı — özel ders tahsilatı",
  });

  if (!sync.ok) {
    captureServerActionSignal("privateLesson.updatePrivateLessonPayment", "package_payment_sync_failed", {
      packageId,
      organizationId: actor.organization_id,
      actorId: actor.id,
      errorMessage: sync.error,
    });
    return { error: sync.error };
  }

  const nextAmountPaid = sync.nextAmountPaid;
  const paymentStatus = sync.paymentStatus;
  const totalPrice = sync.totalPrice;
  const pName = sync.packageName;
  const remainingBalance = normalizeMoney(totalPrice - nextAmountPaid);
  try {
    if (paymentStatus !== "paid") {
      await insertNotificationsForUsers(
        [sync.athleteId],
        `${pName}: Yeni tahsilat ₺${paymentAmount}. Toplam odenen ₺${nextAmountPaid} / Toplam ₺${normalizeMoney(totalPrice)}. Kalan ₺${remainingBalance}. Durum: ${paymentStatus}.`,
        "package.payment_received"
      );
    } else {
      await insertNotificationsForUsers(
        [sync.athleteId],
        `${pName}: Yeni tahsilat ₺${paymentAmount}. Odeme tamamlandi.`,
        "package.payment_received"
      );
    }
  } catch {
    /* bildirim opsiyonel */
  }

  await appendPrivateLessonPackageEvent(adminClient, {
    packageId,
    organizationId: actor.organization_id!,
    actorId: actor.id,
    eventType: "payment_added",
    title: "Tahsilat kaydı eklendi",
    description: `₺${paymentAmount}`,
    metadata: { amount: paymentAmount, paymentStatus },
  });

  revalidatePath("/ozel-ders-paketlerim");
  revalidatePath(`/ozel-ders-paketleri/${packageId}`);
  return { success: true as const };
  });
}

export async function getPrivateLessonPackageDetail(
  packageId: string
): Promise<PrivateLessonPackageDetailSnapshot | { error: string }> {
  const schemaError = await assertCriticalSchemaReady(["private_lesson_packages_ready", "private_lesson_payments_ready"]);
  if (schemaError) return { error: schemaError };

  const resolved = await resolvePackageActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  const role = getSafeRole(actor.role);
  if (!actor.organization_id) return { error: "Organizasyon bilgisi eksik." };

  if (role !== "admin" && role !== "coach" && role !== "sporcu") {
    return { error: "Bu islem icin yetkiniz yok." };
  }

  if (role === "coach") {
    const permissions = await getCoachPermissions(actor.id, actor.organization_id);
    if (!hasCoachPermission(permissions, "can_manage_training_notes")) {
      return { error: "Ozel paket detayini goruntuleme yetkiniz yok." };
    }
  }

  const id = packageId.trim();
  if (!id) return { error: "Paket secimi zorunludur." };

  const adminClient = createSupabaseAdminClient();
  const caps = await getSchemaCapabilities();
  const pkgFetch = await runPackageSelectWithCompat(caps, async (select) =>
    adminClient
      .from("private_lesson_packages")
      .select(select)
      .eq("id", id)
      .eq("organization_id", actor.organization_id)
      .maybeSingle()
  );
  if (pkgFetch.error || !pkgFetch.data) {
    return { error: userFacingDataError("Paket bulunamadı", pkgFetch.error?.message) };
  }
  const pkgRow = pkgFetch.data;

  const mappedPackage = mapPackage(pkgRow as never);
  if (role === "sporcu" && mappedPackage.athleteId !== actor.id) {
    return { error: "Sadece kendi paket detayinizi gorebilirsiniz." };
  }

  const { data: usageRows, error: usageErr } = await adminClient
    .from("private_lesson_usage")
    .select("id, package_id, athlete_id, coach_id, used_at, note")
    .eq("package_id", id)
    .order("used_at", { ascending: false });
  if (usageErr) return { error: `Kullanim gecmisi alinamadi: ${usageErr.message}` };

  let paymentQuery = adminClient
    .from("private_lesson_payments")
    .select("id, package_id, athlete_id, coach_id, amount, paid_at, note, created_by, created_at")
    .eq("package_id", id)
    .order("paid_at", { ascending: false });
  paymentQuery = applyPrivateLessonPaymentActiveFilter(paymentQuery, caps);
  const { data: paymentRows, error: paymentErr } = await paymentQuery;
  if (paymentErr) return { error: userFacingDataError("Ödeme geçmişi alınamadı", paymentErr.message) };

  const mappedUsage: PrivateLessonUsage[] = (usageRows || []).map((row) => ({
    id: row.id as string,
    packageId: row.package_id as string,
    athleteId: row.athlete_id as string,
    coachId: (row.coach_id as string | null) ?? null,
    usedAt: row.used_at as string,
    note: (row.note as string | null) ?? null,
  }));

  let plannedPrivateSessionCount = 0;
  let plannedSessionPreview: Array<{ id: string; startsAt: string; status: "planned" | "completed" | "cancelled" }> = [];
  const sessionsSchemaError = await assertCriticalSchemaReady(["private_lesson_sessions_ready"]);
  if (!sessionsSchemaError) {
    const { count, error: plannedCountErr } = await adminClient
      .from("private_lesson_sessions")
      .select("id", { count: "exact", head: true })
      .eq("package_id", id)
      .eq("organization_id", actor.organization_id)
      .eq("status", "planned");
    if (!plannedCountErr) {
      plannedPrivateSessionCount = count ?? 0;
    }

    const { data: plannedRows, error: plannedRowsErr } = await adminClient
      .from("private_lesson_sessions")
      .select("id, starts_at, status")
      .eq("package_id", id)
      .eq("organization_id", actor.organization_id)
      .eq("status", "planned")
      .order("starts_at", { ascending: true })
      .limit(3);
    if (!plannedRowsErr) {
      plannedSessionPreview = (plannedRows || []).map((row) => ({
        id: row.id as string,
        startsAt: row.starts_at as string,
        status: (row.status as "planned" | "completed" | "cancelled") || "planned",
      }));
    }
  }

  const mappedPayments = (paymentRows || []).map((row) => mapPaymentRow(row as never));
  const financeSummary = calculatePackageFinanceSummary({
    pkg: mappedPackage,
    payments: mappedPayments,
  });

  let eventRows: PrivateLessonPackageEventRow[] = [];
  const { data: eventData } = await adminClient
    .from("private_lesson_package_events")
    .select("id, package_id, organization_id, actor_id, event_type, title, description, metadata, created_at")
    .eq("package_id", id)
    .eq("organization_id", actor.organization_id)
    .order("created_at", { ascending: false })
    .limit(80);
  if (eventData?.length) {
    eventRows = eventData.map((row) => ({
      id: row.id as string,
      packageId: row.package_id as string,
      organizationId: row.organization_id as string,
      actorId: (row.actor_id as string | null) ?? null,
      eventType: row.event_type as string,
      title: row.title as string,
      description: (row.description as string | null) ?? null,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: row.created_at as string,
    }));
  }

  let completedSessions: Parameters<typeof buildPackageUsageLessonRows>[0]["completedSessions"] = [];
  if (!sessionsSchemaError) {
    const { data: sessionRows } = await adminClient
      .from("private_lesson_sessions")
      .select(
        "id, starts_at, completed_at, status, location, note, athlete_id, coach_id, athlete_profile:profiles!private_lesson_sessions_athlete_id_fkey(full_name, email), coach_profile:profiles!private_lesson_sessions_coach_id_fkey(full_name, email)"
      )
      .eq("package_id", id)
      .eq("organization_id", actor.organization_id)
      .eq("status", "completed")
      .order("starts_at", { ascending: false })
      .limit(80);
    completedSessions = (sessionRows || []) as never;
  }

  const usageLessonRows = buildPackageUsageLessonRows({
    packageAthleteName: mappedPackage.athleteName,
    usageRows: (usageRows || []) as never,
    completedSessions,
  });

  return {
    package: mappedPackage,
    usageRows: mappedUsage,
    usageLessonRows,
    paymentRows: mappedPayments,
    eventRows,
    financeSummary,
    plannedSessionPreview,
    plannedPrivateSessionCount,
    viewerRole: role,
    viewerId: actor.id,
  };
}
