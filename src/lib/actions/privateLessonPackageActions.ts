"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { getCoachPermissions, hasCoachPermission } from "@/lib/auth/coachPermissions";
import { messageIfAthleteCannotOperate } from "@/lib/athlete/lifecycle";
import { messageIfCoachCannotOperate } from "@/lib/coach/lifecycle";
import { assertCriticalSchemaReady } from "@/lib/diagnostics/systemHealth";
import { insertNotificationsForUsers } from "@/lib/notifications/serverInsert";
import { computeIncrementalAmountPaid, computePaymentStatus, computeRemainingLessons, normalizeMoney } from "@/lib/privateLessons/packageMath";
import type {
  PrivateLessonPackage,
  PrivateLessonPackageDetailSnapshot,
  PrivateLessonPayment,
  PrivateLessonPaymentStatus,
  PrivateLessonUsage,
} from "@/lib/types";
import { toDisplayName } from "@/lib/profile/displayName";
import { resolveSessionActor, toTenantProfileRow } from "@/lib/auth/resolveSessionActor";
import { withServerActionGuard } from "@/lib/observability/serverActionError";

type Actor = {
  id: string;
  role: string;
  organization_id: string | null;
  is_active: boolean | null;
};

const PACKAGE_SELECT =
  "id, organization_id, athlete_id, coach_id, package_type, package_name, total_lessons, used_lessons, remaining_lessons, total_price, amount_paid, payment_status, is_active, created_at, updated_at, athlete_profile:profiles!private_lesson_packages_athlete_id_fkey(full_name, email), coach_profile:profiles!private_lesson_packages_coach_id_fkey(full_name, email)";

function mapPackage(raw: {
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
  created_at: string;
  updated_at: string;
  athlete_profile?: { full_name?: string | null; email?: string | null } | { full_name?: string | null; email?: string | null }[] | null;
  coach_profile?: { full_name?: string | null; email?: string | null } | { full_name?: string | null; email?: string | null }[] | null;
}): PrivateLessonPackage {
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
    totalPrice: normalizeMoney(raw.total_price),
    amountPaid: normalizeMoney(raw.amount_paid),
    paymentStatus: raw.payment_status,
    isActive: raw.is_active,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
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
  { packages: PrivateLessonPackage[] } | { error: string }
> {
  const schemaError = await assertCriticalSchemaReady(["private_lesson_packages_ready", "coach_permissions"]);
  if (schemaError) return { error: schemaError };

  const resolved = await resolvePackageActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  const guard = await assertManagementActor(actor);
  if (!guard.ok) return { error: guard.error };

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("private_lesson_packages")
    .select(PACKAGE_SELECT)
    .eq("organization_id", actor.organization_id!)
    .order("created_at", { ascending: false });

  if (error) return { error: `Paketler alinamadi: ${error.message}` };
  return { packages: (data || []).map((row) => mapPackage(row as never)) };
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
  const { data, error } = await adminClient
    .from("private_lesson_packages")
    .select(PACKAGE_SELECT)
    .eq("organization_id", actor.organization_id)
    .eq("athlete_id", actor.id)
    .order("created_at", { ascending: false });

  if (error) return { error: `Paketler alinamadi: ${error.message}` };
  return { packages: (data || []).map((row) => mapPackage(row as never)) };
}

export async function listPrivateLessonFormOptions(): Promise<
  { athletes: Array<{ id: string; full_name: string }>; coaches: Array<{ id: string; full_name: string }> } | { error: string }
> {
  const resolved = await resolvePackageActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  const guard = await assertManagementActor(actor);
  if (!guard.ok) return { error: guard.error };

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
    .map((row) => ({ id: row.id, full_name: toDisplayName(row.full_name, row.email, "Koc") }));

  return { athletes, coaches };
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
  const totalPrice = normalizeMoney(formData.get("totalPrice")?.toString() || "0");
  const amountPaid = normalizeMoney(formData.get("amountPaid")?.toString() || "0");
  const role = getSafeRole(actor.role);

  if (!athleteId || !packageType || !packageName) return { error: "Sporcu, paket tipi ve paket adi zorunludur." };
  if (!Number.isFinite(totalLessons) || totalLessons <= 0) return { error: "Toplam ders sayisi 1 veya daha buyuk olmali." };
  if (totalPrice < 0 || amountPaid < 0) return { error: "Fiyat alanlari negatif olamaz." };

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

  const paymentStatus = computePaymentStatus(totalPrice, amountPaid);
  const { error } = await adminClient.from("private_lesson_packages").insert({
    organization_id: actor.organization_id,
    athlete_id: athleteId,
    coach_id: coachId,
    package_type: packageType,
    package_name: packageName,
    total_lessons: totalLessons,
    used_lessons: 0,
    remaining_lessons: totalLessons,
    total_price: totalPrice,
    amount_paid: amountPaid,
    payment_status: paymentStatus,
    is_active: true,
    created_by: actor.id,
  });

  if (error) return { error: `Paket olusturulamadi: ${error.message}` };

  try {
    await insertNotificationsForUsers(
      [athleteId],
      `Ozel ders paketi: "${packageName}" (${totalLessons} ders). Odeme durumu: ${paymentStatus}.`
    );
  } catch {
    /* bildirim tablosu yoksa ana akisi bozma */
  }

  revalidatePath("/ozel-ders-paketleri");
  revalidatePath("/ozel-ders-paketlerim");
  return { success: true as const };
  });
}

export async function listPrivateLessonUsageForPackage(
  packageId: string
): Promise<
  | { rows: Array<{ id: string; usedAt: string; note: string | null }> }
  | { error: string }
> {
  const schemaError = await assertCriticalSchemaReady(["private_lesson_packages_ready"]);
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

  if (!packageId) return { error: "Paket secimi zorunludur." };

  const adminClient = createSupabaseAdminClient();
  const { data: pkg } = await adminClient
    .from("private_lesson_packages")
    .select(
      "id, organization_id, athlete_id, coach_id, used_lessons, total_lessons, remaining_lessons, is_active, package_name"
    )
    .eq("id", packageId)
    .eq("organization_id", actor.organization_id!)
    .maybeSingle();

  if (!pkg) return { error: "Paket bulunamadi." };
  if (!pkg.is_active) return { error: "Pasif paket icin kullanim eklenemez." };
  if (pkg.remaining_lessons <= 0 || pkg.used_lessons >= pkg.total_lessons) {
    return { error: "Paket dersi bitmis; yeni kullanim eklenemez." };
  }

  const nextUsed = pkg.used_lessons + 1;
  const nextRemaining = computeRemainingLessons(pkg.total_lessons, nextUsed);
  const { error: updateErr } = await adminClient
    .from("private_lesson_packages")
    .update({
      used_lessons: nextUsed,
      remaining_lessons: nextRemaining,
      is_active: nextRemaining > 0 ? pkg.is_active : false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", packageId)
    .eq("organization_id", actor.organization_id!)
    .gt("remaining_lessons", 0);

  if (updateErr) return { error: `Kullanim sayaci guncellenemedi: ${updateErr.message}` };

  const usageCoachId = pkg.coach_id || (getSafeRole(actor.role) === "coach" ? actor.id : null);
  const { error: usageErr } = await adminClient.from("private_lesson_usage").insert({
    package_id: packageId,
    athlete_id: pkg.athlete_id,
    coach_id: usageCoachId,
    used_at: usedAt,
    note,
  });
  if (usageErr) return { error: `Kullanim kaydi olusturulamadi: ${usageErr.message}` };

  const label = (pkg as { package_name?: string }).package_name || "Ozel ders paketi";
  try {
    if (nextRemaining === 0) {
      await insertNotificationsForUsers(
        [pkg.athlete_id],
        `${label}: Son ders kullanimi islendi; paket tamamlandi. Yeni paket icin yoneticiyle iletisime gecebilirsiniz.`
      );
    } else if (nextRemaining > 0 && nextRemaining < 3) {
      await insertNotificationsForUsers(
        [pkg.athlete_id],
        `${label}: Kalan ders sayisi dusuk (${nextRemaining}).`
      );
    }
  } catch {
    /* bildirim opsiyonel */
  }

  revalidatePath("/ozel-ders-paketleri");
  revalidatePath("/ozel-ders-paketlerim");
  return { success: true as const };
  });
}

export async function updatePrivateLessonPayment(formData: FormData) {
  return withServerActionGuard("privateLesson.updatePrivateLessonPayment", async () => {
  const schemaError = await assertCriticalSchemaReady(["private_lesson_packages_ready", "private_lesson_payments_ready"]);
  if (schemaError) return { error: schemaError };

  const resolved = await resolvePackageActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  const guard = await assertManagementActor(actor);
  if (!guard.ok) return { error: guard.error };

  const packageId = formData.get("packageId")?.toString().trim() || "";
  const paymentAmount = normalizeMoney(formData.get("paymentAmount")?.toString() || "0");
  const note = formData.get("note")?.toString().trim() || null;
  if (!packageId) return { error: "Paket secimi zorunludur." };
  if (paymentAmount <= 0) return { error: "Tahsilat tutari sifirdan buyuk olmali." };

  const adminClient = createSupabaseAdminClient();
  const { data: pkg } = await adminClient
    .from("private_lesson_packages")
    .select("id, organization_id, total_price, amount_paid, athlete_id, coach_id, package_name")
    .eq("id", packageId)
    .eq("organization_id", actor.organization_id!)
    .maybeSingle();
  if (!pkg) return { error: "Paket bulunamadi." };

  const nextAmountPaid = computeIncrementalAmountPaid(pkg.amount_paid, paymentAmount);
  const paymentStatus = computePaymentStatus(pkg.total_price, nextAmountPaid);
  const { error } = await adminClient
    .from("private_lesson_packages")
    .update({
      amount_paid: nextAmountPaid,
      payment_status: paymentStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", packageId)
    .eq("organization_id", actor.organization_id!);
  if (error) return { error: `Odeme guncellenemedi: ${error.message}` };

  const paymentCoachId = pkg.coach_id || (getSafeRole(actor.role) === "coach" ? actor.id : null);
  const { error: paymentInsertErr } = await adminClient.from("private_lesson_payments").insert({
    package_id: packageId,
    organization_id: actor.organization_id,
    athlete_id: pkg.athlete_id,
    coach_id: paymentCoachId,
    amount: paymentAmount,
    paid_at: new Date().toISOString(),
    note,
    created_by: actor.id,
  });
  if (paymentInsertErr) return { error: `Odeme hareketi kaydedilemedi: ${paymentInsertErr.message}` };

  const pName = (pkg as { package_name?: string }).package_name || "Ozel ders paketi";
  const remainingBalance = normalizeMoney(pkg.total_price - nextAmountPaid);
  try {
    if (paymentStatus !== "paid") {
      await insertNotificationsForUsers(
        [pkg.athlete_id as string],
        `${pName}: Yeni tahsilat ₺${paymentAmount}. Toplam odenen ₺${nextAmountPaid} / Toplam ₺${normalizeMoney(pkg.total_price)}. Kalan ₺${remainingBalance}. Durum: ${paymentStatus}.`
      );
    } else {
      await insertNotificationsForUsers(
        [pkg.athlete_id as string],
        `${pName}: Yeni tahsilat ₺${paymentAmount}. Odeme tamamlandi.`
      );
    }
  } catch {
    /* bildirim opsiyonel */
  }

  revalidatePath("/ozel-ders-paketleri");
  revalidatePath("/ozel-ders-paketlerim");
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
  const { data: pkgRow, error: pkgErr } = await adminClient
    .from("private_lesson_packages")
    .select(PACKAGE_SELECT)
    .eq("id", id)
    .eq("organization_id", actor.organization_id)
    .maybeSingle();
  if (pkgErr || !pkgRow) return { error: "Paket bulunamadi." };

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

  const { data: paymentRows, error: paymentErr } = await adminClient
    .from("private_lesson_payments")
    .select("id, package_id, athlete_id, coach_id, amount, paid_at, note, created_by, created_at")
    .eq("package_id", id)
    .order("paid_at", { ascending: false });
  if (paymentErr) return { error: `Odeme gecmisi alinamadi: ${paymentErr.message}` };

  const mappedUsage: PrivateLessonUsage[] = (usageRows || []).map((row) => ({
    id: row.id as string,
    packageId: row.package_id as string,
    athleteId: row.athlete_id as string,
    coachId: (row.coach_id as string | null) ?? null,
    usedAt: row.used_at as string,
    note: (row.note as string | null) ?? null,
  }));

  return {
    package: mappedPackage,
    usageRows: mappedUsage,
    paymentRows: (paymentRows || []).map((row) => mapPaymentRow(row as never)),
  };
}
