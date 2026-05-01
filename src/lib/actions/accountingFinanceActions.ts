"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { isUuid } from "@/lib/validation/uuid";
import { toDisplayName } from "@/lib/profile/displayName";
import { calculateCoachPayout, pickCoachRule, type CoachPaymentRuleForCalc } from "@/lib/accountingFinance/payoutCalculation";

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

function parseMonthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map((v) => Number(v));
  const fromDate = new Date(Date.UTC(y, Math.max((m || 1) - 1, 0), 1, 0, 0, 0));
  const toDate = new Date(Date.UTC(y, Math.max((m || 1), 1), 0, 23, 59, 59));
  return {
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
  };
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
    m.includes("payments.package_id")
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
  range: { from: string; to: string };
  paymentStatus: PaymentStatusFilter;
  paymentKind: string | null;
}): Promise<
  | { rows: Record<string, unknown>[]; compatibilityMode: boolean }
  | { error: string }
> {
  const adminClient = createSupabaseAdminClient();
  const { organizationId, range, paymentStatus, paymentKind } = args;
  let compatibilityMode = false;

  let modernQuery = adminClient
    .from("payments")
    .select(
      "id, profile_id, package_id, amount, payment_type, payment_date, paid_at, due_date, status, payment_kind, payment_scope, display_name, metadata_json, description, deleted_at, athlete_profile:profiles!payments_profile_id_fkey(full_name, email)"
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .gte("created_at", range.from)
    .lte("created_at", range.to)
    .order("created_at", { ascending: false });
  if (paymentStatus !== "all") modernQuery = modernQuery.eq("status", paymentStatus);
  if (paymentKind) modernQuery = modernQuery.eq("payment_kind", paymentKind);
  const modern = await modernQuery;
  if (!modern.error) {
    return { rows: modern.data || [], compatibilityMode };
  }
  if (!isPaymentsSchemaCompatibilityError(modern.error.message)) {
    return { error: `Tahsilat kayıtları alınamadı.` };
  }

  compatibilityMode = true;
  let fallbackQuery = adminClient
    .from("payments")
    .select(
      "id, profile_id, package_id, amount, payment_type, payment_date, paid_at, due_date, status, payment_scope, display_name, metadata_json, description, athlete_profile:profiles!payments_profile_id_fkey(full_name, email)"
    )
    .eq("organization_id", organizationId)
    .gte("created_at", range.from)
    .lte("created_at", range.to)
    .order("created_at", { ascending: false });
  if (paymentStatus !== "all") fallbackQuery = fallbackQuery.eq("status", paymentStatus);
  const fallback = await fallbackQuery;
  if (!fallback.error) {
    return { rows: fallback.data || [], compatibilityMode };
  }
  if (!isPaymentsSchemaCompatibilityError(fallback.error.message)) {
    return { error: "Tahsilat kayıtları alınamadı." };
  }

  let minimalQuery = adminClient
    .from("payments")
    .select(
      "id, profile_id, amount, payment_type, payment_date, status, description, athlete_profile:profiles!payments_profile_id_fkey(full_name, email)"
    )
    .eq("organization_id", organizationId)
    .gte("created_at", range.from)
    .lte("created_at", range.to)
    .order("created_at", { ascending: false });
  if (paymentStatus !== "all") minimalQuery = minimalQuery.eq("status", paymentStatus);
  const minimal = await minimalQuery;
  if (minimal.error) {
    return { error: "Tahsilat kayıtları alınamadı." };
  }
  return { rows: minimal.data || [], compatibilityMode };
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
  const range = rangeMode === "custom_range" ? { from: `${dateFrom}T00:00:00.000Z`, to: `${dateTo}T23:59:59.999Z` } : parseMonthRange(month);
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
    range,
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
      paymentDate: (row.payment_date as string | null) || (row.paid_at as string | null) || null,
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
      .gte("start_time", range.from)
      .lte("start_time", range.to)
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
      .gte("starts_at", range.from)
      .lte("starts_at", range.to)
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

  const payoutKeys = new Set<string>();
  [...groupLessons, ...privateLessons].forEach((lesson) => {
    payoutKeys.add(`${lesson.payoutSourceType}:${lesson.id}`);
  });
  let payoutRowsRes: { data: Array<Record<string, unknown>> | null; error: { message?: string } | null } = await adminClient
    .from("coach_payout_items")
    .select("id, source_type, source_id, status, payout_amount, calculated_at")
    .eq("organization_id", organizationId)
    .gte("lesson_date", range.from.slice(0, 10))
    .lte("lesson_date", range.to.slice(0, 10)) as unknown as {
    data: Array<Record<string, unknown>> | null;
    error: { message?: string } | null;
  };
  if (payoutRowsRes.error && String(payoutRowsRes.error.message || "").toLowerCase().includes("payout_amount")) {
    payoutRowsRes = (await adminClient
      .from("coach_payout_items")
      .select("id, source_type, source_id, status")
      .eq("organization_id", organizationId)
      .gte("lesson_date", range.from.slice(0, 10))
      .lte("lesson_date", range.to.slice(0, 10))) as unknown as {
      data: Array<Record<string, unknown>> | null;
      error: { message?: string } | null;
    };
  }
  if (payoutRowsRes.error) return { error: `Koç ödeme kalemleri alınamadı: ${payoutRowsRes.error.message}` };
  const payoutBySource = new Map<string, { id: string; status: "eligible" | "included" | "paid"; payoutAmount: number | null }>();
  (payoutRowsRes.data || []).forEach((row) => {
    const key = `${String(row.source_type || "")}:${String(row.source_id || "")}`;
    if (!payoutKeys.has(key)) return;
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
  const payoutPendingCount = lessons.filter((l) => l.coachPayoutEligible && !l.payoutStatus).length;
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
        dateFrom: range.from,
        dateTo: range.to,
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
  const paidAt = paymentDate ? new Date(`${paymentDate}T00:00:00`).toISOString() : new Date().toISOString();
  const paidDateObj = new Date(paidAt);
  const monthName = resolveMonthNameTr(paidDateObj.getUTCMonth() + 1);
  const yearInt = paidDateObj.getUTCFullYear();

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
      due_date: paidAt.slice(0, 10),
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
        due_date: paidAt.slice(0, 10),
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
