"use server";


import { withServerActionGuard } from "@/lib/observability/serverActionError";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { getCoachPermissions } from "@/lib/auth/coachPermissions";
import { messageIfCoachCannotOperate } from "@/lib/coach/lifecycle";
import { DEFAULT_COACH_PERMISSIONS } from "@/lib/types";
import { toDisplayName } from "@/lib/profile/displayName";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { computeFinanceStatusSummary, sumPackageOpenBalance } from "@/lib/finance/paymentSummary";
import type { PaymentRow } from "@/types/domain";
import { chunkedInQuery } from "@/lib/db/chunkedIn";
import { isoToZonedDateKey } from "@/lib/schedule/scheduleWallTime";
import { istanbulDateWallRangeToHalfOpenUtc } from "@/lib/accountingFinance/istanbulQueryRange";
import { resolveOrganizationTimeZone } from "@/lib/organization/timeZone";
import { isOrganizationEntitlementEnabled } from "@/lib/auth/serverActionFeatureAccess";
import { ENTITLEMENT_KEYS } from "@/lib/organization/features/keys";
import {
  normalizeDirectoryPagination,
  totalDirectoryPages,
} from "@/lib/management/directoryPagination";
import { PROFILE_LOAD_FETCH_HARD_CAP } from "@/lib/performance/aggregationHelpers";

type ManagementRole = "admin" | "coach";
type DailyTrainingLoadReport = {
  id: string;
  rpe_score: number;
  duration_minutes: number;
  total_load: number;
  measurement_date: string;
  profiles: {
    full_name: string | null;
    position: string | null;
    number: string | null;
    organization_id: string | null;
  };
};

/**
 * Yönetim aksiyonları için ortak hata sınıflandırması (Faz 2.4):
 * - "permission_denied" → oturum var ama bu kapı kapalı (coach inactive, rol yanlış vb.)
 * - "auth_required"     → oturum yok / claim çözülmedi
 * - "fetch_error"       → DB / runtime hatası
 *
 * UI bu alana göre "Yetkiniz yok" / "Veri yok" / "Hata" ayrımını yapar.
 */
export type ManagementErrorKind = "permission_denied" | "auth_required" | "fetch_error";

async function resolveManagementActor() {
  const resolved = await resolveSessionActor();
  if ("error" in resolved) return { error: resolved.error, errorKind: "auth_required" as const };
  const sa = resolved.actor;
  if (sa.role !== "admin" && sa.role !== "coach") {
    return {
      error: "Bu islem icin yetkiniz yok." as const,
      errorKind: "permission_denied" as const,
    };
  }
  const organizationId = sa.organizationId;
  if (!organizationId) {
    return {
      error: "Organizasyon bilgisi alinamadi." as const,
      errorKind: "auth_required" as const,
    };
  }
  if (sa.role === "coach") {
    const coachBlock = messageIfCoachCannotOperate(sa.role, sa.isActive ?? true);
    if (coachBlock) return { error: coachBlock, errorKind: "permission_denied" as const };
  }
  return {
    actorId: sa.id,
    role: sa.role as ManagementRole,
    organizationId,
  };
}

export type ManagementDirectoryView = "full" | "summary";

export type ListManagementDirectoryOptions = {
  /** full: sayfalanmis finans alanlari; summary: tum sporcular (hafif profil) */
  view?: ManagementDirectoryView;
  page?: number;
  pageSize?: number;
  search?: string;
  team?: string;
  lifecycle?: "all" | "active" | "inactive";
};

export type ManagementDirectoryAthleteSummary = {
  id: string;
  full_name: string;
  is_active: boolean;
  team: string | null;
  position: string | null;
  number: string | null;
  height: number | null;
  weight: number | null;
};

export type ManagementDirectoryAthleteFull = ManagementDirectoryAthleteSummary & {
  activePackageName: string | null;
  remainingLessons: number | null;
  packagePaymentStatus: string | null;
  lastLessonAt: string | null;
  financeSummary: ReturnType<typeof computeFinanceStatusSummary>;
};

export type ManagementDirectorySuccess = {
  role: ManagementRole;
  actorUserId: string;
  organizationId: string;
  timeZone: string;
  permissions: typeof DEFAULT_COACH_PERMISSIONS;
  coaches: Array<{ id: string; full_name: string }>;
  athletes: ManagementDirectoryAthleteSummary[] | ManagementDirectoryAthleteFull[];
  athleteCount: number;
  totalAthletes: number;
  page: number;
  pageSize: number;
  totalPages: number;
  view: ManagementDirectoryView;
  orgAthleteCap: { capped: true; cap: number; total: number } | null;
};

export type ManagementDirectoryResult = { error: string } | ManagementDirectorySuccess;

type AthleteProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  is_active: boolean | null;
  team: string | null;
  position: string | null;
  number: string | null;
  height: number | null;
  weight: number | null;
  next_aidat_due_date: string | null;
  next_aidat_amount: number | null;
};

function applyAthleteDirectoryFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  options: Pick<ListManagementDirectoryOptions, "search" | "team" | "lifecycle">
) {
  let q = query.eq("role", "sporcu");
  if (options.lifecycle === "active") q = q.eq("is_active", true);
  else if (options.lifecycle === "inactive") q = q.eq("is_active", false);
  const team = options.team?.trim();
  if (team && team !== "Tüm Takımlar") q = q.eq("team", team);
  const search = options.search?.trim();
  if (search) {
    const term = `%${search.replace(/[%_]/g, "")}%`;
    q = q.or(`full_name.ilike.${term},email.ilike.${term}`);
  }
  return q;
}

export async function listManagementDirectory(options?: ListManagementDirectoryOptions) {
  return withServerActionGuard("managementDirectory.listManagementDirectory", async () => {
  const resolved = await resolveManagementActor();
  if ("error" in resolved) return { error: resolved.error };

  const adminClient = createSupabaseAdminClient();
  const permissions =
    resolved.role === "coach"
      ? await getCoachPermissions(resolved.actorId, resolved.organizationId)
      : DEFAULT_COACH_PERMISSIONS;

  const canViewAthletes = resolved.role !== "coach" || permissions.can_view_all_athletes;
  const view = options?.view ?? "summary";
  const pager = view === "full" ? normalizeDirectoryPagination(options?.page, options?.pageSize) : null;

  const athleteSelectSummary =
    "id, full_name, email, role, is_active, team, position, number, height, weight";
  const athleteSelectFull =
    `${athleteSelectSummary}, next_aidat_due_date, next_aidat_amount`;

  const [coachRes, athleteRes] = await Promise.all([
    adminClient
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("organization_id", resolved.organizationId)
      .order("full_name"),
    canViewAthletes
      ? (() => {
          let q = adminClient
            .from("profiles")
            .select(view === "full" ? athleteSelectFull : athleteSelectSummary, { count: "exact" })
            .eq("organization_id", resolved.organizationId)
            .order("full_name");
          q = applyAthleteDirectoryFilters(q, options ?? {});
          if (pager) return q.range(pager.from, pager.to);
          return q;
        })()
      : Promise.resolve({ data: [], error: null, count: 0 }),
  ]);

  if (coachRes.error) return { error: `Koç listesi alınamadı: ${coachRes.error.message}` };
  if (athleteRes.error) return { error: `Sporcu listesi alınamadı: ${athleteRes.error.message}` };

  const coaches = (coachRes.data || [])
    .filter((row) => getSafeRole(row.role) === "coach")
    .map((row) => ({ id: row.id, full_name: toDisplayName(row.full_name, row.email, "Koç") }));

  const athleteRows = ((athleteRes.data || []) as unknown as AthleteProfileRow[]).filter(
    (row) => getSafeRole(row.role) === "sporcu"
  );
  const totalAthletes = canViewAthletes ? (athleteRes.count ?? athleteRows.length) : 0;
  const athleteIds = athleteRows.map((row) => row.id);

  const [financeEnabled, privateLessonsEnabled] = await Promise.all([
    isOrganizationEntitlementEnabled(ENTITLEMENT_KEYS.finance, resolved.organizationId),
    isOrganizationEntitlementEnabled(ENTITLEMENT_KEYS.privateLessons, resolved.organizationId),
  ]);

  const skipFinance = view === "summary" || athleteIds.length === 0;
  const loadPackages = !skipFinance && privateLessonsEnabled;
  const loadPayments = !skipFinance && financeEnabled;
  const loadSessions = !skipFinance && privateLessonsEnabled;

  // FAZ 32: "son tamamlanan ders" DB-side distinct on RPC ile sporcu basina
  // tek satir doner; RPC yoksa eski (tum tamamlanmis seanslari tasiyan)
  // sorguya fallback yapilir.
  const lastSessionRpcPromise =
    loadSessions && athleteIds.length > 0 && !pager
      ? adminClient.rpc("peaker_directory_last_completed_sessions", {
          p_org_id: resolved.organizationId,
        })
      : Promise.resolve({ data: [], error: null });

  const [packageRes, lastSessionRpcRes, paymentRes] = await Promise.all([
    loadPackages && athleteIds.length > 0
      ? adminClient
          .from("private_lesson_packages")
          .select("id, athlete_id, package_name, remaining_lessons, payment_status, total_price, amount_paid, is_active, updated_at")
          .eq("organization_id", resolved.organizationId)
          .in("athlete_id", athleteIds)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    lastSessionRpcPromise,
    // FAZ 32: dizin paket satirlarini kullanmaz (paket finansi packages
    // uzerinden gelir; computeFinanceStatusSummary "paket" disindakileri aidat
    // sayar). Satir hacmi payment_type filtresiyle dusurulur.
    loadPayments && athleteIds.length > 0
      ? adminClient
          .from("payments")
          .select("id, profile_id, organization_id, amount, payment_type, due_date, payment_date, status, total_sessions, remaining_sessions, description")
          .eq("organization_id", resolved.organizationId)
          .neq("payment_type", "paket")
          .is("deleted_at", null)
          .in("profile_id", athleteIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (!skipFinance && packageRes.error) return { error: `Paket bilgisi alınamadı: ${packageRes.error.message}` };
  if (!skipFinance && paymentRes.error) return { error: `Finans bilgisi alınamadı: ${paymentRes.error.message}` };

  let sessionRows: Array<{ athlete_id: string | null; starts_at: string }> = [];
  if (loadSessions && athleteIds.length > 0) {
    if (!pager && !lastSessionRpcRes.error && (lastSessionRpcRes.data || []).length > 0) {
      sessionRows = ((lastSessionRpcRes.data || []) as Array<{ athlete_id: string; last_completed_at: string }>).map(
        (r) => ({ athlete_id: r.athlete_id, starts_at: r.last_completed_at })
      );
    } else {
      const sessionRes = await adminClient
        .from("private_lesson_sessions")
        .select("athlete_id, starts_at, status")
        .eq("organization_id", resolved.organizationId)
        .eq("status", "completed")
        .in("athlete_id", athleteIds)
        .order("starts_at", { ascending: false });
      if (sessionRes.error) return { error: `Ders geçmişi alınamadı: ${sessionRes.error.message}` };
      sessionRows = (sessionRes.data || []) as Array<{ athlete_id: string | null; starts_at: string }>;
    }
  }

  const packageByAthlete = new Map<
    string,
    {
      activePackageName: string | null;
      remainingLessons: number | null;
      packagePaymentStatus: string | null;
    }
  >();
  const packagesByAthlete = new Map<
    string,
    Array<{ payment_status?: string | null; total_price?: unknown; amount_paid?: unknown }>
  >();
  for (const row of packageRes.data || []) {
    const list = packagesByAthlete.get(row.athlete_id) || [];
    list.push({
      payment_status: row.payment_status,
      total_price: row.total_price,
      amount_paid: row.amount_paid,
    });
    packagesByAthlete.set(row.athlete_id, list);

    if (packageByAthlete.has(row.athlete_id)) continue;
    packageByAthlete.set(row.athlete_id, {
      activePackageName: row.is_active ? row.package_name : null,
      remainingLessons: row.is_active ? Number(row.remaining_lessons) : null,
      packagePaymentStatus: row.payment_status ?? null,
    });
  }

  const lastCompletedSessionByAthlete = new Map<string, string>();
  for (const row of sessionRows) {
    if (!row.athlete_id || lastCompletedSessionByAthlete.has(row.athlete_id)) continue;
    lastCompletedSessionByAthlete.set(row.athlete_id, row.starts_at);
  }

  const paymentsByAthlete = new Map<string, PaymentRow[]>();
  for (const row of paymentRes.data || []) {
    if (!row.profile_id) continue;
    const list = paymentsByAthlete.get(row.profile_id) || [];
    list.push({
      id: row.id,
      profile_id: row.profile_id,
      organization_id: row.organization_id,
      amount: Number(row.amount) || 0,
      payment_type: row.payment_type === "paket" ? "paket" : "aylik",
      due_date: row.due_date,
      payment_date: row.payment_date,
      status: row.status || "bekliyor",
      total_sessions: row.total_sessions != null ? Number(row.total_sessions) : null,
      remaining_sessions: row.remaining_sessions != null ? Number(row.remaining_sessions) : null,
      description: row.description ?? null,
    });
    paymentsByAthlete.set(row.profile_id, list);
  }

  const athletes = athleteRows.map((row) => {
    if (view === "summary") {
      return {
        id: row.id,
        full_name: toDisplayName(row.full_name, row.email, "Sporcu"),
        is_active: row.is_active ?? true,
        team: row.team ?? null,
        position: row.position ?? null,
        number: row.number ?? null,
        height: row.height ?? null,
        weight: row.weight ?? null,
      };
    }
    return {
      id: row.id,
      full_name: toDisplayName(row.full_name, row.email, "Sporcu"),
      is_active: row.is_active ?? true,
      team: row.team ?? null,
      position: row.position ?? null,
      number: row.number ?? null,
      height: row.height ?? null,
      weight: row.weight ?? null,
      activePackageName: packageByAthlete.get(row.id)?.activePackageName ?? null,
      remainingLessons: packageByAthlete.get(row.id)?.remainingLessons ?? null,
      packagePaymentStatus: packageByAthlete.get(row.id)?.packagePaymentStatus ?? null,
      lastLessonAt: lastCompletedSessionByAthlete.get(row.id) ?? null,
      financeSummary: computeFinanceStatusSummary({
        aidatPayments: (paymentsByAthlete.get(row.id) || []).filter((p) => p.payment_type === "aylik"),
        plannedNextDueDate: row.next_aidat_due_date ?? null,
        plannedNextAmount: row.next_aidat_amount != null ? Number(row.next_aidat_amount) : null,
        hasPartialPackagePayment: (packagesByAthlete.get(row.id) || []).some(
          (p) => p.payment_status === "partial"
        ),
        packageOpenBalance: sumPackageOpenBalance(packagesByAthlete.get(row.id) || []),
      }),
    };
  });

  const timeZone = await resolveOrganizationTimeZone(resolved.organizationId);
  const page = pager?.page ?? 1;
  const pageSize = pager?.pageSize ?? athletes.length;

  return {
    role: resolved.role,
    actorUserId: resolved.actorId,
    organizationId: resolved.organizationId,
    timeZone,
    permissions,
    coaches,
    athletes,
    athleteCount: athletes.length,
    totalAthletes,
    page,
    pageSize,
    totalPages: pager ? totalDirectoryPages(totalAthletes, pageSize) : 1,
    view,
    orgAthleteCap:
      totalAthletes > PROFILE_LOAD_FETCH_HARD_CAP
        ? { capped: true as const, cap: PROFILE_LOAD_FETCH_HARD_CAP, total: totalAthletes }
        : null,
  };
  });
}

export async function listDailyTrainingLoadReports() {
  return withServerActionGuard("trainingReport.listDailyTrainingLoadReports", async (ctx) => {
  const resolved = await resolveManagementActor();
  if ("error" in resolved) {
    return {
      error: resolved.error,
      errorKind: resolved.errorKind ?? ("fetch_error" as ManagementErrorKind),
    };
  }

  const featureDenial = await ctx.assertOrganizationFeature(resolved.organizationId);
  if (featureDenial) {
    return { error: featureDenial.error, errorKind: featureDenial.errorKind };
  }

  const permissions =
    resolved.role === "coach"
      ? await getCoachPermissions(resolved.actorId, resolved.organizationId)
      : DEFAULT_COACH_PERMISSIONS;
  if (resolved.role === "coach" && !permissions.can_view_reports) {
    return {
      error: "Rapor goruntuleme yetkiniz yok." as const,
      errorKind: "permission_denied" as const,
    };
  }

  const adminClient = createSupabaseAdminClient();
  const orgTimeZone = await resolveOrganizationTimeZone(resolved.organizationId);
  const todayKey = isoToZonedDateKey(new Date().toISOString(), orgTimeZone);
  const dayRange = istanbulDateWallRangeToHalfOpenUtc(todayKey, todayKey, orgTimeZone);
  if (!dayRange) {
    return {
      error: "Gunluk rapor tarihi hesaplanamadi." as const,
      errorKind: "fetch_error" as const,
    };
  }
  // FAZ 31: training_loads tablosunda organization_id kolonu yok; cross-org
  // satirlarin service-role ile bellege yuklenmemesi icin once org sporcu
  // profilleri cekilir, yuk sorgusu bu id'lerle sinirlanir.
  const { data: profileRows, error: profileError } = await adminClient
    .from("profiles")
    .select("id, full_name, position, number, organization_id")
    .eq("organization_id", resolved.organizationId);

  if (profileError) {
    return {
      error: `Sporcu profilleri alinamadi: ${profileError.message}`,
      errorKind: "fetch_error" as const,
    };
  }

  const orgProfileIds = (profileRows || []).map((p) => p.id);
  if (orgProfileIds.length === 0) return { reports: [] };

  const loadResult = await chunkedInQuery(
    orgProfileIds,
    async (chunk) =>
      await adminClient
        .from("training_loads")
        .select("id, profile_id, rpe_score, duration_minutes, total_load, measurement_date")
        .in("profile_id", chunk)
        .gte("measurement_date", dayRange.from)
        .lt("measurement_date", dayRange.toExclusive)
        .order("measurement_date", { ascending: false }),
    { scope: "listDailyTrainingLoadReports.training_loads" }
  );

  if (loadResult.error) {
    return {
      error: `Raporlar alinamadi: ${loadResult.error.message}`,
      errorKind: "fetch_error" as const,
    };
  }

  const orgRows = ((loadResult.data || []) as Array<{
    id: string;
    profile_id: string | null;
    rpe_score: number;
    duration_minutes: number;
    total_load: number;
    measurement_date: string;
  }>).sort((a, b) => b.measurement_date.localeCompare(a.measurement_date));

  const profileMap = new Map((profileRows || []).map((p) => [p.id, p]));
  const reports: DailyTrainingLoadReport[] = orgRows
    .map((row) => {
      const profile = row.profile_id ? profileMap.get(row.profile_id) : null;
      if (!profile) return null;
      return {
        id: row.id,
        rpe_score: row.rpe_score,
        duration_minutes: row.duration_minutes,
        total_load: row.total_load,
        measurement_date: row.measurement_date,
        profiles: {
          full_name: profile.full_name,
          position: profile.position,
          number: profile.number,
          organization_id: profile.organization_id,
        },
      };
    })
    .filter((row): row is DailyTrainingLoadReport => Boolean(row));

  return { reports };
  });
}
