import type { PaymentRow } from "@/types/domain";
import type { PrivateLessonPackage, PrivateLessonPayment } from "@/lib/types/privateLesson";
import { getAccountingPaymentKindLabel, getAccountingPaymentScopeLabel } from "@/lib/accountingFinance/labels";

export type UnifiedAthletePaymentFilter = "all" | "membership" | "package" | "extra";

export type UnifiedAthletePaymentLine = {
  id: string;
  sortMs: number;
  amount: number;
  title: string;
  detail: string;
  scopeLabel: string;
  kindLabel: string;
  statusLabel: string;
  statusTone: "paid" | "pending";
  sourceBadge: string | null;
  filterTags: UnifiedAthletePaymentFilter[];
  refKind: "payment" | "private_lesson_payment";
  refId: string;
};

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

function mapPaymentRowScopes(raw: {
  payment_type: string;
  payment_scope?: string | null;
  payment_kind?: string | null;
}): { payment_scope: NonNullable<PaymentRow["payment_scope"]>; payment_kind: string } {
  const pt = raw.payment_type === "paket" ? "paket" : "aylik";
  if (pt === "paket") {
    return { payment_scope: "private_lesson", payment_kind: "private_lesson_package" };
  }
  const s = String(raw.payment_scope || "").trim().toLowerCase();
  const k = String(raw.payment_kind || "").trim().toLowerCase();
  if (s === "extra_charge") {
    return { payment_scope: "extra_charge", payment_kind: normalizePaymentKindKey(raw.payment_kind, "extra_charge") };
  }
  if (s === "private_lesson") {
    return { payment_scope: "private_lesson", payment_kind: "private_lesson_package" };
  }
  if (k && k !== "monthly_membership" && k !== "private_lesson_package") {
    return { payment_scope: "extra_charge", payment_kind: normalizePaymentKindKey(raw.payment_kind, "extra_charge") };
  }
  return { payment_scope: "membership", payment_kind: "monthly_membership" };
}

/** DB satırından okunan ham alanlarla PaymentRow üretir (dinamik ek tahsilat kind’larını korur). */
export function mapPaymentRowForAthlete(raw: {
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
  const { payment_scope, payment_kind } = mapPaymentRowScopes(raw);
  return {
    id: raw.id,
    profile_id: ownerId,
    organization_id: raw.organization_id,
    amount: Number(raw.amount) || 0,
    payment_type: pt,
    payment_scope,
    payment_kind,
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

function istanbulDayKeyFromIsoOrDate(isoOrYmd: string, timeZone: string = "Europe/Istanbul"): string {
  const s = isoOrYmd.trim();
  const withTime = s.includes("T") ? s : `${s}T12:00:00.000Z`;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(withTime));
  } catch {
    return s.slice(0, 10);
  }
}

function paymentRowSortMs(row: PaymentRow): number {
  const raw = row.payment_date || (row.due_date ? `${row.due_date}T12:00:00.000Z` : null);
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

function paymentRowTitle(row: PaymentRow): string {
  if (row.display_name?.trim()) return row.display_name.trim();
  if (row.payment_scope === "extra_charge") {
    return getAccountingPaymentKindLabel(row.payment_kind);
  }
  if (row.payment_scope === "private_lesson" || row.payment_type === "paket") {
    return "Paket ödemesi";
  }
  const d = row.description?.trim();
  if (d) return d.length > 80 ? `${d.slice(0, 77)}…` : d;
  return "Aidat";
}

function ledgerFingerprintSet(payments: PrivateLessonPayment[], tz: string): Set<string> {
  const s = new Set<string>();
  for (const p of payments) {
    const day = istanbulDayKeyFromIsoOrDate(p.paidAt, tz);
    s.add(`${day}:${Math.round(p.amount * 100)}`);
  }
  return s;
}

function legacyPackageShouldSkip(row: PaymentRow, fingerprints: Set<string>, tz: string): boolean {
  const raw = row.payment_date || row.due_date;
  if (!raw) return false;
  const day = istanbulDayKeyFromIsoOrDate(raw, tz);
  return fingerprints.has(`${day}:${Math.round(row.amount * 100)}`);
}

/**
 * Aidat + ek tahsilat (`payments`, aylık) + özel ders defteri + yinelenen eski paket satırlarını tek kronolojide birleştirir.
 *
 * @param input.timeZone Organizasyonun saat dilimi (IANA). Verilmezse global varsayılan ("Europe/Istanbul") kullanılır.
 */
export function buildUnifiedAthletePaymentTimeline(input: {
  aidatPayments: PaymentRow[];
  legacyPackagePayments: PaymentRow[];
  privateLessonPayments: PrivateLessonPayment[];
  privateLessonPackages: PrivateLessonPackage[];
  timeZone?: string;
}): UnifiedAthletePaymentLine[] {
  const tz = input.timeZone || "Europe/Istanbul";
  const pkgById = new Map(input.privateLessonPackages.map((p) => [p.id, p]));
  const fp = ledgerFingerprintSet(input.privateLessonPayments, tz);
  const lines: UnifiedAthletePaymentLine[] = [];

  for (const row of input.aidatPayments) {
    const scope = row.payment_scope || "membership";
    const tags: UnifiedAthletePaymentFilter[] =
      scope === "extra_charge" ? ["extra", "all"] : ["membership", "all"];
    const sortMs = paymentRowSortMs(row);
    lines.push({
      id: `pay:${row.id}`,
      sortMs,
      amount: row.amount,
      title: paymentRowTitle(row),
      detail: row.due_date ? `Vade: ${row.due_date}` : "Vade: —",
      scopeLabel: getAccountingPaymentScopeLabel(scope),
      kindLabel: getAccountingPaymentKindLabel(row.payment_kind),
      statusLabel: row.status === "odendi" ? "Ödendi" : "Bekliyor",
      statusTone: row.status === "odendi" ? "paid" : "pending",
      sourceBadge: null,
      filterTags: tags,
      refKind: "payment",
      refId: row.id,
    });
  }

  for (const row of input.legacyPackagePayments) {
    if (legacyPackageShouldSkip(row, fp, tz)) continue;
    const sortMs = paymentRowSortMs(row);
    lines.push({
      id: `pay:${row.id}`,
      sortMs,
      amount: row.amount,
      title: paymentRowTitle(row),
      detail: row.due_date ? `Vade: ${row.due_date}` : "Eski paket kaydı",
      scopeLabel: getAccountingPaymentScopeLabel("private_lesson"),
      kindLabel: getAccountingPaymentKindLabel("private_lesson_package"),
      statusLabel: row.status === "odendi" ? "Ödendi" : "Bekliyor",
      statusTone: row.status === "odendi" ? "paid" : "pending",
      sourceBadge: "Eski paket (payments)",
      filterTags: ["package", "all"],
      refKind: "payment",
      refId: row.id,
    });
  }

  for (const pay of input.privateLessonPayments) {
    const pkg = pkgById.get(pay.packageId);
    const onboarding = (pay.note || "").toLowerCase().includes("onboarding");
    const sortMs = new Date(pay.paidAt).getTime();
    lines.push({
      id: `plp:${pay.id}`,
      sortMs: Number.isFinite(sortMs) ? sortMs : 0,
      amount: pay.amount,
      title: "Özel ders paketi tahsilatı",
      detail: pkg?.packageName || `Paket ${pay.packageId.slice(0, 8)}…`,
      scopeLabel: getAccountingPaymentScopeLabel("private_lesson"),
      kindLabel: getAccountingPaymentKindLabel("private_lesson_package"),
      statusLabel: "Ödendi",
      statusTone: "paid",
      sourceBadge: onboarding ? "Kaynak: Onboarding" : null,
      filterTags: ["package", "all"],
      refKind: "private_lesson_payment",
      refId: pay.id,
    });
  }

  lines.sort((a, b) => b.sortMs - a.sortMs);
  return lines;
}

export function filterUnifiedTimeline(
  lines: UnifiedAthletePaymentLine[],
  filter: UnifiedAthletePaymentFilter
): UnifiedAthletePaymentLine[] {
  if (filter === "all") return lines;
  return lines.filter((l) => l.filterTags.includes(filter));
}
