"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { isUuid } from "@/lib/validation/uuid";
import { toDisplayName } from "@/lib/profile/displayName";
import { normalizeMoney } from "@/lib/privateLessons/packageMath";
import { resolveOrganizationTimeZone } from "@/lib/organization/timeZone";
import {
  istanbulCustomRangeToPayoutDateInclusiveBounds,
  istanbulDateWallRangeToHalfOpenUtc,
  istanbulMonthToPayoutDateInclusiveBounds,
  istanbulMonthWallToHalfOpenUtc,
} from "@/lib/accountingFinance/istanbulQueryRange";
import {
  resolvePackageLifecycleStatus,
  type PackageLifecycleStatus,
} from "@/lib/privateLessons/packageStatus";
import {
  applyPrivateLessonPaymentActiveFilter,
  getSchemaCapabilities,
  runReceivablePackageSelectWithCompat,
  userFacingDataError,
} from "@/lib/schemaCompat";
import {
  computeReceivableStatus,
  type ReceivableComputedStatus,
} from "@/lib/finance/receivableStatus";

export type ReceivableDashboardFilters = {
  orgId?: string | null;
  month?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  athleteId?: string | null;
  /** `profiles.team` içerir araması (bosluklar korunur) */
  teamContains?: string | null;
  packageLifecycle?: "all" | PackageLifecycleStatus;
  pkgPaymentStatus?: "all" | "unpaid" | "partial" | "paid";
  receivableState?: "all" | ReceivableComputedStatus;
};

export type ReceivablePackageRow = {
  packageId: string;
  packageName: string;
  athleteId: string;
  athleteName: string;
  athleteTeam: string | null;
  totalPrice: number;
  amountPaid: number;
  remainingBalance: number;
  paymentStatus: "unpaid" | "partial" | "paid";
  lifecycleStatus: PackageLifecycleStatus;
  nextPaymentDueAt: string | null;
  receivableStatus: ReceivableComputedStatus;
  receivableLabel: string;
  receivableTone: string;
  daysOverdue: number | null;
  daysUntilDue: number | null;
};

export type ReceivableAthleteDebtRow = {
  athleteId: string;
  athleteName: string;
  team: string | null;
  totalRemaining: number;
  packageCount: number;
  worstReceivableStatus: ReceivableComputedStatus;
};

export type ReceivableDashboardSnapshot = {
  organizationId: string;
  filtersApplied: {
    month: string;
    dateFrom: string;
    dateTo: string;
    rangeMode: "month" | "custom_range";
  };
  kpis: {
    totalPendingReceivable: number;
    overdueReceivable: number;
    /** Seçilen dönemde tahsilat olarak kaydedilen (PLP + payments) */
    collectedInPeriod: number;
    /** Yakın vadede riskli kalan bakiye toplamı */
    dueSoonReceivableAmount: number;
    expectedInPeriod: number;
    debtorAthleteCount: number;
    overduePackageCount: number;
    dueSoonPackageCount: number;
  };
  packageRows: ReceivablePackageRow[];
  athleteDebts: ReceivableAthleteDebtRow[];
  options: {
    athletes: Array<{ id: string; full_name: string }>;
    teamHints: string[];
  };
};

const STATUS_RANK: Record<ReceivableComputedStatus, number> = {
  overdue: 50,
  due_soon: 40,
  partial_payment: 30,
  payment_pending: 20,
  payment_complete: 10,
  no_debt: 0,
};

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function dueDateKey(raw: string | null | undefined): string | null {
  if (!raw || !String(raw).trim()) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function isDueInInclusiveWallRange(dueIso: string | null, fromKey: string, toKeyInclusive: string): boolean {
  const key = dueDateKey(dueIso);
  if (!key) return false;
  return key >= fromKey && key <= toKeyInclusive;
}

export async function loadReceivablesDashboard(
  raw: ReceivableDashboardFilters = {}
): Promise<{ snapshot: ReceivableDashboardSnapshot } | { error: string }> {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: false });
  if ("error" in resolved) return { error: resolved.error };
  const role = getSafeRole(resolved.actor.role);
  if (role !== "admin" && role !== "super_admin") {
    return { error: "Bu görünüme yalnızca yönetici erişebilir." };
  }

  const adminClient = createSupabaseAdminClient();
  let organizationId = resolved.actor.organizationId || "";
  if (role === "super_admin") {
    const orgInput = (raw.orgId || "").trim();
    if (!isUuid(orgInput)) return { error: "Super admin için ?org=ORG_UUID zorunludur." };
    const { data: orgExists } = await adminClient.from("organizations").select("id").eq("id", orgInput).maybeSingle();
    if (!orgExists) return { error: "Organizasyon bulunamadı." };
    organizationId = orgInput;
  } else if (!organizationId) {
    return { error: "Organizasyon bilgisi alınamadı." };
  }

  const orgTimeZone = await resolveOrganizationTimeZone(organizationId);
  const month = (raw.month || currentMonthKey()).trim();
  const dateFrom = (raw.dateFrom || "").trim();
  const dateTo = (raw.dateTo || "").trim();
  const rangeMode = dateFrom && dateTo ? "custom_range" : "month";
  const timeRange =
    rangeMode === "custom_range"
      ? istanbulDateWallRangeToHalfOpenUtc(dateFrom, dateTo, orgTimeZone)
      : istanbulMonthWallToHalfOpenUtc(month, orgTimeZone);
  if (!timeRange) return { error: "Geçersiz tarih filtresi." };

  const payoutBounds =
    rangeMode === "custom_range"
      ? istanbulCustomRangeToPayoutDateInclusiveBounds(dateFrom, dateTo)
      : istanbulMonthToPayoutDateInclusiveBounds(month);
  if (!payoutBounds) return { error: "Geçersiz tarih filtresi." };

  const athleteFilter = (raw.athleteId || "").trim();
  const teamQ = (raw.teamContains || "").trim();
  const lifecycleF = raw.packageLifecycle || "all";
  const payStF = raw.pkgPaymentStatus || "all";
  const recvF = raw.receivableState || "all";

  const { data: coachRows, error: profErr } = await adminClient
    .from("profiles")
    .select("id, full_name, email, role, team")
    .eq("organization_id", organizationId)
    .order("full_name", { ascending: true });
  if (profErr) return { error: `Profil listesi alınamadı: ${profErr.message}` };

  const allProfiles = coachRows || [];
  const athletes = allProfiles
    .filter((row) => getSafeRole(row.role) === "sporcu")
    .map((row) => ({ id: row.id, full_name: toDisplayName(row.full_name, row.email, "Sporcu") }));

  const teamHints = Array.from(
    new Set(
      allProfiles
        .map((r) => (typeof r.team === "string" ? r.team.trim() : ""))
        .filter((t) => t.length > 0)
    )
  ).slice(0, 80);

  const caps = await getSchemaCapabilities();
  const pkgFetch = await runReceivablePackageSelectWithCompat(caps, async (select) => {
    let pkgQuery = adminClient
      .from("private_lesson_packages")
      .select(select)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(4000);
    if (isUuid(athleteFilter)) pkgQuery = pkgQuery.eq("athlete_id", athleteFilter);
    const { data, error } = await pkgQuery;
    return { data, error };
  });
  if (pkgFetch.error) {
    return { error: userFacingDataError("Paket listesi alınamadı", pkgFetch.error.message) };
  }
  type ReceivablePkgRaw = {
    id: string;
    package_name: string;
    athlete_id: string;
    total_price: number | string | null;
    amount_paid: number | string | null;
    payment_status: string;
    is_active?: boolean;
    lifecycle_status?: string | null;
    next_payment_due_at?: string | null;
    created_at: string;
    athlete_profile?:
      | { full_name?: string | null; email?: string | null; team?: string | null }
      | null;
  };
  const pkgRaw = (pkgFetch.data || []) as unknown as ReceivablePkgRaw[];

  const today = new Date();
  const packageRowsAll: ReceivablePackageRow[] = (pkgRaw || []).map((row) => {
    const athleteJoin = row.athlete_profile as
      | { full_name?: string | null; email?: string | null; team?: string | null }
      | null
      | undefined;
    const athleteName = toDisplayName(athleteJoin?.full_name, athleteJoin?.email, "Sporcu");
    const athleteTeam =
      athleteJoin?.team != null && String(athleteJoin.team).trim() ? String(athleteJoin.team).trim() : null;
    const totalPrice = normalizeMoney(row.total_price as number | string | null);
    const amountPaid = normalizeMoney(row.amount_paid as number | string | null);
    const remainingBalance = Math.max(0, normalizeMoney(totalPrice - amountPaid));
    const paymentStatus = row.payment_status as "unpaid" | "partial" | "paid";
    const isActive = Boolean(row.is_active ?? true);
    const lifecycleStatus = resolvePackageLifecycleStatus({
      lifecycleStatus: row.lifecycle_status as string | null | undefined,
      isActive,
      remainingLessons: isActive ? 1 : 0,
      totalLessons: 1,
      usedLessons: 0,
    });
    const nextPaymentDueAt = (row.next_payment_due_at as string | null) ?? null;

    const recv = computeReceivableStatus({
      totalPrice,
      amountPaid,
      nextPaymentDueAt,
      today,
    });

    return {
      packageId: row.id as string,
      packageName: String(row.package_name || "Paket"),
      athleteId: row.athlete_id as string,
      athleteName,
      athleteTeam,
      totalPrice,
      amountPaid,
      remainingBalance,
      paymentStatus,
      lifecycleStatus,
      nextPaymentDueAt,
      receivableStatus: recv.status,
      receivableLabel: recv.label,
      receivableTone: recv.tone,
      daysOverdue: recv.daysOverdue,
      daysUntilDue: recv.daysUntilDue,
    };
  });

  const teamLc = teamQ.toLowerCase();
  const packageRowsFiltered = packageRowsAll.filter((r) => {
    if (teamLc && !(r.athleteTeam || "").toLowerCase().includes(teamLc)) return false;
    if (lifecycleF !== "all" && r.lifecycleStatus !== lifecycleF) return false;
    if (payStF !== "all" && r.paymentStatus !== payStF) return false;
    if (recvF !== "all" && r.receivableStatus !== recvF) return false;
    return true;
  });

  const withDebt = packageRowsFiltered.filter((r) => r.remainingBalance > 0.001);

  const totalPendingReceivable = withDebt.reduce((s, r) => s + r.remainingBalance, 0);
  const overdueReceivable = withDebt
    .filter((r) => r.receivableStatus === "overdue")
    .reduce((s, r) => s + r.remainingBalance, 0);
  const overduePackageCount = withDebt.filter((r) => r.receivableStatus === "overdue").length;
  const dueSoonPackageCount = withDebt.filter((r) => r.receivableStatus === "due_soon").length;
  const dueSoonReceivableAmount = withDebt
    .filter((r) => r.receivableStatus === "due_soon")
    .reduce((s, r) => s + r.remainingBalance, 0);

  const debtorIds = new Set(withDebt.map((r) => r.athleteId));
  const debtorAthleteCount = debtorIds.size;

  const expectedInPeriod = withDebt
    .filter((r) =>
      isDueInInclusiveWallRange(r.nextPaymentDueAt, payoutBounds.fromKey, payoutBounds.toKeyInclusive)
    )
    .reduce((s, r) => s + r.remainingBalance, 0);

  const [{ data: plpPay }, { data: payRows }] = await Promise.all([
    applyPrivateLessonPaymentActiveFilter(
      adminClient
        .from("private_lesson_payments")
        .select("amount")
        .eq("organization_id", organizationId)
        .gte("paid_at", timeRange.from)
        .lt("paid_at", timeRange.toExclusive),
      caps
    ),
    adminClient
      .from("payments")
      .select("amount")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .eq("status", "odendi")
      .gte("paid_at", timeRange.from)
      .lt("paid_at", timeRange.toExclusive),
  ]);

  const collectedInPeriod =
    (plpPay || []).reduce((s, r) => s + normalizeMoney(r.amount as number | string | null), 0) +
    (payRows || []).reduce((s, r) => s + normalizeMoney(r.amount as number | string | null), 0);

  const byAthlete = new Map<
    string,
    { name: string; team: string | null; total: number; count: number; worst: ReceivableComputedStatus }
  >();
  for (const r of withDebt) {
    const cur = byAthlete.get(r.athleteId);
    const worst: ReceivableComputedStatus =
      !cur || STATUS_RANK[r.receivableStatus] > STATUS_RANK[cur.worst] ? r.receivableStatus : cur.worst;
    if (!cur) {
      byAthlete.set(r.athleteId, {
        name: r.athleteName,
        team: r.athleteTeam,
        total: r.remainingBalance,
        count: 1,
        worst,
      });
    } else {
      byAthlete.set(r.athleteId, {
        ...cur,
        total: cur.total + r.remainingBalance,
        count: cur.count + 1,
        worst,
      });
    }
  }

  const athleteDebts: ReceivableAthleteDebtRow[] = Array.from(byAthlete.entries()).map(([athleteId, v]) => ({
    athleteId,
    athleteName: v.name,
    team: v.team,
    totalRemaining: normalizeMoney(v.total),
    packageCount: v.count,
    worstReceivableStatus: v.worst,
  }));
  athleteDebts.sort((a, b) => b.totalRemaining - a.totalRemaining);

  return {
    snapshot: {
      organizationId,
      filtersApplied: {
        month,
        dateFrom,
        dateTo,
        rangeMode,
      },
      kpis: {
        totalPendingReceivable: normalizeMoney(totalPendingReceivable),
        overdueReceivable: normalizeMoney(overdueReceivable),
        collectedInPeriod: normalizeMoney(collectedInPeriod),
        dueSoonReceivableAmount: normalizeMoney(dueSoonReceivableAmount),
        expectedInPeriod: normalizeMoney(expectedInPeriod),
        debtorAthleteCount,
        overduePackageCount,
        dueSoonPackageCount,
      },
      packageRows: packageRowsFiltered,
      athleteDebts,
      options: { athletes, teamHints },
    },
  };
}
