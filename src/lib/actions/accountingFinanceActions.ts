"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { isUuid } from "@/lib/validation/uuid";
import { toDisplayName } from "@/lib/profile/displayName";
import { calculateCoachPayout, pickCoachRule, type CoachPaymentRuleForCalc } from "@/lib/accountingFinance/payoutCalculation";
import { isCoachPayoutTrackingPending } from "@/lib/accountingFinance/coachPayoutTracking";
import {
  istanbulCustomRangeToPayoutDateInclusiveBounds,
  istanbulDateWallRangeToHalfOpenUtc,
  istanbulMonthToPayoutDateInclusiveBounds,
  istanbulMonthWallToHalfOpenUtc,
} from "@/lib/accountingFinance/istanbulQueryRange";
import { isoToZonedDateKey, SCHEDULE_APP_TIME_ZONE, wallClockInZoneToUtcIso } from "@/lib/schedule/scheduleWallTime";

type LessonTypeFilter = "all" | "group" | "private";
type LessonStatusFilter = "all" | "planned" | "completed" | "cancelled";
type PaymentStatusFilter = "all" | "bekliyor" | "odendi";
type PaymentKindNormalized =
  | "monthly_membership"
  | "private_lesson_package"
  | "license"
  | "event"
  | "equipment"
  | "manual_other"
  | "other";
type PaymentScopeNormalized = "membership" | "private_lesson" | "extra_charge" | "other";

export type AccountingFinanceFilters = {
  orgId?: string | null;
  month?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  coachId?: string | null;
  lessonType?: LessonTypeFilter;
  lessonStatus?: LessonStatusFilter;
  paymentKind?: string | null;
  paymentStatus?: PaymentStatusFilter;
};

export type AccountingFinancePaymentRow = {
  id: string;
  athleteId: string | null;
  athleteName: string;
  amount: number;
  paymentDate: string | null;
  dueDate: string | null;
  status: "bekliyor" | "odendi";
  paymentKind: string;
  paymentScope: string;
  paymentType: string;
  sourceLabel: string;
};

export type AccountingFinanceLessonRow = {
  id: string;
  sourceType: "group" | "private";
  payoutSourceType: "group_lesson" | "private_lesson";
  title: string;
  startsAt: string;
  endsAt: string | null;
  status: "planned" | "completed" | "cancelled";
  coachId: string | null;
  coachName: string;
  location: string | null;
  participantCount: number;
  lessonPrice: number | null;
  coachPayoutEligible: boolean;
  payoutItemId: string | null;
  payoutStatus: "eligible" | "included" | "paid" | null;
  payoutAmount: number;
  calculationStatus: "ok" | "no_rule" | "no_price" | "not_eligible";
};

export type AccountingFinanceSnapshot = {
  organizationId: string;
  actorRole: "admin" | "super_admin";
  canManagePayouts: boolean;
  compatibilityNotice: string | null;
  filtersApplied: {
    month: string;
    dateFrom: string;
    dateTo: string;
    coachId: string | null;
    lessonType: LessonTypeFilter;
    lessonStatus: LessonStatusFilter;
    paymentKind: string | null;
    paymentStatus: PaymentStatusFilter;
    rangeMode: "month" | "custom_range";
  };
  kpis: {
    totalCollected: number;
    pendingCollection: number;
    coachPayoutEligibleLessonCount: number;
    payoutPendingCount: number;
    payoutIncludedCount: number;
    payoutPaidCount: number;
    payoutAmountTotal: number;
    payoutAmountPending: number;
    payoutAmountPaid: number;
    estimatedNet: null;
  };
  payments: AccountingFinancePaymentRow[];
  lessons: AccountingFinanceLessonRow[];
  options: {
    coaches: Array<{ id: string; full_name: string }>;
    athletes: Array<{ id: string; full_name: string }>;
    paymentKinds: string[];
    lessonStatuses: LessonStatusFilter[];
    paymentStatuses: PaymentStatusFilter[];
  };
};

/** Supabase timestamptz filtreleri: [from, toExclusive) — gün sonu ms kaçırma riski yok. */
type UtcHalfOpenRange = { from: string; toExclusive: string };

function inclusiveUtcEndIso(toExclusive: string): string {
  const t = new Date(toExclusive).getTime();
  if (!Number.isFinite(t) || t <= 0) return toExclusive;
  return new Date(t - 1).toISOString();
}

function normalizePaymentDisplayDate(row: Record<string, unknown>): string | null {
  const pd = row.payment_date;
  if (pd != null && typeof pd === "string" && pd.trim()) return pd.trim();
  const pa = row.paid_at;
  if (pa != null && typeof pa === "string" && pa.trim()) return pa.trim();
  const ca = row.created_at;
  if (ca != null && typeof ca === "string" && ca.trim()) return ca.trim();
  return null;
}

function currentMonthKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

function normalizeLessonStatus(status: string | null | undefined): "planned" | "completed" | "cancelled" {
  const s = String(status || "").toLowerCase();
  if (s === "cancelled") return "cancelled";
  if (s === "completed") return "completed";
  return "planned";
}

function isPaymentsSchemaCompatibilityError(message?: string | null): boolean {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("payments.payment_kind") ||
    m.includes("payments.payment_scope") ||
    m.includes("payments.display_name") ||
    m.includes("payments.metadata_json") ||
    m.includes("payments.deleted_at") ||
    m.includes("payments.due_date") ||
    m.includes("payments.paid_at") ||
    m.includes("payments.package_id") ||
    m.includes("payments.created_at")
  );
}

/** Sunucu konsolu: gerçek PostgREST / Postgres mesajı (UI'da gösterme). */
function logPaymentsQueryFailure(
  stage: string,
  error: { message?: string; code?: string; details?: string; hint?: string } | null | undefined
) {
  const message = error?.message?.trim();
  if (!message && !error?.code) return;
  console.error("[accountingFinance] payments query failed", {
    stage,
    message: error?.message ?? null,
    code: error?.code ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
  });
}

/**
 * Şema / ilişki / eksik kolon hatasında daha ince sorguya düş.
 * Yetkilendirme veya RLS gibi gerçek hatalarda fallback yapma.
 */
function shouldFallbackPaymentsQuery(message?: string | null): boolean {
  const m = String(message || "").toLowerCase();
  if (!m) return false;
  if (
    m.includes("permission denied") ||
    m.includes("rls policy") ||
    m.includes("row-level security") ||
    m.includes("jwt") ||
    m.includes("invalid api key")
  ) {
    return false;
  }
  return (
    isPaymentsSchemaCompatibilityError(m) ||
    m.includes("created_at") ||
    m.includes("could not embed") ||
    m.includes("could not find a relationship") ||
    m.includes("more than one relationship") ||
    m.includes("42703") ||
    (m.includes("column") && m.includes("does not exist")) ||
    m.includes("schema cache")
  );
}

function inferPaymentKindFromLegacyRow(row: Record<string, unknown>): PaymentKindNormalized {
  const rawKind = String(row.payment_kind || "")
    .trim()
    .toLowerCase();
  if (
    rawKind === "monthly_membership" ||
    rawKind === "private_lesson_package" ||
    rawKind === "license" ||
    rawKind === "event" ||
    rawKind === "equipment" ||
    rawKind === "manual_other" ||
    rawKind === "other"
  ) {
    return rawKind;
  }

  const packageId = String(row.package_id || "").trim();
  if (isUuid(packageId)) return "private_lesson_package";

  const metadata = row.metadata_json;
  const metadataText = typeof metadata === "string" ? metadata.toLowerCase() : JSON.stringify(metadata || {}).toLowerCase();
  const description = String(row.description || "").toLowerCase();
  const source = `${metadataText} ${description}`;
  if (source.includes("lisans")) return "license";
  if (source.includes("etkinlik") || source.includes("event")) return "event";
  if (source.includes("ekipman") || source.includes("equipment")) return "equipment";
  if (source.includes("paket") || source.includes("özel ders") || source.includes("ozel ders")) return "private_lesson_package";
  if (String(row.profile_id || "").trim()) return "monthly_membership";
  return "other";
}

function inferPaymentScopeFromLegacyRow(row: Record<string, unknown>): PaymentScopeNormalized {
  const rawScope = String(row.payment_scope || "")
    .trim()
    .toLowerCase();
  if (rawScope === "membership" || rawScope === "private_lesson" || rawScope === "extra_charge") return rawScope;
  const kind = inferPaymentKindFromLegacyRow(row);
  if (kind === "private_lesson_package") return "private_lesson";
  if (kind === "monthly_membership") return "membership";
  if (kind === "license" || kind === "event" || kind === "equipment" || kind === "manual_other" || kind === "other") return "extra_charge";
  return "other";
}

async function loadPaymentsWithCompatibility(args: {
  organizationId: string;
  range: UtcHalfOpenRange;
  paymentDateBounds: { fromKey: string; toKeyInclusive: string };
  paymentStatus: PaymentStatusFilter;
  paymentKind: string | null;
}): Promise<
  | { rows: Record<string, unknown>[]; compatibilityMode: boolean }
  | { error: string }
> {
  const adminClient = createSupabaseAdminClient();
  const { organizationId, range, paymentDateBounds, paymentStatus, paymentKind } = args;

  const PAY_EMBED = "athlete_profile:profiles!payments_profile_id_fkey(full_name, email)";
  const MODERN_SELECT =
    "id, profile_id, package_id, amount, payment_type, payment_date, paid_at, due_date, status, payment_kind, payment_scope, display_name, metadata_json, description, deleted_at, created_at";
  const FALLBACK_SELECT =
    "id, profile_id, package_id, amount, payment_type, payment_date, paid_at, due_date, status, payment_scope, display_name, metadata_json, description, created_at";
  const MINIMAL_PKG_SELECT =
    "id, profile_id, package_id, amount, payment_type, payment_date, status, description, created_at";
  const MINIMAL_NOPKG_SELECT =
    "id, profile_id, amount, payment_type, payment_date, status, description, created_at";
  const LEGACY_PKG_SELECT = "id, profile_id, package_id, amount, payment_type, payment_date, status, description";
  const LEGACY_NOPKG_SELECT = "id, profile_id, amount, payment_type, payment_date, status, description";

  const USER_MSG = "Tahsilat kayıtları alınamadı.";

  // 1 — tam şema + sporcu ilişkisi
  {
    let q = adminClient
      .from("payments")
      .select(`${MODERN_SELECT}, ${PAY_EMBED}`)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("created_at", range.from)
      .lt("created_at", range.toExclusive)
      .order("created_at", { ascending: false });
    if (paymentStatus !== "all") q = q.eq("status", paymentStatus);
    if (paymentKind) q = q.eq("payment_kind", paymentKind);
    const { data, error } = await q;
    if (!error) return { rows: data ?? [], compatibilityMode: false };
    logPaymentsQueryFailure("payments_modern_embed", error);
    if (!shouldFallbackPaymentsQuery(error.message)) return { error: USER_MSG };
  }

  // 2 — tam şema, ilişkisiz (FK / embed hatası)
  {
    let q = adminClient
      .from("payments")
      .select(MODERN_SELECT)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("created_at", range.from)
      .lt("created_at", range.toExclusive)
      .order("created_at", { ascending: false });
    if (paymentStatus !== "all") q = q.eq("status", paymentStatus);
    if (paymentKind) q = q.eq("payment_kind", paymentKind);
    const { data, error } = await q;
    if (!error) return { rows: data ?? [], compatibilityMode: false };
    logPaymentsQueryFailure("payments_modern_flat", error);
    if (!shouldFallbackPaymentsQuery(error.message)) return { error: USER_MSG };
  }

  // 3 — payment_kind / deleted_at vb. eksik olabilir
  {
    let q = adminClient
      .from("payments")
      .select(`${FALLBACK_SELECT}, ${PAY_EMBED}`)
      .eq("organization_id", organizationId)
      .gte("created_at", range.from)
      .lt("created_at", range.toExclusive)
      .order("created_at", { ascending: false });
    if (paymentStatus !== "all") q = q.eq("status", paymentStatus);
    const { data, error } = await q;
    if (!error) return { rows: data || [], compatibilityMode: true };
    logPaymentsQueryFailure("payments_fallback_embed", error);
    if (!shouldFallbackPaymentsQuery(error.message)) return { error: USER_MSG };
  }

  // 4
  {
    let q = adminClient
      .from("payments")
      .select(FALLBACK_SELECT)
      .eq("organization_id", organizationId)
      .gte("created_at", range.from)
      .lt("created_at", range.toExclusive)
      .order("created_at", { ascending: false });
    if (paymentStatus !== "all") q = q.eq("status", paymentStatus);
    const { data, error } = await q;
    if (!error) return { rows: data || [], compatibilityMode: true };
    logPaymentsQueryFailure("payments_fallback_flat", error);
    if (!shouldFallbackPaymentsQuery(error.message)) return { error: USER_MSG };
  }

  // 5 — minimal + package_id + ilişki
  {
    let q = adminClient
      .from("payments")
      .select(`${MINIMAL_PKG_SELECT}, ${PAY_EMBED}`)
      .eq("organization_id", organizationId)
      .gte("created_at", range.from)
      .lt("created_at", range.toExclusive)
      .order("created_at", { ascending: false });
    if (paymentStatus !== "all") q = q.eq("status", paymentStatus);
    const { data, error } = await q;
    if (!error) return { rows: data || [], compatibilityMode: true };
    logPaymentsQueryFailure("payments_minimal_pkg_embed", error);
    if (!shouldFallbackPaymentsQuery(error.message)) return { error: USER_MSG };
  }

  // 6 — minimal + package_id, ilişkisiz
  {
    let q = adminClient
      .from("payments")
      .select(MINIMAL_PKG_SELECT)
      .eq("organization_id", organizationId)
      .gte("created_at", range.from)
      .lt("created_at", range.toExclusive)
      .order("created_at", { ascending: false });
    if (paymentStatus !== "all") q = q.eq("status", paymentStatus);
    const { data, error } = await q;
    if (!error) return { rows: data || [], compatibilityMode: true };
    logPaymentsQueryFailure("payments_minimal_pkg_flat", error);
    if (!shouldFallbackPaymentsQuery(error.message)) return { error: USER_MSG };
  }

  // 7 — package_id kolonu yoksa
  {
    let q = adminClient
      .from("payments")
      .select(`${MINIMAL_NOPKG_SELECT}, ${PAY_EMBED}`)
      .eq("organization_id", organizationId)
      .gte("created_at", range.from)
      .lt("created_at", range.toExclusive)
      .order("created_at", { ascending: false });
    if (paymentStatus !== "all") q = q.eq("status", paymentStatus);
    const { data, error } = await q;
    if (!error) return { rows: data || [], compatibilityMode: true };
    logPaymentsQueryFailure("payments_minimal_nopkg_embed", error);
    if (!shouldFallbackPaymentsQuery(error.message)) return { error: USER_MSG };
  }

  // 8
  {
    let q = adminClient
      .from("payments")
      .select(MINIMAL_NOPKG_SELECT)
      .eq("organization_id", organizationId)
      .gte("created_at", range.from)
      .lt("created_at", range.toExclusive)
      .order("created_at", { ascending: false });
    if (paymentStatus !== "all") q = q.eq("status", paymentStatus);
    const { data, error } = await q;
    if (!error) return { rows: data || [], compatibilityMode: true };
    logPaymentsQueryFailure("payments_minimal_nopkg_flat", error);
    if (!shouldFallbackPaymentsQuery(error.message)) return { error: USER_MSG };
  }

  // 9 — created_at yok / kullanılamıyor: İstanbul takvim günü ile payment_date
  {
    let q = adminClient
      .from("payments")
      .select(`${LEGACY_PKG_SELECT}, ${PAY_EMBED}`)
      .eq("organization_id", organizationId)
      .gte("payment_date", paymentDateBounds.fromKey)
      .lte("payment_date", paymentDateBounds.toKeyInclusive)
      .order("payment_date", { ascending: false });
    if (paymentStatus !== "all") q = q.eq("status", paymentStatus);
    const { data, error } = await q;
    if (!error) return { rows: data || [], compatibilityMode: true };
    logPaymentsQueryFailure("payments_legacy_payment_date_pkg_embed", error);
    if (!shouldFallbackPaymentsQuery(error.message)) return { error: USER_MSG };
  }

  // 10
  {
    let q = adminClient
      .from("payments")
      .select(LEGACY_PKG_SELECT)
      .eq("organization_id", organizationId)
      .gte("payment_date", paymentDateBounds.fromKey)
      .lte("payment_date", paymentDateBounds.toKeyInclusive)
      .order("payment_date", { ascending: false });
    if (paymentStatus !== "all") q = q.eq("status", paymentStatus);
    const { data, error } = await q;
    if (!error) return { rows: data || [], compatibilityMode: true };
    logPaymentsQueryFailure("payments_legacy_payment_date_pkg_flat", error);
    if (!shouldFallbackPaymentsQuery(error.message)) return { error: USER_MSG };
  }

  // 11 — package_id + payment_date ile kombine edilemiyorsa
  {
    let q = adminClient
      .from("payments")
      .select(`${LEGACY_NOPKG_SELECT}, ${PAY_EMBED}`)
      .eq("organization_id", organizationId)
      .gte("payment_date", paymentDateBounds.fromKey)
      .lte("payment_date", paymentDateBounds.toKeyInclusive)
      .order("payment_date", { ascending: false });
    if (paymentStatus !== "all") q = q.eq("status", paymentStatus);
    const { data, error } = await q;
    if (!error) return { rows: data || [], compatibilityMode: true };
    logPaymentsQueryFailure("payments_legacy_payment_date_nopkg_embed", error);
    if (!shouldFallbackPaymentsQuery(error.message)) return { error: USER_MSG };
  }

  // 12 — son düz liste
  {
    let q = adminClient
      .from("payments")
      .select(LEGACY_NOPKG_SELECT)
      .eq("organization_id", organizationId)
      .gte("payment_date", paymentDateBounds.fromKey)
      .lte("payment_date", paymentDateBounds.toKeyInclusive)
      .order("payment_date", { ascending: false });
    if (paymentStatus !== "all") q = q.eq("status", paymentStatus);
    const { data, error } = await q;
    if (!error) return { rows: data || [], compatibilityMode: true };
    logPaymentsQueryFailure("payments_legacy_payment_date_nopkg_flat", error);
  }

  console.error("[accountingFinance] payments query exhausted all fallbacks", {
    organizationId,
    paymentDateBounds,
    createdAtRange: { from: range.from, toExclusive: range.toExclusive },
  });
  return { error: USER_MSG };
}

function resolveMonthNameTr(month: number) {
  return (
    [
      "Ocak",
      "Şubat",
      "Mart",
      "Nisan",
      "Mayıs",
      "Haziran",
      "Temmuz",
      "Ağustos",
      "Eylül",
      "Ekim",
      "Kasım",
      "Aralık",
    ][Math.max(0, Math.min(11, month - 1))] || "Ocak"
  );
}

function resolvePayoutStatus(value: unknown): "eligible" | "included" | "paid" {
  if (value === "paid") return "paid";
  if (value === "eligible") return "eligible";
  return "included";
}

export async function loadAccountingFinanceDashboard(
  rawFilters: AccountingFinanceFilters = {}
): Promise<{ snapshot: AccountingFinanceSnapshot } | { error: string }> {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: false });
  if ("error" in resolved) return { error: resolved.error };
  const role = getSafeRole(resolved.actor.role);
  if (role !== "admin" && role !== "super_admin") {
    return { error: "Bu sayfaya yalnızca yönetici erişebilir." };
  }

  const adminClient = createSupabaseAdminClient();
  let organizationId = resolved.actor.organizationId || "";
  if (role === "super_admin") {
    const orgInput = (rawFilters.orgId || "").trim();
    if (!isUuid(orgInput)) {
      return { error: "Super admin için ?org=ORG_UUID zorunludur." };
    }
    const { data: orgExists } = await adminClient.from("organizations").select("id").eq("id", orgInput).maybeSingle();
    if (!orgExists) return { error: "Organizasyon bulunamadı." };
    organizationId = orgInput;
  } else if (!organizationId) {
    return { error: "Organizasyon bilgisi alınamadı." };
  }

  const month = (rawFilters.month || currentMonthKey()).trim();
  const dateFrom = (rawFilters.dateFrom || "").trim();
  const dateTo = (rawFilters.dateTo || "").trim();
  const rangeMode = dateFrom && dateTo ? "custom_range" : "month";
  const timeRange: UtcHalfOpenRange | null =
    rangeMode === "custom_range"
      ? istanbulDateWallRangeToHalfOpenUtc(dateFrom, dateTo)
      : istanbulMonthWallToHalfOpenUtc(month);
  if (!timeRange) {
    return { error: "Geçersiz tarih filtresi." };
  }
  const payoutDateBounds =
    rangeMode === "custom_range"
      ? istanbulCustomRangeToPayoutDateInclusiveBounds(dateFrom, dateTo)
      : istanbulMonthToPayoutDateInclusiveBounds(month);
  if (!payoutDateBounds) {
    return { error: "Geçersiz tarih filtresi." };
  }
  const coachId = (rawFilters.coachId || "").trim() || null;
  const lessonType = rawFilters.lessonType || "all";
  const lessonStatus = rawFilters.lessonStatus || "all";
  const paymentKind = (rawFilters.paymentKind || "").trim() || null;
  const paymentStatus = rawFilters.paymentStatus || "all";

  const { data: coachRows, error: coachErr } = await adminClient
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("organization_id", organizationId)
    .order("full_name", { ascending: true });
  if (coachErr) return { error: `Koç listesi alınamadı: ${coachErr.message}` };
  const allProfiles = coachRows || [];
  const coaches = allProfiles
    .filter((row) => getSafeRole(row.role) === "coach")
    .map((row) => ({ id: row.id, full_name: toDisplayName(row.full_name, row.email, "Koç") }));
  const athletes = allProfiles
    .filter((row) => getSafeRole(row.role) === "sporcu")
    .map((row) => ({ id: row.id, full_name: toDisplayName(row.full_name, row.email, "Sporcu") }));
  const coachSet = new Set(coaches.map((c) => c.id));
  const safeCoachId = coachId && coachSet.has(coachId) ? coachId : null;

  const paymentLoad = await loadPaymentsWithCompatibility({
    organizationId,
    range: timeRange,
    paymentDateBounds: payoutDateBounds,
    paymentStatus,
    paymentKind,
  });
  if ("error" in paymentLoad) return { error: paymentLoad.error };

  const mappedPayments: AccountingFinancePaymentRow[] = (paymentLoad.rows || []).map((row: Record<string, unknown>) => {
    const athleteRaw = Array.isArray(row.athlete_profile) ? row.athlete_profile[0] : row.athlete_profile;
    const athlete = athleteRaw as { full_name?: string | null; email?: string | null } | null;
    const status = row.status === "odendi" ? "odendi" : "bekliyor";
    const normalizedKind = inferPaymentKindFromLegacyRow(row);
    const normalizedScope = inferPaymentScopeFromLegacyRow(row);
    return {
      id: String(row.id || ""),
      athleteId: (row.profile_id as string | null) || null,
      athleteName: toDisplayName(athlete?.full_name ?? null, athlete?.email ?? null, "Sporcu"),
      amount: Number(row.amount || 0),
      paymentDate: normalizePaymentDisplayDate(row),
      dueDate: (row.due_date as string | null) || null,
      status,
      paymentKind: normalizedKind,
      paymentScope: normalizedScope,
      paymentType: String(row.payment_type || "aylik"),
      sourceLabel: String(row.display_name || row.description || "Tahsilat"),
    };
  });
  const mappedPaymentsFiltered =
    paymentKind && paymentLoad.compatibilityMode ? mappedPayments.filter((row) => row.paymentKind === paymentKind) : mappedPayments;

  let groupLessons: AccountingFinanceLessonRow[] = [];
  if (lessonType !== "private") {
    let groupQuery = adminClient
      .from("training_schedule")
      .select(
        "id, title, start_time, end_time, status, coach_id, location, coach_profile:profiles!training_schedule_coach_id_fkey(full_name, email), training_participants(id)"
      )
      .eq("organization_id", organizationId)
      .gte("start_time", timeRange.from)
      .lt("start_time", timeRange.toExclusive)
      .order("start_time", { ascending: false });
    if (safeCoachId) groupQuery = groupQuery.eq("coach_id", safeCoachId);
    if (lessonStatus !== "all") {
      if (lessonStatus === "planned") groupQuery = groupQuery.not("status", "in", "(cancelled,completed)");
      else groupQuery = groupQuery.eq("status", lessonStatus);
    }
    const { data: rows, error } = await groupQuery;
    if (error) return { error: `Grup dersleri alınamadı: ${error.message}` };
    groupLessons = (rows || []).map((row: Record<string, unknown>) => {
      const coachRaw = Array.isArray(row.coach_profile) ? row.coach_profile[0] : row.coach_profile;
      const coach = coachRaw as { full_name?: string | null; email?: string | null } | null;
      const normalizedStatus = normalizeLessonStatus(row.status as string | null);
      return {
        id: String(row.id || ""),
        sourceType: "group",
        payoutSourceType: "group_lesson",
        title: String(row.title || "Grup Dersi"),
        startsAt: String(row.start_time || ""),
        endsAt: (row.end_time as string | null) || null,
        status: normalizedStatus,
        coachId: (row.coach_id as string | null) || null,
        coachName: toDisplayName(coach?.full_name ?? null, coach?.email ?? null, "Koç"),
        location: (row.location as string | null) || null,
        participantCount: Array.isArray(row.training_participants) ? row.training_participants.length : 0,
        lessonPrice: null,
        coachPayoutEligible: normalizedStatus === "completed",
        payoutItemId: null,
        payoutStatus: null,
        payoutAmount: 0,
        calculationStatus: "not_eligible",
      };
    });
  }

  let privateLessons: AccountingFinanceLessonRow[] = [];
  if (lessonType !== "group") {
    let privateQuery = adminClient
      .from("private_lesson_sessions")
      .select(
        "id, starts_at, ends_at, status, coach_id, location, coach_profile:profiles!private_lesson_sessions_coach_id_fkey(full_name, email), pkg:private_lesson_packages!private_lesson_sessions_package_id_fkey(package_name,total_price,total_lessons)"
      )
      .eq("organization_id", organizationId)
      .gte("starts_at", timeRange.from)
      .lt("starts_at", timeRange.toExclusive)
      .order("starts_at", { ascending: false });
    if (safeCoachId) privateQuery = privateQuery.eq("coach_id", safeCoachId);
    if (lessonStatus !== "all") privateQuery = privateQuery.eq("status", lessonStatus);
    const { data: rows, error } = await privateQuery;
    if (error) return { error: `Özel dersler alınamadı: ${error.message}` };
    privateLessons = (rows || []).map((row: Record<string, unknown>) => {
      const coachRaw = Array.isArray(row.coach_profile) ? row.coach_profile[0] : row.coach_profile;
      const coach = coachRaw as { full_name?: string | null; email?: string | null } | null;
      const pkgRaw = Array.isArray(row.pkg) ? row.pkg[0] : row.pkg;
      const pkg = pkgRaw as { package_name?: string | null; total_price?: number | null; total_lessons?: number | null } | null;
      const normalizedStatus = normalizeLessonStatus(row.status as string | null);
      const totalLessons = Number(pkg?.total_lessons || 0);
      const totalPrice = Number(pkg?.total_price || 0);
      const lessonUnitPrice = totalLessons > 0 && totalPrice > 0 ? Math.round((totalPrice / totalLessons) * 100) / 100 : null;
      return {
        id: String(row.id || ""),
        sourceType: "private",
        payoutSourceType: "private_lesson",
        title: String(pkg?.package_name || "Özel Ders"),
        startsAt: String(row.starts_at || ""),
        endsAt: (row.ends_at as string | null) || null,
        status: normalizedStatus,
        coachId: (row.coach_id as string | null) || null,
        coachName: toDisplayName(coach?.full_name ?? null, coach?.email ?? null, "Koç"),
        location: (row.location as string | null) || null,
        participantCount: 1,
        lessonPrice: lessonUnitPrice,
        coachPayoutEligible: normalizedStatus === "completed",
        payoutItemId: null,
        payoutStatus: null,
        payoutAmount: 0,
        calculationStatus: "not_eligible",
      };
    });
  }

  /** Bu dönemde listelenen derslerle eşleşen payout kalemleri (lesson_date UTC kesiti yanlış kalmasın diye source_id ile). */
  const groupLessonIds = groupLessons.map((l) => l.id).filter(Boolean);
  const privateLessonIds = privateLessons.map((l) => l.id).filter(Boolean);
  const payoutRowsMerged: Array<Record<string, unknown>> = [];
  for (const tuple of [
    ["group_lesson", groupLessonIds],
    ["private_lesson", privateLessonIds],
  ] as const) {
    const [sourceType, ids] = tuple;
    if (ids.length === 0) continue;
    const fullRes = await adminClient
      .from("coach_payout_items")
      .select("id, source_type, source_id, status, payout_amount, calculated_at")
      .eq("organization_id", organizationId)
      .eq("source_type", sourceType)
      .in("source_id", ids);
    if (!fullRes.error) {
      payoutRowsMerged.push(...(fullRes.data || []));
      continue;
    }
    if (String(fullRes.error.message || "").toLowerCase().includes("payout_amount")) {
      const minRes = await adminClient
        .from("coach_payout_items")
        .select("id, source_type, source_id, status")
        .eq("organization_id", organizationId)
        .eq("source_type", sourceType)
        .in("source_id", ids);
      if (minRes.error) return { error: `Koç ödeme kalemleri alınamadı: ${minRes.error.message}` };
      payoutRowsMerged.push(...(minRes.data || []));
      continue;
    }
    return { error: `Koç ödeme kalemleri alınamadı: ${fullRes.error.message}` };
  }

  const payoutBySource = new Map<string, { id: string; status: "eligible" | "included" | "paid"; payoutAmount: number | null }>();
  payoutRowsMerged.forEach((row) => {
    const key = `${String(row.source_type || "")}:${String(row.source_id || "")}`;
    payoutBySource.set(key, {
      id: String(row.id || ""),
      status: resolvePayoutStatus(row.status),
      payoutAmount: row.payout_amount != null ? Number(row.payout_amount) : null,
    });
  });

  const { data: rulesRows, error: rulesError } = await adminClient
    .from("coach_payment_rules")
    .select("coach_id, payment_type, amount, percentage, applies_to")
    .eq("organization_id", organizationId);
  if (rulesError && !(rulesError.code === "42P01" || rulesError.message?.includes("coach_payment_rules"))) {
    return { error: `Koç ödeme kuralları alınamadı: ${rulesError.message}` };
  }
  const rulesByCoach = new Map<string, CoachPaymentRuleForCalc[]>();
  (rulesRows || []).forEach((row) => {
    const coachKey = String(row.coach_id || "");
    if (!coachKey) return;
    const arr = rulesByCoach.get(coachKey) || [];
    arr.push({
      payment_type: row.payment_type === "percentage" ? "percentage" : "per_lesson",
      amount: row.amount != null ? Number(row.amount) : null,
      percentage: row.percentage != null ? Number(row.percentage) : null,
      applies_to: row.applies_to === "group" || row.applies_to === "private" ? row.applies_to : "all",
    });
    rulesByCoach.set(coachKey, arr);
  });

  const lessons = [...groupLessons, ...privateLessons]
    .map((lesson) => {
      const payout = payoutBySource.get(`${lesson.payoutSourceType}:${lesson.id}`);
      const coachRules = lesson.coachId ? rulesByCoach.get(lesson.coachId) || [] : [];
      const rule = pickCoachRule(coachRules, lesson.coachId, lesson.sourceType);
      const calc = calculateCoachPayout(
        {
          sourceType: lesson.sourceType,
          status: lesson.status,
          lessonUnitPrice: lesson.lessonPrice,
        },
        rule
      );
      const payoutAmount = payout?.payoutAmount != null ? Number(payout.payoutAmount) : calc.payoutAmount;
      return {
        ...lesson,
        payoutItemId: payout?.id || null,
        payoutStatus: payout?.status || null,
        payoutAmount,
        calculationStatus: calc.calculationStatus,
      };
    })
    .sort(
    (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
  );

  const totalCollected = mappedPaymentsFiltered.filter((p) => p.status === "odendi").reduce((sum, p) => sum + p.amount, 0);
  const pendingCollection = mappedPaymentsFiltered.filter((p) => p.status === "bekliyor").reduce((sum, p) => sum + p.amount, 0);
  const coachPayoutEligibleLessonCount = lessons.filter((l) => l.coachPayoutEligible).length;
  const payoutPendingCount = lessons.filter((l) => l.coachPayoutEligible && isCoachPayoutTrackingPending(l.payoutStatus)).length;
  const payoutIncludedCount = lessons.filter((l) => l.coachPayoutEligible && l.payoutStatus === "included").length;
  const payoutPaidCount = lessons.filter((l) => l.coachPayoutEligible && l.payoutStatus === "paid").length;
  const payoutAmountTotal = lessons.filter((l) => l.coachPayoutEligible).reduce((sum, l) => sum + (l.payoutAmount || 0), 0);
  const payoutAmountPending = lessons
    .filter((l) => l.coachPayoutEligible && l.payoutStatus !== "paid")
    .reduce((sum, l) => sum + (l.payoutAmount || 0), 0);
  const payoutAmountPaid = lessons
    .filter((l) => l.coachPayoutEligible && l.payoutStatus === "paid")
    .reduce((sum, l) => sum + (l.payoutAmount || 0), 0);
  const paymentKinds = Array.from(new Set(mappedPaymentsFiltered.map((p) => p.paymentKind))).sort((a, b) => a.localeCompare(b, "tr"));

  return {
    snapshot: {
      organizationId,
      actorRole: role,
      canManagePayouts: role === "admin" || role === "super_admin",
      compatibilityNotice: paymentLoad.compatibilityMode ? "Tahsilat kayıtları yüklenirken uyumluluk modu kullanıldı." : null,
      filtersApplied: {
        month,
        dateFrom: timeRange.from,
        dateTo: inclusiveUtcEndIso(timeRange.toExclusive),
        coachId: safeCoachId,
        lessonType,
        lessonStatus,
        paymentKind,
        paymentStatus,
        rangeMode,
      },
      kpis: {
        totalCollected,
        pendingCollection,
        coachPayoutEligibleLessonCount,
        payoutPendingCount,
        payoutIncludedCount,
        payoutPaidCount,
        payoutAmountTotal,
        payoutAmountPending,
        payoutAmountPaid,
        estimatedNet: null,
      },
      payments: mappedPaymentsFiltered,
      lessons,
      options: {
        coaches,
        athletes,
        paymentKinds,
        lessonStatuses: ["all", "planned", "completed", "cancelled"],
        paymentStatuses: ["all", "bekliyor", "odendi"],
      },
    },
  };
}

export async function createAccountingPayment(formData: FormData) {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: false });
  if ("error" in resolved) return { error: resolved.error };
  const role = getSafeRole(resolved.actor.role);
  if (role !== "admin" && role !== "super_admin") {
    return { error: "Bu işlem yalnızca yönetici tarafından yapılabilir." };
  }
  const orgFromForm = formData.get("organizationId")?.toString().trim() || "";
  let organizationId = resolved.actor.organizationId || "";
  if (role === "super_admin") {
    if (!isUuid(orgFromForm)) return { error: "Super admin için organizationId zorunludur." };
    organizationId = orgFromForm;
  }
  if (!organizationId) return { error: "Organizasyon bilgisi alınamadı." };

  const profileId = formData.get("profileId")?.toString().trim() || "";
  if (!isUuid(profileId)) return { error: "Geçersiz sporcu seçimi." };
  const amount = Number(formData.get("amount")?.toString() || "");
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Geçersiz tahsilat tutarı." };

  const paymentKindInput = String(formData.get("paymentKind") || "monthly_membership");
  const paymentDate = String(formData.get("paymentDate") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const packageId = String(formData.get("packageId") || "").trim();
  const tz = SCHEDULE_APP_TIME_ZONE;
  const paidAt =
    paymentDate && /^\d{4}-\d{2}-\d{2}$/.test(paymentDate)
      ? wallClockInZoneToUtcIso(paymentDate, "00:00:00", tz) ?? new Date().toISOString()
      : new Date().toISOString();
  const paidWallKey = isoToZonedDateKey(paidAt, tz);
  const wallParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(paidWallKey);
  const wallMonth = wallParts ? Number(wallParts[2]) : new Date().getMonth() + 1;
  const wallYear = wallParts ? Number(wallParts[1]) : new Date().getFullYear();
  const monthName = resolveMonthNameTr(Number.isFinite(wallMonth) ? wallMonth : 1);
  const yearInt = Number.isFinite(wallYear) ? wallYear : new Date().getFullYear();
  const dueDateKey = paidWallKey || paidAt.slice(0, 10);

  const paymentKind =
    paymentKindInput === "private_lesson_package" ||
    paymentKindInput === "license" ||
    paymentKindInput === "event" ||
    paymentKindInput === "equipment" ||
    paymentKindInput === "manual_other" ||
    paymentKindInput === "other"
      ? paymentKindInput
      : "monthly_membership";
  const paymentScope =
    paymentKind === "private_lesson_package"
      ? "private_lesson"
      : paymentKind === "monthly_membership"
        ? "membership"
        : "extra_charge";
  const paymentType = paymentKind === "private_lesson_package" ? "paket" : "aylik";

  const adminClient = createSupabaseAdminClient();
  const { data: athlete } = await adminClient
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", profileId)
    .maybeSingle();
  if (!athlete || getSafeRole(athlete.role) !== "sporcu" || athlete.organization_id !== organizationId) {
    return { error: "Sporcu bu organizasyonda bulunamadı." };
  }
  if (paymentKind === "private_lesson_package" && packageId && !isUuid(packageId)) {
    return { error: "Geçersiz paket seçimi." };
  }

  let insertModern = await adminClient
    .from("payments")
    .insert({
      profile_id: profileId,
      organization_id: organizationId,
      amount,
      payment_type: paymentType,
      payment_scope: paymentScope,
      payment_kind: paymentKind,
      display_name: null,
      due_date: dueDateKey,
      month_name: monthName,
      year_int: yearInt,
      payment_date: paidAt,
      status: "odendi",
      description,
      package_id: paymentKind === "private_lesson_package" && packageId ? packageId : null,
      paid_at: paidAt,
    })
    .select("id")
    .single();

  if (insertModern.error && isPaymentsSchemaCompatibilityError(insertModern.error.message)) {
    insertModern = await adminClient
      .from("payments")
      .insert({
        profile_id: profileId,
        organization_id: organizationId,
        amount,
        payment_type: paymentType,
        due_date: dueDateKey,
        month_name: monthName,
        year_int: yearInt,
        payment_date: paidAt,
        status: "odendi",
        description,
      })
      .select("id")
      .single();
  }

  if (insertModern.error || !insertModern.data?.id) {
    return { error: `Tahsilat kaydı oluşturulamadı: ${insertModern.error?.message || "unknown"}` };
  }
  return { success: true as const };
}
