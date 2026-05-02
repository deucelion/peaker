"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { isUuid } from "@/lib/validation/uuid";
import { toDisplayName } from "@/lib/profile/displayName";
import { normalizeMoney } from "@/lib/privateLessons/packageMath";
import { applyPrivateLessonPackagePaymentWithPaymentRow } from "@/lib/privateLessons/packagePaymentSync";
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
  /** true: yalnızca ders/koç raporu; payments ve tahsilat KPI sorgulanmaz */
  lessonsOnly?: boolean;
};

export type AccountingFinancePaymentRow = {
  id: string;
  athleteId: string | null;
  athleteName: string;
  amount: number;
  paidAmount: number;
  remainingBalance: number | null;
  paymentDate: string | null;
  dueDate: string | null;
  status: "bekliyor" | "odendi";
  paymentKind: string;
  paymentScope: string;
  paymentType: string;
  sourceLabel: string;
  descriptionText: string;
  channelLabel: string;
  packageId: string | null;
};

export type AccountingFinanceLessonRow = {
  id: string;
  sourceType: "group" | "private";
  title: string;
  startsAt: string;
  endsAt: string | null;
  status: "planned" | "completed" | "cancelled";
  coachId: string | null;
  coachName: string;
  location: string | null;
  participantCount: number;
};

export type AccountingFinanceCoachAggregateRow = {
  coachId: string;
  coachName: string;
  total: number;
  groupCount: number;
  privateCount: number;
  completedCount: number;
  plannedCount: number;
  cancelledCount: number;
  lastLessonAt: string | null;
};

export type AccountingFinancePackageOption = {
  id: string;
  packageName: string;
  remainingLessons: number;
  totalPrice: number;
  amountPaid: number;
  paymentStatus: "unpaid" | "partial" | "paid";
  isActive: boolean;
};

export type AccountingFinanceSnapshot = {
  organizationId: string;
  actorRole: "admin" | "super_admin";
  /** Koçlar sekmesinde yalnızca ders verisi istendiğinde `lessons_only` döner. */
  dataScope: "full" | "lessons_only";
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
    totalLessons: number;
    completedLessons: number;
    plannedLessons: number;
    cancelledLessons: number;
    activeCoachCount: number;
  };
  payments: AccountingFinancePaymentRow[];
  lessons: AccountingFinanceLessonRow[];
  coachAggregates: AccountingFinanceCoachAggregateRow[];
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

/** Tahsilatın operasyonel zamanı: önce ödeme anı, sonra kayıt tarihi (ders aralığı ile hizalı rapor). */
function paymentRowEffectiveInstantMs(row: Record<string, unknown>): number | null {
  const pa = row.paid_at;
  if (pa != null && typeof pa === "string" && pa.trim()) {
    const t = new Date(pa.trim()).getTime();
    if (Number.isFinite(t)) return t;
  }
  const pd = row.payment_date;
  if (pd != null && typeof pd === "string" && pd.trim()) {
    const t = new Date(pd.trim()).getTime();
    if (Number.isFinite(t)) return t;
  }
  const ca = row.created_at;
  if (ca != null && typeof ca === "string" && ca.trim()) {
    const t = new Date(ca.trim()).getTime();
    if (Number.isFinite(t)) return t;
  }
  return null;
}

function paymentRowEffectiveInUtcHalfOpenRange(row: Record<string, unknown>, range: UtcHalfOpenRange): boolean {
  const t = paymentRowEffectiveInstantMs(row);
  if (t == null) return false;
  const from = new Date(range.from).getTime();
  const toEx = new Date(range.toExclusive).getTime();
  return Number.isFinite(from) && Number.isFinite(toEx) && t >= from && t < toEx;
}

/**
 * PostgREST OR: herhangi bir zaman damgası aralığa düşüyorsa aday satırı getir;
 * ardından `paymentRowEffectiveInUtcHalfOpenRange` ile tek efektif tarih (paid_at > payment_date > created_at) uygulanır.
 */
function paymentsCandidateTimeOrFilter(range: UtcHalfOpenRange): string {
  const { from, toExclusive } = range;
  return [
    `and(paid_at.gte.${from},paid_at.lt.${toExclusive})`,
    `and(payment_date.gte.${from},payment_date.lt.${toExclusive})`,
    `and(created_at.gte.${from},created_at.lt.${toExclusive})`,
  ].join(",");
}

function finalizePaymentCandidateRows(rows: Record<string, unknown>[] | null | undefined, range: UtcHalfOpenRange): Record<string, unknown>[] {
  const filtered = (rows || []).filter((r) => paymentRowEffectiveInUtcHalfOpenRange(r, range));
  filtered.sort((a, b) => {
    const ta = paymentRowEffectiveInstantMs(a) ?? 0;
    const tb = paymentRowEffectiveInstantMs(b) ?? 0;
    return tb - ta;
  });
  return filtered;
}

function parseMetadataJson(row: Record<string, unknown>): Record<string, unknown> | null {
  const raw = row.metadata_json;
  if (raw == null) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const o = JSON.parse(raw) as unknown;
      if (o && typeof o === "object" && !Array.isArray(o)) return o as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

function buildPaymentChannelLabel(row: Record<string, unknown>, normalizedKind: string, status: "bekliyor" | "odendi"): string {
  const meta = parseMetadataJson(row);
  if (meta && meta.accounting_origin === "package_ledger") {
    return "Paket detayı (geçmiş kayıt)";
  }
  const desc = String(row.description || "").trim();
  if (desc.startsWith("Muhasebe —") || desc.startsWith("Muhasebe -")) {
    return "Muhasebe üzerinden tahsilat";
  }
  if (desc.startsWith("Paket detayı —") || desc.startsWith("Paket detayı -")) {
    return "Paket detayı üzerinden ödeme";
  }
  if (status === "bekliyor") {
    return "Ödeme bekleniyor";
  }
  const paidMs = paymentRowEffectiveInstantMs(row);
  const created = row.created_at;
  if (
    paidMs != null &&
    created != null &&
    typeof created === "string" &&
    created.trim() &&
    Number.isFinite(paidMs)
  ) {
    const cMs = new Date(created.trim()).getTime();
    if (Number.isFinite(cMs) && Math.abs(paidMs - cMs) <= 180_000) {
      return "Kayıt sırasında ödendi";
    }
    if (Number.isFinite(cMs)) {
      return "Sonradan ödeme";
    }
  }
  if (normalizedKind === "private_lesson_package") {
    return "Özel ders paketi tahsilatı";
  }
  return "Tahsilat kaydı";
}

function ledgerRowCoveredByPaymentRows(
  ledger: { package_id: string; amount: unknown; paid_at: string },
  paymentRows: Record<string, unknown>[]
): boolean {
  const lAmt = normalizeMoney(Number(ledger.amount));
  const lMs = new Date(ledger.paid_at).getTime();
  const lDay = Number.isFinite(lMs) ? isoToZonedDateKey(ledger.paid_at, SCHEDULE_APP_TIME_ZONE) : "";
  for (const p of paymentRows) {
    const pkg = String(p.package_id || "").trim();
    if (!pkg || pkg !== ledger.package_id) continue;
    if (normalizeMoney(Number(p.amount)) !== lAmt) continue;
    const eff = paymentRowEffectiveInstantMs(p);
    if (eff != null && Number.isFinite(lMs) && Math.abs(eff - lMs) <= 120_000) return true;
    if (lDay && eff != null) {
      const pDay = isoToZonedDateKey(new Date(eff).toISOString(), SCHEDULE_APP_TIME_ZONE);
      if (pDay === lDay) return true;
    }
  }
  return false;
}

async function loadSupplementalPrivateLessonLedgerRows(args: {
  adminClient: ReturnType<typeof createSupabaseAdminClient>;
  organizationId: string;
  range: UtcHalfOpenRange;
  existingPaymentRows: Record<string, unknown>[];
  paymentStatus: PaymentStatusFilter;
  paymentKind: string | null;
}): Promise<Record<string, unknown>[]> {
  const { adminClient, organizationId, range, existingPaymentRows, paymentStatus, paymentKind } = args;
  if (paymentStatus === "bekliyor") return [];
  if (paymentKind && paymentKind !== "private_lesson_package") return [];

  const PAY_EMBED = "athlete_profile:profiles!private_lesson_payments_athlete_id_fkey(full_name, email)";
  const PKG_EMBED =
    "pkg:private_lesson_packages!private_lesson_payments_package_id_fkey(organization_id, package_name, total_price, amount_paid)";

  const { data: ledgerRows, error } = await adminClient
    .from("private_lesson_payments")
    .select(`id, package_id, athlete_id, amount, paid_at, note, created_at, ${PAY_EMBED}, ${PKG_EMBED}`)
    .eq("organization_id", organizationId)
    .gte("paid_at", range.from)
    .lt("paid_at", range.toExclusive);

  if (error || !ledgerRows?.length) return [];

  const out: Record<string, unknown>[] = [];
  for (const raw of ledgerRows as Record<string, unknown>[]) {
    const pkgRaw = raw.pkg;
    const pkgOne = (Array.isArray(pkgRaw) ? pkgRaw[0] : pkgRaw) as { organization_id?: string } | null;
    if (!pkgOne || pkgOne.organization_id !== organizationId) continue;
    if (
      ledgerRowCoveredByPaymentRows(
        {
          package_id: String(raw.package_id || ""),
          amount: raw.amount,
          paid_at: String(raw.paid_at || ""),
        },
        existingPaymentRows
      )
    ) {
      continue;
    }

    out.push({
      id: `plp-${String(raw.id || "")}`,
      profile_id: raw.athlete_id,
      package_id: raw.package_id,
      amount: raw.amount,
      payment_type: "paket",
      payment_date: raw.paid_at,
      paid_at: raw.paid_at,
      status: "odendi",
      payment_kind: "private_lesson_package",
      payment_scope: "private_lesson",
      display_name: null,
      description: String(raw.note || "").trim() || null,
      metadata_json: { accounting_origin: "package_ledger" },
      created_at: raw.created_at,
      deleted_at: null,
      athlete_profile: raw.athlete_profile,
      pkg: raw.pkg,
    });
  }
  return out;
}

async function enrichPaymentRowsWithPackageBalance(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  organizationId: string,
  rows: AccountingFinancePaymentRow[]
): Promise<void> {
  const pkgIds = [...new Set(rows.map((r) => r.packageId).filter(Boolean))] as string[];
  if (!pkgIds.length) return;
  const { data: pkgs } = await adminClient
    .from("private_lesson_packages")
    .select("id, total_price, amount_paid")
    .eq("organization_id", organizationId)
    .in("id", pkgIds);
  const byId = new Map((pkgs || []).map((p) => [String(p.id), p]));
  for (const row of rows) {
    if (!row.packageId) continue;
    const p = byId.get(row.packageId);
    if (!p) continue;
    const rem = normalizeMoney(Number(p.total_price) || 0) - normalizeMoney(Number(p.amount_paid) || 0);
    row.remainingBalance = rem > 0.001 ? rem : 0;
  }
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

/** Yalnızca geliştirme ortamında; kalıcı üretim logu değil. */
function logAccountingFinanceDebug(payload: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") return;
  console.log("[accountingFinance] dashboard debug", payload);
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
    "id, profile_id, package_id, amount, payment_type, payment_date, paid_at, status, description, created_at";
  const MINIMAL_NOPKG_SELECT =
    "id, profile_id, amount, payment_type, payment_date, paid_at, status, description, created_at";
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
      .or(paymentsCandidateTimeOrFilter(range))
      .order("created_at", { ascending: false });
    if (paymentStatus !== "all") q = q.eq("status", paymentStatus);
    if (paymentKind) q = q.eq("payment_kind", paymentKind);
    const { data, error } = await q;
    if (!error) return { rows: finalizePaymentCandidateRows(data ?? [], range), compatibilityMode: false };
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
      .or(paymentsCandidateTimeOrFilter(range))
      .order("created_at", { ascending: false });
    if (paymentStatus !== "all") q = q.eq("status", paymentStatus);
    if (paymentKind) q = q.eq("payment_kind", paymentKind);
    const { data, error } = await q;
    if (!error) return { rows: finalizePaymentCandidateRows(data ?? [], range), compatibilityMode: false };
    logPaymentsQueryFailure("payments_modern_flat", error);
    if (!shouldFallbackPaymentsQuery(error.message)) return { error: USER_MSG };
  }

  // 3 — payment_kind / deleted_at vb. eksik olabilir
  {
    let q = adminClient
      .from("payments")
      .select(`${FALLBACK_SELECT}, ${PAY_EMBED}`)
      .eq("organization_id", organizationId)
      .or(paymentsCandidateTimeOrFilter(range))
      .order("created_at", { ascending: false });
    if (paymentStatus !== "all") q = q.eq("status", paymentStatus);
    const { data, error } = await q;
    if (!error) return { rows: finalizePaymentCandidateRows(data || [], range), compatibilityMode: true };
    logPaymentsQueryFailure("payments_fallback_embed", error);
    if (!shouldFallbackPaymentsQuery(error.message)) return { error: USER_MSG };
  }

  // 4
  {
    let q = adminClient
      .from("payments")
      .select(FALLBACK_SELECT)
      .eq("organization_id", organizationId)
      .or(paymentsCandidateTimeOrFilter(range))
      .order("created_at", { ascending: false });
    if (paymentStatus !== "all") q = q.eq("status", paymentStatus);
    const { data, error } = await q;
    if (!error) return { rows: finalizePaymentCandidateRows(data || [], range), compatibilityMode: true };
    logPaymentsQueryFailure("payments_fallback_flat", error);
    if (!shouldFallbackPaymentsQuery(error.message)) return { error: USER_MSG };
  }

  // 5 — minimal + package_id + ilişki
  {
    let q = adminClient
      .from("payments")
      .select(`${MINIMAL_PKG_SELECT}, ${PAY_EMBED}`)
      .eq("organization_id", organizationId)
      .or(paymentsCandidateTimeOrFilter(range))
      .order("created_at", { ascending: false });
    if (paymentStatus !== "all") q = q.eq("status", paymentStatus);
    const { data, error } = await q;
    if (!error) return { rows: finalizePaymentCandidateRows(data || [], range), compatibilityMode: true };
    logPaymentsQueryFailure("payments_minimal_pkg_embed", error);
    if (!shouldFallbackPaymentsQuery(error.message)) return { error: USER_MSG };
  }

  // 6 — minimal + package_id, ilişkisiz
  {
    let q = adminClient
      .from("payments")
      .select(MINIMAL_PKG_SELECT)
      .eq("organization_id", organizationId)
      .or(paymentsCandidateTimeOrFilter(range))
      .order("created_at", { ascending: false });
    if (paymentStatus !== "all") q = q.eq("status", paymentStatus);
    const { data, error } = await q;
    if (!error) return { rows: finalizePaymentCandidateRows(data || [], range), compatibilityMode: true };
    logPaymentsQueryFailure("payments_minimal_pkg_flat", error);
    if (!shouldFallbackPaymentsQuery(error.message)) return { error: USER_MSG };
  }

  // 7 — package_id kolonu yoksa
  {
    let q = adminClient
      .from("payments")
      .select(`${MINIMAL_NOPKG_SELECT}, ${PAY_EMBED}`)
      .eq("organization_id", organizationId)
      .or(paymentsCandidateTimeOrFilter(range))
      .order("created_at", { ascending: false });
    if (paymentStatus !== "all") q = q.eq("status", paymentStatus);
    const { data, error } = await q;
    if (!error) return { rows: finalizePaymentCandidateRows(data || [], range), compatibilityMode: true };
    logPaymentsQueryFailure("payments_minimal_nopkg_embed", error);
    if (!shouldFallbackPaymentsQuery(error.message)) return { error: USER_MSG };
  }

  // 8
  {
    let q = adminClient
      .from("payments")
      .select(MINIMAL_NOPKG_SELECT)
      .eq("organization_id", organizationId)
      .or(paymentsCandidateTimeOrFilter(range))
      .order("created_at", { ascending: false });
    if (paymentStatus !== "all") q = q.eq("status", paymentStatus);
    const { data, error } = await q;
    if (!error) return { rows: finalizePaymentCandidateRows(data || [], range), compatibilityMode: true };
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
    if (!error) return { rows: finalizePaymentCandidateRows(data || [], range), compatibilityMode: true };
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
    if (!error) return { rows: finalizePaymentCandidateRows(data || [], range), compatibilityMode: true };
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
    if (!error) return { rows: finalizePaymentCandidateRows(data || [], range), compatibilityMode: true };
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
    if (!error) return { rows: finalizePaymentCandidateRows(data || [], range), compatibilityMode: true };
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

function buildCoachAggregates(lessons: AccountingFinanceLessonRow[]): AccountingFinanceCoachAggregateRow[] {
  type Acc = {
    coachId: string;
    coachName: string;
    total: number;
    groupCount: number;
    privateCount: number;
    completedCount: number;
    plannedCount: number;
    cancelledCount: number;
    lastMs: number;
  };
  const UNKNOWN = "__unassigned__";
  const map = new Map<string, Acc>();

  for (const l of lessons) {
    const key = l.coachId || UNKNOWN;
    let a = map.get(key);
    if (!a) {
      a = {
        coachId: l.coachId || "",
        coachName: l.coachId ? l.coachName : "Atanmamış koç",
        total: 0,
        groupCount: 0,
        privateCount: 0,
        completedCount: 0,
        plannedCount: 0,
        cancelledCount: 0,
        lastMs: 0,
      };
      map.set(key, a);
    }
    a.total += 1;
    if (l.sourceType === "group") a.groupCount += 1;
    else a.privateCount += 1;
    if (l.status === "completed") a.completedCount += 1;
    else if (l.status === "planned") a.plannedCount += 1;
    else if (l.status === "cancelled") a.cancelledCount += 1;
    const t = new Date(l.startsAt).getTime();
    if (Number.isFinite(t) && t > a.lastMs) a.lastMs = t;
  }

  return Array.from(map.values())
    .map((a) => ({
      coachId: a.coachId,
      coachName: a.coachName,
      total: a.total,
      groupCount: a.groupCount,
      privateCount: a.privateCount,
      completedCount: a.completedCount,
      plannedCount: a.plannedCount,
      cancelledCount: a.cancelledCount,
      lastLessonAt: a.lastMs > 0 ? new Date(a.lastMs).toISOString() : null,
    }))
    .sort((x, y) => x.coachName.localeCompare(y.coachName, "tr"));
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
  const lessonsOnly = rawFilters.lessonsOnly === true;

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

  let paymentLoad: { rows: Record<string, unknown>[]; compatibilityMode: boolean } = { rows: [], compatibilityMode: false };
  if (!lessonsOnly) {
    const loaded = await loadPaymentsWithCompatibility({
      organizationId,
      range: timeRange,
      paymentDateBounds: payoutDateBounds,
      paymentStatus,
      paymentKind,
    });
    if ("error" in loaded) return { error: loaded.error };
    paymentLoad = loaded;
  }

  let mergedPaymentRows = [...(paymentLoad.rows || [])];
  if (!lessonsOnly) {
    const supplemental = await loadSupplementalPrivateLessonLedgerRows({
      adminClient,
      organizationId,
      range: timeRange,
      existingPaymentRows: mergedPaymentRows,
      paymentStatus,
      paymentKind,
    });
    mergedPaymentRows = [...mergedPaymentRows, ...supplemental].sort(
      (a, b) => (paymentRowEffectiveInstantMs(b) ?? 0) - (paymentRowEffectiveInstantMs(a) ?? 0)
    );
  }

  const mapPaymentRow = (row: Record<string, unknown>): AccountingFinancePaymentRow => {
    const athleteRaw = Array.isArray(row.athlete_profile) ? row.athlete_profile[0] : row.athlete_profile;
    const athlete = athleteRaw as { full_name?: string | null; email?: string | null } | null;
    const status = row.status === "odendi" ? "odendi" : "bekliyor";
    const normalizedKind = inferPaymentKindFromLegacyRow(row);
    const normalizedScope = inferPaymentScopeFromLegacyRow(row);
    const amt = normalizeMoney(Number(row.amount) || 0);
    const pkgId = String(row.package_id || "").trim();
    const desc = String(row.description || "").trim();
    const disp = String(row.display_name || "").trim();
    const descriptionText = desc || disp || "—";
    return {
      id: String(row.id || ""),
      athleteId: (row.profile_id as string | null) || null,
      athleteName: toDisplayName(athlete?.full_name ?? null, athlete?.email ?? null, "Sporcu"),
      amount: amt,
      paidAmount: status === "odendi" ? amt : 0,
      remainingBalance: null,
      paymentDate: normalizePaymentDisplayDate(row),
      dueDate: (row.due_date as string | null) || null,
      status,
      paymentKind: normalizedKind,
      paymentScope: normalizedScope,
      paymentType: String(row.payment_type || "aylik"),
      sourceLabel: String(row.display_name || row.description || "Tahsilat"),
      descriptionText,
      channelLabel: buildPaymentChannelLabel(row, normalizedKind, status),
      packageId: pkgId && isUuid(pkgId) ? pkgId : null,
    };
  };

  const mappedPaymentsAll: AccountingFinancePaymentRow[] = lessonsOnly ? [] : mergedPaymentRows.map(mapPaymentRow);
  const mappedPaymentsFiltered = paymentKind ? mappedPaymentsAll.filter((row) => row.paymentKind === paymentKind) : mappedPaymentsAll;

  if (!lessonsOnly && mappedPaymentsFiltered.length) {
    await enrichPaymentRowsWithPackageBalance(adminClient, organizationId, mappedPaymentsFiltered);
  }

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
        title: String(row.title || "Grup Dersi"),
        startsAt: String(row.start_time || ""),
        endsAt: (row.end_time as string | null) || null,
        status: normalizedStatus,
        coachId: (row.coach_id as string | null) || null,
        coachName: toDisplayName(coach?.full_name ?? null, coach?.email ?? null, "Koç"),
        location: (row.location as string | null) || null,
        participantCount: Array.isArray(row.training_participants) ? row.training_participants.length : 0,
      };
    });
  }

  let privateLessons: AccountingFinanceLessonRow[] = [];
  if (lessonType !== "group") {
    let privateQuery = adminClient
      .from("private_lesson_sessions")
      .select(
        "id, starts_at, ends_at, status, coach_id, location, coach_profile:profiles!private_lesson_sessions_coach_id_fkey(full_name, email), pkg:private_lesson_packages!private_lesson_sessions_package_id_fkey(package_name)"
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
      const pkg = pkgRaw as { package_name?: string | null } | null;
      const normalizedStatus = normalizeLessonStatus(row.status as string | null);
      return {
        id: String(row.id || ""),
        sourceType: "private",
        title: String(pkg?.package_name || "Özel Ders"),
        startsAt: String(row.starts_at || ""),
        endsAt: (row.ends_at as string | null) || null,
        status: normalizedStatus,
        coachId: (row.coach_id as string | null) || null,
        coachName: toDisplayName(coach?.full_name ?? null, coach?.email ?? null, "Koç"),
        location: (row.location as string | null) || null,
        participantCount: 1,
      };
    });
  }

  const lessons = [...groupLessons, ...privateLessons].sort(
    (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
  );

  const coachAggregates = buildCoachAggregates(lessons);
  const totalLessons = lessons.length;
  const completedLessons = lessons.filter((l) => l.status === "completed").length;
  const plannedLessons = lessons.filter((l) => l.status === "planned").length;
  const cancelledLessons = lessons.filter((l) => l.status === "cancelled").length;
  const activeCoachCount = new Set(lessons.map((l) => l.coachId).filter(Boolean)).size;

  const totalCollected = lessonsOnly
    ? 0
    : mappedPaymentsFiltered.filter((p) => p.status === "odendi").reduce((sum, p) => sum + p.paidAmount, 0);
  const pendingCollection = lessonsOnly
    ? 0
    : mappedPaymentsFiltered.filter((p) => p.status === "bekliyor").reduce((sum, p) => sum + normalizeMoney(p.amount), 0);
  const paymentKinds = lessonsOnly
    ? []
    : Array.from(new Set(mappedPaymentsAll.map((p) => p.paymentKind))).sort((a, b) => a.localeCompare(b, "tr"));

  logAccountingFinanceDebug({
    lessonsOnly,
    rangeMode,
    dateFromUtc: timeRange.from,
    dateToExclusiveUtc: timeRange.toExclusive,
    paymentRawCount: paymentLoad.rows?.length ?? 0,
    mergedPaymentCount: mergedPaymentRows.length,
    filteredPaymentCount: mappedPaymentsFiltered.length,
    lessonCount: lessons.length,
    kpiTotalCollectedInput: totalCollected,
    kpiPendingInput: pendingCollection,
    compatibilityMode: paymentLoad.compatibilityMode,
  });

  return {
    snapshot: {
      organizationId,
      actorRole: role,
      dataScope: lessonsOnly ? "lessons_only" : "full",
      compatibilityNotice:
        !lessonsOnly && paymentLoad.compatibilityMode ? "Tahsilat kayıtları yüklenirken uyumluluk modu kullanıldı." : null,
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
        totalLessons,
        completedLessons,
        plannedLessons,
        cancelledLessons,
        activeCoachCount,
      },
      payments: mappedPaymentsFiltered,
      lessons,
      coachAggregates,
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

async function resolvePrivateLessonPaymentActorIdForRpc(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  organizationId: string,
  role: ReturnType<typeof getSafeRole>,
  sessionActorId: string,
  fallbackCoachId: string | null
): Promise<{ actorId: string } | { error: string }> {
  if (role === "admin") {
    if (!isUuid(sessionActorId)) return { error: "Oturum profili geçersiz." };
    return { actorId: sessionActorId };
  }
  if (role === "super_admin") {
    const { data: adminRow } = await adminClient
      .from("profiles")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();
    if (adminRow?.id) return { actorId: adminRow.id as string };
    if (fallbackCoachId && isUuid(fallbackCoachId)) return { actorId: fallbackCoachId };
    return { error: "Tahsilat kaydı için geçerli bir yönetici profili bulunamadı." };
  }
  return { error: "Bu işlem yalnızca yönetici tarafından yapılabilir." };
}

/**
 * Muhasebe tahsilat modalı: seçili sporcu için aktif özel ders paketleri (dropdown).
 */
export async function listPrivateLessonPackagesForAccounting(payload: {
  athleteId: string;
  organizationId?: string | null;
}): Promise<{ packages: AccountingFinancePackageOption[] } | { error: string }> {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: false });
  if ("error" in resolved) return { error: resolved.error };
  const role = getSafeRole(resolved.actor.role);
  if (role !== "admin" && role !== "super_admin") {
    return { error: "Bu işlem yalnızca yönetici tarafından yapılabilir." };
  }

  const athleteId = (payload.athleteId || "").trim();
  if (!isUuid(athleteId)) return { error: "Geçersiz sporcu." };

  let organizationId = resolved.actor.organizationId || "";
  const orgFromPayload = (payload.organizationId || "").trim();
  if (role === "super_admin") {
    if (!isUuid(orgFromPayload)) return { error: "Super admin için organizationId zorunludur." };
    organizationId = orgFromPayload;
  } else if (!organizationId) {
    return { error: "Organizasyon bilgisi alınamadı." };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: athlete } = await adminClient
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", athleteId)
    .maybeSingle();
  if (!athlete || getSafeRole(athlete.role) !== "sporcu" || athlete.organization_id !== organizationId) {
    return { error: "Sporcu bu organizasyonda bulunamadı." };
  }

  const { data: rows, error } = await adminClient
    .from("private_lesson_packages")
    .select("id, package_name, remaining_lessons, total_price, amount_paid, payment_status, is_active")
    .eq("organization_id", organizationId)
    .eq("athlete_id", athleteId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return { error: `Paketler alınamadı: ${error.message}` };

  const packages: AccountingFinancePackageOption[] = (rows || [])
    .map((row) => ({
      id: String(row.id),
      packageName: String(row.package_name || "Paket"),
      remainingLessons: Math.max(0, Math.floor(Number(row.remaining_lessons) || 0)),
      totalPrice: normalizeMoney(row.total_price),
      amountPaid: normalizeMoney(row.amount_paid),
      paymentStatus: (row.payment_status as AccountingFinancePackageOption["paymentStatus"]) || "unpaid",
      isActive: row.is_active !== false,
    }))
    .filter((p) => {
      if (p.totalPrice <= 0) return true;
      return normalizeMoney(p.totalPrice - p.amountPaid) > 0.001;
    });

  return { packages };
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

  if (paymentKind !== "private_lesson_package" && packageId && isUuid(packageId)) {
    return { error: "Paket yalnızca özel ders paketi tahsilat türünde seçilebilir." };
  }

  if (paymentKind === "private_lesson_package") {
    if (!isUuid(packageId)) return { error: "Özel ders paketi için paket seçimi zorunludur." };

    const { data: pkgCoach } = await adminClient
      .from("private_lesson_packages")
      .select("coach_id")
      .eq("id", packageId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    const rpcActor = await resolvePrivateLessonPaymentActorIdForRpc(
      adminClient,
      organizationId,
      role,
      resolved.actor.id,
      (pkgCoach?.coach_id as string | null) || null
    );
    if ("error" in rpcActor) return { error: rpcActor.error };

    const sync = await applyPrivateLessonPackagePaymentWithPaymentRow({
      organizationId,
      packageId,
      athleteProfileId: profileId,
      amount,
      paidAtIso: paidAt,
      dueDateKey,
      monthName,
      yearInt,
      rpcActorProfileId: rpcActor.actorId,
      paymentsDescription: description,
      rpcNote: description?.trim() || "Muhasebe — özel ders paketi tahsilatı",
    });
    if (!sync.ok) return { error: sync.error };
    return { success: true as const };
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
      package_id: null,
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

  revalidatePath("/muhasebe-finans");
  revalidatePath("/finans");
  return { success: true as const };
}
