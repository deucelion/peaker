"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { getCoachPermissions, hasCoachPermission } from "@/lib/auth/coachPermissions";
import { FINANCE_ADMIN_ONLY_MESSAGE } from "@/lib/finance/messages";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { insertNotificationsForUsers } from "@/lib/notifications/serverInsert";
import type { PaymentRow, PlayerWithPayments } from "@/types/domain";
import type { AthleteFinanceDetail, FinanceStatusSummary, PrivateLessonPayment } from "@/lib/types";
import { computeFinanceStatusSummary, sumPackageOpenBalance } from "@/lib/finance/paymentSummary";
import { shouldNotifyFinancialEvent } from "@/lib/finance/notificationPolicy";
import { toDisplayName } from "@/lib/profile/displayName";
import { resolveSessionActor, toTenantProfileRow } from "@/lib/auth/resolveSessionActor";
import { isUuid } from "@/lib/validation/uuid";
import { withServerActionGuard } from "@/lib/observability/serverActionError";
import { captureServerActionSignal } from "@/lib/observability/serverActionError";
import { assertCriticalSchemaReady } from "@/lib/diagnostics/systemHealth";
import { isPaymentsSchemaCompatibilityError } from "@/lib/payments/paymentsSchemaCompatibility";
import { normalizeMoney, parseMoneyInput } from "@/lib/privateLessons/packageMath";
import { mapPaymentRowForAthlete } from "@/lib/finance/unifiedAthletePaymentTimeline";
import { resolveOrganizationTimeZone } from "@/lib/organization/timeZone";
import { chunkedInQuery } from "@/lib/db/chunkedIn";
import {
  applyPrivateLessonPaymentActiveFilter,
  getSchemaCapabilities,
  mapPackageRowCompat,
  runPackageSelectWithCompat,
  userFacingDataError,
  type RawPackageRow,
} from "@/lib/schemaCompat";

function paymentEffectiveInstantMs(p: PaymentRow): number {
  const pd = p.payment_date?.trim();
  if (pd) {
    const t = new Date(pd).getTime();
    if (Number.isFinite(t)) return t;
  }
  const dd = p.due_date?.trim();
  if (dd) {
    const t = new Date(`${dd}T12:00:00`).getTime();
    if (Number.isFinite(t)) return t;
  }
  return 0;
}

function paymentDisplayIsoDate(p: PaymentRow): string | null {
  const pd = p.payment_date?.trim();
  if (pd) {
    const d = new Date(pd);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const dd = p.due_date?.trim();
  if (dd && /^\d{4}-\d{2}-\d{2}$/.test(dd)) return dd;
  return null;
}

type PaymentScope = "membership" | "private_lesson" | "extra_charge";
type PaymentKind =
  | "monthly_membership"
  | "private_lesson_package"
  | string;

function normalizePaymentKindKey(input: string | null | undefined, fallback: string): string {
  const raw = String(input || "")
    .trim()
    .toLowerCase();
  if (!raw) return fallback;
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return normalized || fallback;
}

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

/**
 * `payments.due_date` (YYYY-MM-DD, takvim günü) için ay/yıl etiketini döndürür.
 *
 * Eski sürüm `T00:00:00` (TZ'siz) parse edip `getMonth()/getFullYear()` çağırıyordu;
 * Node sunucusu UTC çalışırken Europe/Istanbul gibi pozitif UTC offset'lerde 31 Ocak
 * gibi sınır günler için sapma yoktu ama Node lokali başka bir TZ'de çalıştığında
 * (örn. America/Los_Angeles) 31 Ocak → "Aralık" olarak okunabiliyordu. Sabit
 * `T12:00:00Z` (UTC öğlen) ile artık her sunucu lokalinde aynı gün okunur.
 */
function resolvePaymentPeriod(dueDate: string | null): { monthName: string; yearInt: number } {
  if (dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    const [yStr, mStr] = dueDate.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
      return {
        monthName: MONTH_NAMES_TR[m - 1] ?? "Ocak",
        yearInt: y,
      };
    }
  }
  const baseDate = dueDate ? new Date(`${dueDate}T12:00:00Z`) : new Date();
  if (Number.isNaN(baseDate.getTime())) {
    const now = new Date();
    return {
      monthName: MONTH_NAMES_TR[now.getUTCMonth()] ?? "Ocak",
      yearInt: now.getUTCFullYear(),
    };
  }
  return {
    monthName: MONTH_NAMES_TR[baseDate.getUTCMonth()] ?? "Ocak",
    yearInt: baseDate.getUTCFullYear(),
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
    const kind: PaymentKind = normalizePaymentKindKey(kindRaw, "extra_charge");
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

/**
 * Finans alanı için hata sınıflandırması (Faz 2.4).
 * UI bu alana göre "Yetkiniz yok" / "Veri yok" / "Hata" bannerlarını ayrıştırır.
 */
export type FinanceErrorKind = "permission_denied" | "auth_required" | "invalid_input" | "fetch_error";

async function resolveFinanceActorForReadWrite(requireWrite: boolean): Promise<
  | { actorUserId: string; actorRole: string; organizationId: string }
  | { error: string; errorKind: FinanceErrorKind }
> {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
  if ("error" in resolved) return { error: resolved.error, errorKind: "auth_required" };
  const actor = toTenantProfileRow(resolved.actor);
  if (!actor.organization_id) return { error: "Kullanici profili dogrulanamadi.", errorKind: "auth_required" };
  const role = getSafeRole(actor.role);
  if (role !== "admin" && role !== "coach") {
    return { error: FINANCE_ADMIN_ONLY_MESSAGE, errorKind: "permission_denied" };
  }
  if (role === "coach") {
    const perms = await getCoachPermissions(actor.id, actor.organization_id);
    if (!hasCoachPermission(perms, "can_view_reports")) {
      return { error: "Finans detayini goruntuleme yetkiniz yok.", errorKind: "permission_denied" };
    }
    if (requireWrite && !hasCoachPermission(perms, "can_manage_athlete_profiles")) {
      return { error: "Finans planini guncelleme yetkiniz yok.", errorKind: "permission_denied" };
    }
  }
  return { actorUserId: actor.id, actorRole: actor.role, organizationId: actor.organization_id };
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

export type OrgFinanceSnapshot = {
  players: Array<
    PlayerWithPayments & {
      financeSummary: FinanceStatusSummary;
      nextAidatPlan: { dueDate: string | null; amount: number | null };
      paymentModel: "Aylik" | "Paket" | "Hibrit" | "Özel tahsilat";
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

  let paymentRows: Array<Parameters<typeof mapPaymentRowForAthlete>[0]> = [];
  let privateLessonPackageRows: Array<{
    athlete_id: string;
    package_name: string | null;
    payment_status: "unpaid" | "partial" | "paid";
    is_active: boolean;
    created_at: string;
    total_price: number | string | null;
    amount_paid: number | string | null;
  }> = [];
  if (athleteIds.length > 0) {
    // Faz 9.2 — chunked .in() for 1000+ athlete fan-out.
    const payRes = await chunkedInQuery(
      athleteIds,
      async (chunk) =>
        await adminClient
          .from("payments")
          .select(
            "id, profile_id, organization_id, amount, payment_type, payment_scope, payment_kind, display_name, metadata_json, due_date, payment_date, status, total_sessions, remaining_sessions, description, deleted_at, deleted_by, delete_reason"
          )
          .eq("organization_id", resolved.organizationId)
          .in("profile_id", chunk)
          .is("deleted_at", null),
      { scope: "financeActions.loadFinanceForAthletes.payments" }
    );
    if (payRes.error && isPaymentsSchemaCompatibilityError(payRes.error.message)) {
      const payFallbackRes = await chunkedInQuery(
        athleteIds,
        async (chunk) =>
          await adminClient
            .from("payments")
            .select(
              "id, profile_id, organization_id, amount, payment_type, due_date, payment_date, status, total_sessions, remaining_sessions, description"
            )
            .eq("organization_id", resolved.organizationId)
            .in("profile_id", chunk),
        { scope: "financeActions.loadFinanceForAthletes.payments.fallback" }
      );
      if (payFallbackRes.error) return { error: `Odeme listesi alinamadi: ${payFallbackRes.error.message}` };
      paymentRows = (payFallbackRes.data || []) as Array<Parameters<typeof mapPaymentRowForAthlete>[0]>;
    } else {
      if (payRes.error) return { error: `Odeme listesi alinamadi: ${payRes.error.message}` };
      paymentRows = (payRes.data || []) as Array<Parameters<typeof mapPaymentRowForAthlete>[0]>;
    }
    const packageRes = await chunkedInQuery(
      athleteIds,
      async (chunk) =>
        await adminClient
          .from("private_lesson_packages")
          .select("athlete_id, package_name, payment_status, is_active, created_at, total_price, amount_paid")
          .eq("organization_id", resolved.organizationId)
          .in("athlete_id", chunk)
          .order("created_at", { ascending: false }),
      { scope: "financeActions.loadFinanceForAthletes.packages" }
    );
    if (packageRes.error) return { error: `Paket listesi alinamadi: ${packageRes.error.message}` };
    // Chunk birleştirme sonrası DESC by created_at — parity koru.
    const merged = (packageRes.data || []) as typeof privateLessonPackageRows;
    if (merged.length > 1) {
      merged.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    }
    privateLessonPackageRows = merged;
  }

  let privateLessonPaymentLedgerRows: Array<{
    athlete_id: string;
    amount: number | string;
    paid_at: string;
  }> = [];
  if (athleteIds.length > 0) {
    const caps = await getSchemaCapabilities();
    const plpRes = await chunkedInQuery(
      athleteIds,
      async (chunk) =>
        await applyPrivateLessonPaymentActiveFilter(
          adminClient
            .from("private_lesson_payments")
            .select("athlete_id, amount, paid_at")
            .eq("organization_id", resolved.organizationId)
            .in("athlete_id", chunk),
          caps
        ),
      { scope: "financeActions.loadFinanceForAthletes.ledger" }
    );
    if (plpRes.error) {
      return { error: userFacingDataError("Özel ders ödeme geçmişi alınamadı", plpRes.error.message) };
    }
    privateLessonPaymentLedgerRows = (plpRes.data || []) as typeof privateLessonPaymentLedgerRows;
  }

  const paymentsByProfile = new Map<string, PaymentRow[]>();
  paymentRows.forEach((row) => {
    const mapped = mapPaymentRowForAthlete(row);
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

  const plpByAthlete = new Map<string, typeof privateLessonPaymentLedgerRows>();
  privateLessonPaymentLedgerRows.forEach((row) => {
    const list = plpByAthlete.get(row.athlete_id) || [];
    list.push(row);
    plpByAthlete.set(row.athlete_id, list);
  });

  const players = (profileRows || []).map((row) => {
    const payments = paymentsByProfile.get(row.id) || [];
    const packages = packageByAthlete.get(row.id) || [];
    const aidatPayments = payments.filter((p) => p.payment_type === "aylik");
    const extraPayments = payments.filter((p) => p.payment_scope === "extra_charge");
    const packagePayments = payments.filter((p) => p.payment_type === "paket" || p.payment_scope === "private_lesson");
    const packageOpenBalance = sumPackageOpenBalance(packages);
    const financeSummary = computeFinanceStatusSummary({
      aidatPayments,
      plannedNextDueDate: row.next_aidat_due_date ?? null,
      plannedNextAmount: row.next_aidat_amount != null ? Number(row.next_aidat_amount) : null,
      hasPartialPackagePayment: packages.some((p) => p.payment_status === "partial"),
      packageOpenBalance,
    });
    const activePackage = packages.find((p) => p.is_active) || packages[0] || null;
    const hasAidat = aidatPayments.length > 0 || row.next_aidat_due_date != null;
    const hasPackage = packagePayments.length > 0 || packages.length > 0;
    const hasExtra = extraPayments.length > 0;
    const paymentModel: OrgFinanceSnapshot["players"][number]["paymentModel"] =
      hasAidat && hasPackage ? "Hibrit" : hasAidat ? "Aylik" : hasPackage ? "Paket" : hasExtra ? "Özel tahsilat" : "Aylik";
    const bekliyorPending = normalizeMoney(
      payments.filter((p) => p.status === "bekliyor").reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    );
    const pendingAmountTotalForAthlete = normalizeMoney(bekliyorPending + packageOpenBalance);
    const overdueAmountForAthlete = payments
      .filter((p) => p.status === "bekliyor" && p.due_date)
      .filter((p) => new Date(`${p.due_date}T00:00:00`).getTime() < new Date().setHours(0, 0, 0, 0))
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    type LatestLedgerCand = { ms: number; date: string | null; amount: number };
    const ledgerCandidates: LatestLedgerCand[] = [];
    for (const p of payments) {
      if (p.status !== "odendi") continue;
      ledgerCandidates.push({
        ms: paymentEffectiveInstantMs(p),
        date: paymentDisplayIsoDate(p),
        amount: normalizeMoney(p.amount),
      });
    }
    for (const plp of plpByAthlete.get(row.id) || []) {
      const ms = new Date(plp.paid_at).getTime();
      ledgerCandidates.push({
        ms: Number.isFinite(ms) ? ms : 0,
        date: plp.paid_at.slice(0, 10),
        amount: normalizeMoney(plp.amount),
      });
    }
    ledgerCandidates.sort((a, b) => {
      if (b.ms !== a.ms) return b.ms - a.ms;
      return String(b.date || "").localeCompare(String(a.date || ""));
    });
    const latestLedger = ledgerCandidates.find((c) => c.ms > 0) ?? ledgerCandidates[0] ?? null;
    const activeProductLabel =
      activePackage?.package_name ||
      (row.next_aidat_due_date ? `Aidat (${row.next_aidat_due_date})` : hasExtra ? "Özel tahsilatlar" : null);
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
      lastPaymentDate: latestLedger?.date ?? null,
      lastPaymentAmount: latestLedger != null ? latestLedger.amount : null,
    };
  }) as OrgFinanceSnapshot["players"];

  const pendingAmountTotal = players.reduce((sum, p) => sum + p.pendingAmountTotal, 0);
  const allPayments = players.flatMap((p) => p.payments || []);
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

  const amountRaw = formData.get("amount")?.toString();
  const amount = parseMoneyInput(amountRaw);
  if (amount == null || amount <= 0 || amount > 1_000_000_000) {
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

  const descriptionWithLabel =
    displayName && desc ? `${displayName} — ${desc}` : displayName || desc;

  let insertRes = await adminClient
    .from("payments")
    .insert({
      profile_id: profileId,
      organization_id: resolved.organizationId,
      amount,
      payment_type: paymentType,
      payment_scope: paymentScope,
      payment_kind: paymentKind,
      due_date: dueDate,
      month_name: monthName,
      year_int: yearInt,
      status: "bekliyor",
      total_sessions: totalSessions,
      remaining_sessions: remainingSessions,
      description: descriptionWithLabel,
    })
    .select("id")
    .single();

  if (insertRes.error && isPaymentsSchemaCompatibilityError(insertRes.error.message)) {
    insertRes = await adminClient
      .from("payments")
      .insert({
        profile_id: profileId,
        organization_id: resolved.organizationId,
        amount,
        payment_type: paymentType,
        due_date: dueDate,
        month_name: monthName,
        year_int: yearInt,
        status: "bekliyor",
        total_sessions: totalSessions,
        remaining_sessions: remainingSessions,
        description: descriptionWithLabel,
      })
      .select("id")
      .single();
  }

  const { data: paymentRow, error } = insertRes;

  if (error || !paymentRow) return { error: "Ödeme kaydedilemedi. Lütfen tekrar deneyin veya yöneticinize bildirin." };

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
        `Yeni odeme kaydi: ₺${amount} (${typeLabel}). Durum: bekliyor.`,
        "payment.scheduled"
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
        `Odeme durumu guncellendi: ₺${row.amount} (${row.payment_type}). Yeni durum: ${st}.`,
        st === "odendi" ? "payment.received" : "payment.scheduled"
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
  let paymentsData: Array<Parameters<typeof mapPaymentRowForAthlete>[0]> = [];
  let paymentsErr: string | null = null;
  if (paymentsRes.error && isPaymentsSchemaCompatibilityError(paymentsRes.error.message)) {
    const fallbackRes = await adminClient
      .from("payments")
      .select("id, profile_id, organization_id, amount, payment_type, due_date, payment_date, status, total_sessions, remaining_sessions, description")
      .eq("organization_id", organizationId)
      .eq("profile_id", athleteId)
      .order("due_date", { ascending: false });
    if (fallbackRes.error) paymentsErr = fallbackRes.error.message;
    else paymentsData = (fallbackRes.data || []) as Array<Parameters<typeof mapPaymentRowForAthlete>[0]>;
  } else if (paymentsRes.error) {
    paymentsErr = paymentsRes.error.message;
  } else {
    paymentsData = (paymentsRes.data || []) as Array<Parameters<typeof mapPaymentRowForAthlete>[0]>;
  }
  const caps = await getSchemaCapabilities();
  const packagesFetch = await runPackageSelectWithCompat(caps, async (select) => {
    const { data, error } = await adminClient
      .from("private_lesson_packages")
      .select(select)
      .eq("organization_id", organizationId)
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false });
    return { data, error };
  });
  const packagePaymentsRes = await applyPrivateLessonPaymentActiveFilter(
    adminClient
      .from("private_lesson_payments")
      .select("id, package_id, athlete_id, coach_id, amount, paid_at, note, created_by, created_at")
      .eq("organization_id", organizationId)
      .eq("athlete_id", athleteId)
      .order("paid_at", { ascending: false }),
    caps
  );

  if (paymentsErr) return { error: `Aidat gecmisi alinamadi: ${paymentsErr}` };
  if (packagesFetch.error) {
    return { error: userFacingDataError("Özel ders paketleri alınamadı", packagesFetch.error.message) };
  }
  if (packagePaymentsRes.error) {
    return { error: userFacingDataError("Özel ders ödeme geçmişi alınamadı", packagePaymentsRes.error.message) };
  }

  const allPayments = paymentsData.map((row) => mapPaymentRowForAthlete(row));
  const aidatPayments = allPayments.filter((p) => p.payment_type === "aylik");
  const legacyPackagePayments = allPayments.filter((p) => p.payment_type === "paket");
  const privateLessonPackages = ((packagesFetch.data || []) as unknown as RawPackageRow[]).map((row) =>
    mapPackageRowCompat(row)
  );
  const privateLessonPayments = (packagePaymentsRes.data || []).map((row) => mapPrivateLessonPaymentRow(row));

  const summary = computeFinanceStatusSummary({
    aidatPayments,
    plannedNextDueDate: athlete.next_aidat_due_date ?? null,
    plannedNextAmount: athlete.next_aidat_amount != null ? Number(athlete.next_aidat_amount) : null,
    hasPartialPackagePayment: privateLessonPackages.some((pkg) => pkg.paymentStatus === "partial"),
    packageOpenBalance: sumPackageOpenBalance(
      privateLessonPackages.map((p) => ({
        payment_status: p.paymentStatus,
        total_price: p.totalPrice,
        amount_paid: p.amountPaid,
      }))
    ),
  });

  const orgTimeZone = await resolveOrganizationTimeZone(organizationId);

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
    timeZone: orgTimeZone,
  } satisfies AthleteFinanceDetail;
}

export async function getAthleteFinanceDetailForManagement(athleteId: string): Promise<
  AthleteFinanceDetail | { error: string; errorKind?: FinanceErrorKind }
> {
  return withServerActionGuard("finance.getAthleteFinanceDetailForManagement", async () => {
    if (!assertUuid(athleteId)) return { error: "Gecersiz sporcu kimligi.", errorKind: "invalid_input" as const };
    const resolved = await resolveFinanceActorForReadWrite(false);
    if ("error" in resolved) return { error: resolved.error, errorKind: resolved.errorKind };
    return buildAthleteFinanceDetailByOrg(resolved.organizationId, athleteId);
  });
}

export async function getMyFinanceDetailForAthlete(): Promise<
  AthleteFinanceDetail | { error: string; errorKind?: FinanceErrorKind }
> {
  return withServerActionGuard("finance.getMyFinanceDetailForAthlete", async () => {
    const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
    if ("error" in resolved) return { error: resolved.error, errorKind: "auth_required" as const };
    const actor = toTenantProfileRow(resolved.actor);
    if (!actor.organization_id) return { error: "Organizasyon bilgisi eksik.", errorKind: "auth_required" as const };
    if (getSafeRole(actor.role) !== "sporcu") {
      return { error: "Bu sayfa yalnizca sporcular icindir.", errorKind: "permission_denied" as const };
    }
    const adminClient = createSupabaseAdminClient();
    const { data: athletePerm } = await adminClient
      .from("athlete_permissions")
      .select("can_view_financial_status")
      .eq("athlete_id", actor.id)
      .maybeSingle();
    if ((athletePerm?.can_view_financial_status ?? true) === false) {
      return { error: "Finansal durum goruntuleme yetkiniz kapali.", errorKind: "permission_denied" as const };
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
    const amount = amountRaw ? parseMoneyInput(amountRaw) : null;
    if (amountRaw && amount == null) {
      return { error: "Bir sonraki aidat tutari gecersiz." };
    }
    if (amount != null && (amount < 0 || amount > 1_000_000_000)) {
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
          `Aidat odemesi tamamlandi. Odeme tarihi: ${plannedDueDate}. Bir sonraki aidat: ${advancedDueDate}.`,
          "payment.received"
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
