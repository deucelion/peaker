"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { getCoachPermissions, hasCoachPermission } from "@/lib/auth/coachPermissions";
import { FINANCE_ADMIN_ONLY_MESSAGE } from "@/lib/finance/messages";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { insertNotificationsForUsers } from "@/lib/notifications/serverInsert";
import type { PaymentRow, PlayerWithPayments } from "@/types/domain";
import type { AthleteFinanceDetail, FinanceStatusSummary, PrivateLessonPackage, PrivateLessonPayment } from "@/lib/types";
import { computeFinanceStatusSummary } from "@/lib/finance/paymentSummary";
import { shouldNotifyFinancialEvent } from "@/lib/finance/notificationPolicy";
import { toDisplayName } from "@/lib/profile/displayName";
import { resolveSessionActor, toTenantProfileRow } from "@/lib/auth/resolveSessionActor";
import { isUuid } from "@/lib/validation/uuid";
import { withServerActionGuard } from "@/lib/observability/serverActionError";
import { captureServerActionSignal } from "@/lib/observability/serverActionError";
import { assertCriticalSchemaReady } from "@/lib/diagnostics/systemHealth";

type PaymentScope = "membership" | "private_lesson" | "extra_charge";
type PaymentKind =
  | "monthly_membership"
  | "private_lesson_package"
  | "license"
  | "event"
  | "equipment"
  | "manual_other";

function assertUuid(id: string | null | undefined): id is string {
  return isUuid(id);
}

const MONTH_NAMES_TR = [
  "Ocak",
  "Subat",
  "Mart",
  "Nisan",
  "Mayis",
  "Haziran",
  "Temmuz",
  "Agustos",
  "Eylul",
  "Ekim",
  "Kasim",
  "Aralik",
] as const;

function resolvePaymentPeriod(dueDate: string | null): { monthName: string; yearInt: number } {
  const baseDate = dueDate ? new Date(`${dueDate}T00:00:00`) : new Date();
  if (Number.isNaN(baseDate.getTime())) {
    const now = new Date();
    return {
      monthName: MONTH_NAMES_TR[now.getMonth()] ?? "Ocak",
      yearInt: now.getFullYear(),
    };
  }
  return {
    monthName: MONTH_NAMES_TR[baseDate.getMonth()] ?? "Ocak",
    yearInt: baseDate.getFullYear(),
  };
}

function addOneMonthFromPlannedDate(dateText: string): string {
  const [y, m, d] = dateText.split("-").map((v) => Number(v));
  if (!y || !m || !d) return dateText;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(dt.getTime())) return dateText;
  dt.setUTCMonth(dt.getUTCMonth() + 1);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function resolvePaymentDomain(input: {
  paymentScopeRaw?: string | null;
  paymentKindRaw?: string | null;
  paymentTypeRaw?: string | null;
}): { scope: PaymentScope; kind: PaymentKind; paymentType: "aylik" | "paket" } {
  const scopeRaw = (input.paymentScopeRaw || "").trim();
  const kindRaw = (input.paymentKindRaw || "").trim();
  const typeRaw = (input.paymentTypeRaw || "").trim();

  if (scopeRaw === "extra_charge") {
    const kind: PaymentKind =
      kindRaw === "license" || kindRaw === "event" || kindRaw === "equipment" || kindRaw === "manual_other"
        ? kindRaw
        : "manual_other";
    return { scope: "extra_charge", kind, paymentType: "aylik" };
  }
  if (scopeRaw === "private_lesson") {
    return { scope: "private_lesson", kind: "private_lesson_package", paymentType: "paket" };
  }
  if (typeRaw === "paket") {
    return { scope: "private_lesson", kind: "private_lesson_package", paymentType: "paket" };
  }
  return { scope: "membership", kind: "monthly_membership", paymentType: "aylik" };
}

function isPaymentsSchemaCompatibilityError(message?: string | null): boolean {
  const m = (message || "").toLowerCase();
  return (
    m.includes("payments.payment_scope") ||
    m.includes("payments.payment_kind") ||
    m.includes("payments.display_name") ||
    m.includes("payments.deleted_at")
  );
}

async function resolveFinanceActorForReadWrite(requireWrite: boolean): Promise<
  { actorUserId: string; actorRole: string; organizationId: string } | { error: string }
> {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
  if ("error" in resolved) return { error: resolved.error };
  const actor = toTenantProfileRow(resolved.actor);
  if (!actor.organization_id) return { error: "Kullanici profili dogrulanamadi." };
  const role = getSafeRole(actor.role);
  if (role !== "admin" && role !== "coach") {
    return { error: FINANCE_ADMIN_ONLY_MESSAGE };
  }
  if (role === "coach") {
    const perms = await getCoachPermissions(actor.id, actor.organization_id);
    if (!hasCoachPermission(perms, "can_view_reports")) {
      return { error: "Finans detayini goruntuleme yetkiniz yok." };
    }
    if (requireWrite && !hasCoachPermission(perms, "can_manage_athlete_profiles")) {
      return { error: "Finans planini guncelleme yetkiniz yok." };
    }
  }
  return { actorUserId: actor.id, actorRole: actor.role, organizationId: actor.organization_id };
}

function mapPrivateLessonPackageRow(raw: {
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
  payment_status: "unpaid" | "partial" | "paid";
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
    coachName: coach ? toDisplayName(coach?.full_name, coach?.email, "Koç") : null,
    packageType: raw.package_type,
    packageName: raw.package_name,
    totalLessons: Number(raw.total_lessons) || 0,
    usedLessons: Number(raw.used_lessons) || 0,
    remainingLessons: Number(raw.remaining_lessons) || 0,
    totalPrice: Number(raw.total_price) || 0,
    amountPaid: Number(raw.amount_paid) || 0,
    paymentStatus: raw.payment_status,
    isActive: Boolean(raw.is_active),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function mapPrivateLessonPaymentRow(raw: {
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
    amount: Number(raw.amount) || 0,
    paidAt: raw.paid_at,
    note: raw.note ?? null,
    createdBy: raw.created_by ?? null,
    createdAt: raw.created_at,
  };
}

function mapPaymentRow(raw: {
  id: string;
  profile_id: string | null;
  organization_id: string;
  amount: number | string | null;
  payment_type: string;
  payment_scope?: string | null;
  payment_kind?: string | null;
  display_name?: string | null;
  metadata_json?: Record<string, unknown> | null;
  due_date: string | null;
  payment_date?: string | null;
  status: string;
  total_sessions: number | null;
  remaining_sessions: number | null;
  description: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  delete_reason?: string | null;
}): PaymentRow {
  const pt = raw.payment_type === "paket" ? "paket" : "aylik";
  const st = raw.status === "odendi" ? "odendi" : "bekliyor";
  const ownerId = raw.profile_id || "";
  const scope = raw.payment_scope === "private_lesson" || raw.payment_scope === "extra_charge" ? raw.payment_scope : "membership";
  const kind =
    raw.payment_kind === "private_lesson_package" ||
    raw.payment_kind === "license" ||
    raw.payment_kind === "event" ||
    raw.payment_kind === "equipment" ||
    raw.payment_kind === "manual_other"
      ? raw.payment_kind
      : "monthly_membership";
  return {
    id: raw.id,
    profile_id: ownerId,
    organization_id: raw.organization_id,
    amount: Number(raw.amount) || 0,
    payment_type: pt,
    payment_scope: scope,
    payment_kind: kind,
    display_name: raw.display_name ?? null,
    metadata_json: raw.metadata_json ?? null,
    due_date: raw.due_date,
    payment_date: raw.payment_date ?? null,
    status: st,
    total_sessions: raw.total_sessions != null ? Number(raw.total_sessions) : null,
    remaining_sessions: raw.remaining_sessions != null ? Number(raw.remaining_sessions) : null,
    description: raw.description,
    deleted_at: raw.deleted_at ?? null,
    deleted_by: raw.deleted_by ?? null,
    delete_reason: raw.delete_reason ?? null,
  };
}

export type OrgFinanceSnapshot = {
  players: Array<
    PlayerWithPayments & {
      financeSummary: FinanceStatusSummary;
      nextAidatPlan: { dueDate: string | null; amount: number | null };
      paymentModel: "Aylik" | "Paket" | "Hibrit" | "Ek Tahsilat";
      activeProductLabel: string | null;
      overdueAmount: number;
      pendingAmountTotal: number;
      lastPaymentDate: string | null;
      lastPaymentAmount: number | null;
    }
  >;
  /** Tum bekleyen (status=bekliyor) odeme tutarlari toplami */
  pendingAmountTotal: number;
  /** odendi kayit sayisi / tum odeme kayitlari */
  collectionPowerPercent: number;
};

/**
 * Finans listesi: yalnizca oturumdaki org admin'i; org_id sunucuda profilden.
 * Tekil odeme kayitlari uzerinden tahsilat gucu ve bekleyen tutar.
 */
export async function listOrgPaymentsForAdmin(): Promise<
  { snapshot: OrgFinanceSnapshot } | { error: string }
> {
  return withServerActionGuard("finance.listOrgPaymentsForAdmin", async () => {
  const resolved = await resolveFinanceActorForReadWrite(false);
  if ("error" in resolved) return { error: resolved.error };

  const adminClient = createSupabaseAdminClient();
  const { data: profileRows, error: profileError } = await adminClient
    .from("profiles")
    .select("id, full_name, email, number, position, team, organization_id, role, avatar_url, next_aidat_due_date, next_aidat_amount")
    .eq("organization_id", resolved.organizationId)
    .eq("role", "sporcu")
    .order("full_name");

  if (profileError) return { error: `Finans verisi alinamadi: ${profileError.message}` };

  const athleteIds = (profileRows || []).map((p) => p.id);

  let paymentRows: Array<Parameters<typeof mapPaymentRow>[0]> = [];
  let privateLessonPackageRows: Array<{
    athlete_id: string;
    package_name: string | null;
    payment_status: "unpaid" | "partial" | "paid";
    is_active: boolean;
    created_at: string;
  }> = [];
  if (athleteIds.length > 0) {
    const payRes = await adminClient
      .from("payments")
      .select(
        "id, profile_id, organization_id, amount, payment_type, payment_scope, payment_kind, display_name, metadata_json, due_date, payment_date, status, total_sessions, remaining_sessions, description, deleted_at, deleted_by, delete_reason"
      )
      .eq("organization_id", resolved.organizationId)
      .in("profile_id", athleteIds)
      .is("deleted_at", null);
    if (payRes.error && isPaymentsSchemaCompatibilityError(payRes.error.message)) {
      const payFallbackRes = await adminClient
        .from("payments")
        .select(
          "id, profile_id, organization_id, amount, payment_type, due_date, payment_date, status, total_sessions, remaining_sessions, description"
        )
        .eq("organization_id", resolved.organizationId)
        .in("profile_id", athleteIds);
      if (payFallbackRes.error) return { error: `Odeme listesi alinamadi: ${payFallbackRes.error.message}` };
      paymentRows = (payFallbackRes.data || []) as Array<Parameters<typeof mapPaymentRow>[0]>;
    } else {
      if (payRes.error) return { error: `Odeme listesi alinamadi: ${payRes.error.message}` };
      paymentRows = (payRes.data || []) as Array<Parameters<typeof mapPaymentRow>[0]>;
    }
    const packageRes = await adminClient
      .from("private_lesson_packages")
      .select("athlete_id, package_name, payment_status, is_active, created_at")
      .eq("organization_id", resolved.organizationId)
      .in("athlete_id", athleteIds)
      .order("created_at", { ascending: false });
    if (packageRes.error) return { error: `Paket listesi alinamadi: ${packageRes.error.message}` };
    privateLessonPackageRows = (packageRes.data || []) as typeof privateLessonPackageRows;
  }

  const paymentsByProfile = new Map<string, PaymentRow[]>();
  paymentRows.forEach((row) => {
    const mapped = mapPaymentRow(row);
    const list = paymentsByProfile.get(mapped.profile_id) || [];
    list.push(mapped);
    paymentsByProfile.set(mapped.profile_id, list);
  });

  const packageByAthlete = new Map<string, typeof privateLessonPackageRows>();
  privateLessonPackageRows.forEach((pkg) => {
    const list = packageByAthlete.get(pkg.athlete_id) || [];
    list.push(pkg);
    packageByAthlete.set(pkg.athlete_id, list);
  });

  const players = (profileRows || []).map((row) => {
    const payments = paymentsByProfile.get(row.id) || [];
    const packages = packageByAthlete.get(row.id) || [];
    const aidatPayments = payments.filter((p) => p.payment_type === "aylik");
    const extraPayments = payments.filter((p) => p.payment_scope === "extra_charge");
    const packagePayments = payments.filter((p) => p.payment_type === "paket" || p.payment_scope === "private_lesson");
    const financeSummary = computeFinanceStatusSummary({
      aidatPayments,
      plannedNextDueDate: row.next_aidat_due_date ?? null,
      plannedNextAmount: row.next_aidat_amount != null ? Number(row.next_aidat_amount) : null,
      hasPartialPackagePayment: packages.some((p) => p.payment_status === "partial"),
    });
    const activePackage = packages.find((p) => p.is_active) || packages[0] || null;
    const hasAidat = aidatPayments.length > 0 || row.next_aidat_due_date != null;
    const hasPackage = packagePayments.length > 0 || packages.length > 0;
    const hasExtra = extraPayments.length > 0;
    const paymentModel: OrgFinanceSnapshot["players"][number]["paymentModel"] =
      hasAidat && hasPackage ? "Hibrit" : hasAidat ? "Aylik" : hasPackage ? "Paket" : hasExtra ? "Ek Tahsilat" : "Aylik";
    const pendingAmountTotalForAthlete = payments
      .filter((p) => p.status === "bekliyor")
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const overdueAmountForAthlete = payments
      .filter((p) => p.status === "bekliyor" && p.due_date)
      .filter((p) => new Date(`${p.due_date}T00:00:00`).getTime() < new Date().setHours(0, 0, 0, 0))
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const paidPayments = payments
      .filter((p) => p.status === "odendi" && p.payment_date)
      .sort((a, b) => new Date(b.payment_date || 0).getTime() - new Date(a.payment_date || 0).getTime());
    const lastPayment = paidPayments[0] || null;
    const activeProductLabel =
      activePackage?.package_name ||
      (row.next_aidat_due_date ? `Aidat (${row.next_aidat_due_date})` : hasExtra ? "Ek Tahsilatlar" : null);
    return {
      id: row.id,
      full_name: toDisplayName(row.full_name, row.email, "Sporcu"),
      number: row.number ?? null,
      position: row.position ?? null,
      team: row.team ?? null,
      organization_id: row.organization_id ?? null,
      role: row.role ?? undefined,
      avatar_url: row.avatar_url ?? null,
      payments,
      financeSummary,
      nextAidatPlan: {
        dueDate: row.next_aidat_due_date ?? null,
        amount: row.next_aidat_amount != null ? Number(row.next_aidat_amount) : null,
      },
      paymentModel,
      activeProductLabel,
      overdueAmount: overdueAmountForAthlete,
      pendingAmountTotal: pendingAmountTotalForAthlete,
      lastPaymentDate: lastPayment?.payment_date ?? null,
      lastPaymentAmount: lastPayment?.amount ?? null,
    };
  }) as OrgFinanceSnapshot["players"];

  const allPayments = players.flatMap((p) => p.payments || []);
  const pendingAmountTotal = allPayments
    .filter((pay) => pay.status === "bekliyor")
    .reduce((sum, pay) => sum + (Number(pay.amount) || 0), 0);
  const collectionPowerPercent =
    allPayments.length === 0
      ? 0
      : Math.round((allPayments.filter((p) => p.status === "odendi").length / allPayments.length) * 100);

  return {
    snapshot: {
      players,
      pendingAmountTotal,
      collectionPowerPercent,
    },
  };
  });
}

export async function createOrgPayment(formData: FormData) {
  return withServerActionGuard("finance.createOrgPayment", async () => {
  const resolved = await resolveFinanceActorForReadWrite(true);
  if ("error" in resolved) return { error: resolved.error };

  const profileId = formData.get("profile_id")?.toString().trim();
  if (!assertUuid(profileId)) return { error: "Gecersiz sporcu." };

  const amountRaw = formData.get("amount");
  const amount = typeof amountRaw === "string" ? Number(amountRaw) : Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    return { error: "Gecersiz tutar." };
  }

  const paymentTypeInput = formData.get("payment_type")?.toString() || null;
  const paymentScopeInput = formData.get("payment_scope")?.toString() || null;
  const paymentKindInput = formData.get("payment_kind")?.toString() || null;
  const { scope: paymentScope, kind: paymentKind, paymentType } = resolvePaymentDomain({
    paymentTypeRaw: paymentTypeInput,
    paymentScopeRaw: paymentScopeInput,
    paymentKindRaw: paymentKindInput,
  });

  const dueRaw = formData.get("due_date")?.toString().trim();
  const dueDate = dueRaw && dueRaw.length >= 8 ? dueRaw : null;
  const { monthName, yearInt } = resolvePaymentPeriod(dueDate);

  const desc = formData.get("desc")?.toString().trim().slice(0, 2000) || null;
  const displayName = formData.get("display_name")?.toString().trim().slice(0, 120) || null;

  let totalSessions: number | null = null;
  let remainingSessions: number | null = null;
  if (paymentType === "paket") {
    const sessionsRaw = formData.get("sessions");
    const sessions = typeof sessionsRaw === "string" ? Number(sessionsRaw) : Number(sessionsRaw);
    if (!Number.isInteger(sessions) || sessions < 1 || sessions > 10_000) {
      return { error: "Paket icin gecerli bir seans sayisi girin." };
    }
    totalSessions = sessions;
    remainingSessions = sessions;
  }

  const adminClient = createSupabaseAdminClient();

  const { data: athlete } = await adminClient
    .from("profiles")
    .select("id, role")
    .eq("id", profileId)
    .eq("organization_id", resolved.organizationId)
    .maybeSingle();

  if (!athlete || getSafeRole(athlete.role) !== "sporcu") {
    return { error: "Sporcu bu organizasyonda bulunamadi." };
  }

  const { data: paymentRow, error } = await adminClient
    .from("payments")
    .insert({
      profile_id: profileId,
      organization_id: resolved.organizationId,
      amount,
      payment_type: paymentType,
      payment_scope: paymentScope,
      payment_kind: paymentKind,
      display_name: displayName,
      due_date: dueDate,
      month_name: monthName,
      year_int: yearInt,
      status: "bekliyor",
      total_sessions: totalSessions,
      remaining_sessions: remainingSessions,
      description: desc,
    })
    .select("id")
    .single();

  if (error || !paymentRow) return { error: `Odeme kaydedilemedi: ${error?.message || "unknown"}` };

  await logAuditEvent({
    actorUserId: resolved.actorUserId,
    actorRole: resolved.actorRole,
    organizationId: resolved.organizationId,
    action: "payment.create",
    entityType: "payment",
    entityId: paymentRow.id as string,
  });

  if (shouldNotifyFinancialEvent("payment_created", paymentScope, paymentKind)) {
    try {
      const typeLabel =
        paymentScope === "private_lesson"
          ? `ozel ders paketi (${totalSessions} seans)`
          : paymentScope === "extra_charge"
            ? (displayName || "ek tahsilat")
            : "aylik aidat";
      await insertNotificationsForUsers(
        [profileId],
        `Yeni odeme kaydi: ₺${amount} (${typeLabel}). Durum: bekliyor.`
      );
    } catch {
      /* bildirim opsiyonel */
    }
  }

  revalidatePath("/finans");
  return { success: true as const };
  });
}

export async function updateOrgPaymentStatus(paymentId: string, status: string) {
  return withServerActionGuard("finance.updateOrgPaymentStatus", async () => {
  const resolved = await resolveFinanceActorForReadWrite(true);
  if ("error" in resolved) return { error: resolved.error };

  if (status !== "bekliyor" && status !== "odendi") {
    return { error: "Gecersiz odeme durumu." };
  }
  if (!assertUuid(paymentId)) return { error: "Gecersiz odeme kaydi." };

  const adminClient = createSupabaseAdminClient();

  let rowRes = await adminClient
    .from("payments")
    .select("id, profile_id, amount, payment_type, payment_scope, payment_kind, due_date")
    .eq("id", paymentId)
    .eq("organization_id", resolved.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (rowRes.error && isPaymentsSchemaCompatibilityError(rowRes.error.message)) {
    rowRes = await adminClient
      .from("payments")
      .select("id, profile_id, amount, payment_type, due_date")
      .eq("id", paymentId)
      .eq("organization_id", resolved.organizationId)
      .maybeSingle();
  }
  const row = rowRes.data;

  if (!row) return { error: "Odeme kaydi bulunamadi." };

  let updateRes = await adminClient
    .from("payments")
    .update({
      status,
      payment_date: status === "odendi" ? new Date().toISOString() : null,
    })
    .eq("id", paymentId)
    .eq("organization_id", resolved.organizationId)
    .is("deleted_at", null);
  if (updateRes.error && isPaymentsSchemaCompatibilityError(updateRes.error.message)) {
    updateRes = await adminClient
      .from("payments")
      .update({
        status,
        payment_date: status === "odendi" ? new Date().toISOString() : null,
      })
      .eq("id", paymentId)
      .eq("organization_id", resolved.organizationId);
  }
  const { error } = updateRes;

  if (error) return { error: `Guncelleme basarisiz: ${error.message}` };

  if (status === "odendi" && row.payment_type === "aylik" && row.profile_id && row.due_date) {
    const { data: profilePlan } = await adminClient
      .from("profiles")
      .select("id, next_aidat_due_date, next_aidat_amount")
      .eq("id", row.profile_id)
      .eq("organization_id", resolved.organizationId)
      .maybeSingle();
    if (profilePlan?.next_aidat_due_date && profilePlan.next_aidat_due_date === row.due_date) {
      const advancedDueDate = addOneMonthFromPlannedDate(profilePlan.next_aidat_due_date);
      await adminClient
        .from("profiles")
        .update({
          next_aidat_due_date: advancedDueDate,
          next_aidat_amount: profilePlan.next_aidat_amount != null ? Number(profilePlan.next_aidat_amount) : null,
        })
        .eq("id", row.profile_id)
        .eq("organization_id", resolved.organizationId);
    }
  }

  await logAuditEvent({
    actorUserId: resolved.actorUserId,
    actorRole: resolved.actorRole,
    organizationId: resolved.organizationId,
    action: "payment.status.update",
    entityType: "payment",
    entityId: paymentId,
    metadata: { status },
  });

  const paymentScope = row.payment_scope === "private_lesson" || row.payment_scope === "extra_charge" ? row.payment_scope : "membership";
  const paymentKind =
    row.payment_kind === "private_lesson_package" ||
    row.payment_kind === "license" ||
    row.payment_kind === "event" ||
    row.payment_kind === "equipment" ||
    row.payment_kind === "manual_other"
      ? row.payment_kind
      : "monthly_membership";
  if (shouldNotifyFinancialEvent("payment_status_updated", paymentScope, paymentKind)) {
    try {
      const st = status === "odendi" ? "odendi" : "bekliyor";
      const notifiedProfileId = row.profile_id || "";
      await insertNotificationsForUsers(
        [notifiedProfileId],
        `Odeme durumu guncellendi: ₺${row.amount} (${row.payment_type}). Yeni durum: ${st}.`
      );
    } catch {
      /* bildirim opsiyonel */
    }
  }

  revalidatePath("/finans");
  if (row.profile_id) {
    revalidatePath(`/finans/${row.profile_id}`);
  }
  revalidatePath("/sporcu/finans");
  return { success: true as const };
  });
}

export async function decrementOrgPaymentPackageSession(paymentId: string) {
  return withServerActionGuard("finance.decrementOrgPaymentPackageSession", async () => {
  const schemaError = await assertCriticalSchemaReady(["production_hardening_atomicity_ready"]);
  if (schemaError) return { error: schemaError };
  const resolved = await resolveFinanceActorForReadWrite(true);
  if ("error" in resolved) return { error: resolved.error };

  if (!assertUuid(paymentId)) return { error: "Gecersiz odeme kaydi." };

  const adminClient = createSupabaseAdminClient();
  const { data: paymentTypeRow } = await adminClient
    .from("payments")
    .select("id, payment_type")
    .eq("id", paymentId)
    .eq("organization_id", resolved.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!paymentTypeRow) return { error: "Odeme kaydi bulunamadi." };
  if (paymentTypeRow.payment_type !== "paket") return { error: "Bu islem yalnizca paket odemeleri icindir." };

  const { data: decrementedRows, error } = await adminClient.rpc(
    "payments_decrement_package_session_atomic",
    {
      p_payment_id: paymentId,
      p_organization_id: resolved.organizationId,
    }
  );

  if (error) {
    captureServerActionSignal("finance.decrementOrgPaymentPackageSession", "atomic_decrement_rpc_failed", {
      paymentId,
      organizationId: resolved.organizationId,
      errorMessage: error.message,
    });
    return { error: `Guncelleme basarisiz: ${error.message}` };
  }
  if (!Array.isArray(decrementedRows) || decrementedRows.length === 0) {
    captureServerActionSignal("finance.decrementOrgPaymentPackageSession", "atomic_decrement_no_rows", {
      paymentId,
      organizationId: resolved.organizationId,
    });
    return { error: "Paket seansi kalmadi." };
  }

  await logAuditEvent({
    actorUserId: resolved.actorUserId,
    actorRole: resolved.actorRole,
    organizationId: resolved.organizationId,
    action: "payment.status.update",
    entityType: "payment",
    entityId: paymentId,
    metadata: { op: "package_session_decrement" },
  });

  revalidatePath("/finans");
  return { success: true as const };
  });
}

async function buildAthleteFinanceDetailByOrg(organizationId: string, athleteId: string): Promise<
  AthleteFinanceDetail | { error: string }
> {
  const adminClient = createSupabaseAdminClient();
  const { data: athlete, error: athleteErr } = await adminClient
    .from("profiles")
    .select("id, full_name, email, number, position, team, organization_id, role, next_aidat_due_date, next_aidat_amount")
    .eq("id", athleteId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (athleteErr || !athlete || getSafeRole(athlete.role) !== "sporcu") {
    return { error: "Sporcu bulunamadi veya organizasyon disi." };
  }

  const paymentsRes = await adminClient
    .from("payments")
    .select("id, profile_id, organization_id, amount, payment_type, payment_scope, payment_kind, display_name, metadata_json, due_date, payment_date, status, total_sessions, remaining_sessions, description, deleted_at, deleted_by, delete_reason")
    .eq("organization_id", organizationId)
    .eq("profile_id", athleteId)
    .is("deleted_at", null)
    .order("due_date", { ascending: false });
  let paymentsData: Array<Parameters<typeof mapPaymentRow>[0]> = [];
  let paymentsErr: string | null = null;
  if (paymentsRes.error && isPaymentsSchemaCompatibilityError(paymentsRes.error.message)) {
    const fallbackRes = await adminClient
      .from("payments")
      .select("id, profile_id, organization_id, amount, payment_type, due_date, payment_date, status, total_sessions, remaining_sessions, description")
      .eq("organization_id", organizationId)
      .eq("profile_id", athleteId)
      .order("due_date", { ascending: false });
    if (fallbackRes.error) paymentsErr = fallbackRes.error.message;
    else paymentsData = (fallbackRes.data || []) as Array<Parameters<typeof mapPaymentRow>[0]>;
  } else if (paymentsRes.error) {
    paymentsErr = paymentsRes.error.message;
  } else {
    paymentsData = (paymentsRes.data || []) as Array<Parameters<typeof mapPaymentRow>[0]>;
  }
  const [packagesRes, packagePaymentsRes] = await Promise.all([
    adminClient
      .from("private_lesson_packages")
      .select("id, organization_id, athlete_id, coach_id, package_type, package_name, total_lessons, used_lessons, remaining_lessons, total_price, amount_paid, payment_status, is_active, created_at, updated_at, athlete_profile:profiles!private_lesson_packages_athlete_id_fkey(full_name, email), coach_profile:profiles!private_lesson_packages_coach_id_fkey(full_name, email)")
      .eq("organization_id", organizationId)
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false }),
    adminClient
      .from("private_lesson_payments")
      .select("id, package_id, athlete_id, coach_id, amount, paid_at, note, created_by, created_at")
      .eq("organization_id", organizationId)
      .eq("athlete_id", athleteId)
      .order("paid_at", { ascending: false }),
  ]);

  if (paymentsErr) return { error: `Aidat gecmisi alinamadi: ${paymentsErr}` };
  if (packagesRes.error) return { error: `Ozel ders paketleri alinamadi: ${packagesRes.error.message}` };
  if (packagePaymentsRes.error) return { error: `Ozel ders odemeleri alinamadi: ${packagePaymentsRes.error.message}` };

  const allPayments = paymentsData.map((row) => mapPaymentRow(row));
  const aidatPayments = allPayments.filter((p) => p.payment_type === "aylik");
  const legacyPackagePayments = allPayments.filter((p) => p.payment_type === "paket");
  const privateLessonPackages = (packagesRes.data || []).map((row) => mapPrivateLessonPackageRow(row as never));
  const privateLessonPayments = (packagePaymentsRes.data || []).map((row) => mapPrivateLessonPaymentRow(row));

  const summary = computeFinanceStatusSummary({
    aidatPayments,
    plannedNextDueDate: athlete.next_aidat_due_date ?? null,
    plannedNextAmount: athlete.next_aidat_amount != null ? Number(athlete.next_aidat_amount) : null,
    hasPartialPackagePayment: privateLessonPackages.some((pkg) => pkg.paymentStatus === "partial"),
  });

  return {
    athlete: {
      id: athlete.id,
      fullName: toDisplayName(athlete.full_name, athlete.email, "Sporcu"),
      number: athlete.number ?? null,
      position: athlete.position ?? null,
      team: athlete.team ?? null,
    },
    summary,
    aidatPayments,
    legacyPackagePayments,
    privateLessonPackages,
    privateLessonPayments,
    totals: {
      aidatPaidTotal: aidatPayments.filter((p) => p.status === "odendi").reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
      aidatPendingTotal: aidatPayments.filter((p) => p.status !== "odendi").reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
      privateLessonPaidTotal: privateLessonPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    },
    nextAidatPlan: {
      dueDate: athlete.next_aidat_due_date ?? null,
      amount: athlete.next_aidat_amount != null ? Number(athlete.next_aidat_amount) : null,
    },
  } satisfies AthleteFinanceDetail;
}

export async function getAthleteFinanceDetailForManagement(athleteId: string): Promise<
  AthleteFinanceDetail | { error: string }
> {
  return withServerActionGuard("finance.getAthleteFinanceDetailForManagement", async () => {
    if (!assertUuid(athleteId)) return { error: "Gecersiz sporcu kimligi." };
    const resolved = await resolveFinanceActorForReadWrite(false);
    if ("error" in resolved) return { error: resolved.error };
    return buildAthleteFinanceDetailByOrg(resolved.organizationId, athleteId);
  });
}

export async function getMyFinanceDetailForAthlete(): Promise<AthleteFinanceDetail | { error: string }> {
  return withServerActionGuard("finance.getMyFinanceDetailForAthlete", async () => {
    const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
    if ("error" in resolved) return { error: resolved.error };
    const actor = toTenantProfileRow(resolved.actor);
    if (!actor.organization_id) return { error: "Organizasyon bilgisi eksik." };
    if (getSafeRole(actor.role) !== "sporcu") return { error: "Bu sayfa yalnizca sporcular icindir." };
    const adminClient = createSupabaseAdminClient();
    const { data: athletePerm } = await adminClient
      .from("athlete_permissions")
      .select("can_view_financial_status")
      .eq("athlete_id", actor.id)
      .maybeSingle();
    if ((athletePerm?.can_view_financial_status ?? true) === false) {
      return { error: "Finansal durum goruntuleme yetkiniz kapali." };
    }
    return buildAthleteFinanceDetailByOrg(actor.organization_id, actor.id);
  });
}

export async function updateAthleteNextAidatPlanForManagement(formData: FormData) {
  return withServerActionGuard("finance.updateAthleteNextAidatPlanForManagement", async () => {
    const athleteId = formData.get("athlete_id")?.toString().trim() || "";
    if (!assertUuid(athleteId)) return { error: "Gecersiz sporcu kimligi." };
    const resolved = await resolveFinanceActorForReadWrite(true);
    if ("error" in resolved) return { error: resolved.error };

    const dueDate = formData.get("next_due_date")?.toString().trim() || "";
    const amountRaw = formData.get("next_amount")?.toString().trim() || "";
    const amount = amountRaw ? Number(amountRaw) : null;
    if (amount != null && (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000)) {
      return { error: "Bir sonraki aidat tutari gecersiz." };
    }
    if (dueDate && Number.isNaN(new Date(`${dueDate}T00:00:00`).getTime())) {
      return { error: "Bir sonraki aidat tarihi gecersiz." };
    }

    const adminClient = createSupabaseAdminClient();
    const { data: target } = await adminClient
      .from("profiles")
      .select("id, role, organization_id")
      .eq("id", athleteId)
      .eq("organization_id", resolved.organizationId)
      .maybeSingle();
    if (!target || getSafeRole(target.role) !== "sporcu") return { error: "Sporcu bulunamadi." };

    const { error } = await adminClient
      .from("profiles")
      .update({
        next_aidat_due_date: dueDate || null,
        next_aidat_amount: amount != null ? Math.round(amount * 100) / 100 : null,
      })
      .eq("id", athleteId)
      .eq("organization_id", resolved.organizationId);
    if (error) return { error: `Aidat plani guncellenemedi: ${error.message}` };

    await logAuditEvent({
      actorUserId: resolved.actorUserId,
      actorRole: resolved.actorRole,
      organizationId: resolved.organizationId,
      action: "payment.status.update",
      entityType: "payment",
      entityId: athleteId,
      metadata: { op: "next_aidat_plan_update", dueDate: dueDate || null, amount: amount ?? null },
    });

    revalidatePath(`/finans/${athleteId}`);
    revalidatePath("/finans");
    revalidatePath("/sporcu/finans");
    return { success: true as const };
  });
}

export async function markPlannedAidatAsPaidForManagement(formData: FormData) {
  return withServerActionGuard("finance.markPlannedAidatAsPaidForManagement", async () => {
    const schemaError = await assertCriticalSchemaReady(["payments_profile_id", "production_hardening_atomicity_ready"]);
    if (schemaError) return { error: schemaError };
    const athleteId = formData.get("athlete_id")?.toString().trim() || "";
    if (!assertUuid(athleteId)) return { error: "Gecersiz sporcu kimligi." };
    const resolved = await resolveFinanceActorForReadWrite(true);
    if ("error" in resolved) return { error: resolved.error };

    const adminClient = createSupabaseAdminClient();
    const { data: athlete } = await adminClient
      .from("profiles")
      .select("id, role, organization_id, next_aidat_due_date, next_aidat_amount")
      .eq("id", athleteId)
      .eq("organization_id", resolved.organizationId)
      .maybeSingle();
    if (!athlete || getSafeRole(athlete.role) !== "sporcu") return { error: "Sporcu bulunamadi." };
    if (!athlete.next_aidat_due_date) return { error: "Planlanan aidat tarihi bulunamadi." };
    const plannedAmount = athlete.next_aidat_amount != null ? Number(athlete.next_aidat_amount) : 0;
    if (!Number.isFinite(plannedAmount) || plannedAmount <= 0) {
      return { error: "Planlanan aidat tutari gecersiz." };
    }

    const plannedDueDate = athlete.next_aidat_due_date;
    const { monthName, yearInt } = resolvePaymentPeriod(plannedDueDate);

    const paymentPayload = {
      profile_id: athleteId,
      organization_id: resolved.organizationId,
      amount: plannedAmount,
      payment_type: "aylik",
      due_date: plannedDueDate,
      payment_date: new Date().toISOString(),
      month_name: monthName,
      year_int: yearInt,
      status: "odendi" as const,
      description: `Planlanan aidat (${plannedDueDate})`,
    };

    let targetPaymentId = "";
    const upsertRes = await adminClient
      .from("payments")
      .upsert(paymentPayload, {
        onConflict: "organization_id,profile_id,payment_type,due_date",
      })
      .select("id");

    if (upsertRes.error && upsertRes.error.code === "42P10") {
      captureServerActionSignal("finance.markPlannedAidatAsPaidForManagement", "upsert_constraint_missing_fallback_used", {
        athleteId,
        organizationId: resolved.organizationId,
        dueDate: plannedDueDate,
      });
      const { data: existingPayment } = await adminClient
        .from("payments")
        .select("id")
        .eq("organization_id", resolved.organizationId)
        .eq("profile_id", athleteId)
        .eq("payment_type", "aylik")
        .eq("due_date", plannedDueDate)
        .is("deleted_at", null)
        .maybeSingle();
      if (existingPayment?.id) {
        const { error: updateErr } = await adminClient
          .from("payments")
          .update(paymentPayload)
          .eq("id", existingPayment.id)
          .eq("organization_id", resolved.organizationId);
        if (updateErr) return { error: `Planlanan aidat odendiye alinamadi: ${updateErr.message}` };
        targetPaymentId = existingPayment.id;
      } else {
        const { data: inserted, error: insertErr } = await adminClient
          .from("payments")
          .insert(paymentPayload)
          .select("id")
          .single();
        if (insertErr || !inserted) {
          return { error: `Planlanan aidat odeme kaydi olusturulamadi: ${insertErr?.message || "unknown"}` };
        }
        targetPaymentId = inserted.id as string;
      }
    } else if (upsertRes.error || !upsertRes.data || upsertRes.data.length === 0) {
      if (upsertRes.error) {
        captureServerActionSignal("finance.markPlannedAidatAsPaidForManagement", "planned_aidat_upsert_failed", {
          athleteId,
          organizationId: resolved.organizationId,
          dueDate: plannedDueDate,
          errorCode: upsertRes.error.code,
          errorMessage: upsertRes.error.message,
        });
      }
      return { error: `Planlanan aidat odeme kaydi olusturulamadi: ${upsertRes.error?.message || "unknown"}` };
    } else {
      targetPaymentId = upsertRes.data[0].id as string;
    }

    const advancedDueDate = addOneMonthFromPlannedDate(plannedDueDate);
    const { error: planUpdateErr } = await adminClient
      .from("profiles")
      .update({
        next_aidat_due_date: advancedDueDate,
        next_aidat_amount: plannedAmount,
      })
      .eq("id", athleteId)
      .eq("organization_id", resolved.organizationId);
    if (planUpdateErr) return { error: `Bir sonraki aidat plani guncellenemedi: ${planUpdateErr.message}` };

    await logAuditEvent({
      actorUserId: resolved.actorUserId,
      actorRole: resolved.actorRole,
      organizationId: resolved.organizationId,
      action: "payment.status.update",
      entityType: "payment",
      entityId: targetPaymentId,
      metadata: { op: "planned_aidat_mark_paid", plannedDueDate, advancedDueDate, amount: plannedAmount },
    });

    if (shouldNotifyFinancialEvent("planned_payment_marked_paid", "membership", "monthly_membership")) {
      try {
        await insertNotificationsForUsers(
          [athleteId],
          `Aidat odemesi tamamlandi. Odeme tarihi: ${plannedDueDate}. Bir sonraki aidat: ${advancedDueDate}.`
        );
      } catch {
        /* bildirim opsiyonel */
      }
    }

    revalidatePath("/finans");
    revalidatePath(`/finans/${athleteId}`);
    revalidatePath("/sporcu/finans");
    return { success: true as const };
  });
}

export async function softDeleteOrgPayment(formData: FormData) {
  return withServerActionGuard("finance.softDeleteOrgPayment", async () => {
    const resolved = await resolveFinanceActorForReadWrite(true);
    if ("error" in resolved) return { error: resolved.error };

    const paymentId = formData.get("payment_id")?.toString().trim() || "";
    const reason = formData.get("delete_reason")?.toString().trim().slice(0, 250) || "manual_cleanup";
    if (!assertUuid(paymentId)) return { error: "Gecersiz odeme kaydi." };

    const adminClient = createSupabaseAdminClient();
    const { data: row } = await adminClient
      .from("payments")
      .select("id, profile_id")
      .eq("id", paymentId)
      .eq("organization_id", resolved.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!row) return { error: "Odeme kaydi bulunamadi." };

    const { error } = await adminClient
      .from("payments")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: resolved.actorUserId,
        delete_reason: reason,
      })
      .eq("id", paymentId)
      .eq("organization_id", resolved.organizationId)
      .is("deleted_at", null);
    if (error) return { error: `Odeme silinemedi: ${error.message}` };

    await logAuditEvent({
      actorUserId: resolved.actorUserId,
      actorRole: resolved.actorRole,
      organizationId: resolved.organizationId,
      action: "payment.status.update",
      entityType: "payment",
      entityId: paymentId,
      metadata: { op: "soft_delete", reason },
    });

    revalidatePath("/finans");
    if (row.profile_id) revalidatePath(`/finans/${row.profile_id}`);
    revalidatePath("/sporcu/finans");
    return { success: true as const };
  });
}
