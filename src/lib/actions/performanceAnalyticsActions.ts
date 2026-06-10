"use server";


import { withServerActionGuard } from "@/lib/observability/serverActionError";
import { createSupabaseAdminClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { getCoachPermissions, hasCoachPermission } from "@/lib/auth/coachPermissions";
import { DEFAULT_COACH_PERMISSIONS } from "@/lib/types";
import { messageIfCoachCannotOperate, profileRowIsActive } from "@/lib/coach/lifecycle";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { toDisplayName } from "@/lib/profile/displayName";
import { isUuid } from "@/lib/validation/uuid";
import type { TrainingLoadRow } from "@/types/performance";
import { aggregateTrainingLoadsByCalendarDay } from "@/lib/performance/loadSeries";
import {
  planProfileLoadFetch,
  PROFILE_LOAD_FETCH_HARD_CAP,
  trainingLoadsSelectClause,
} from "@/lib/performance/aggregationHelpers";
import { chunkedInQuery } from "@/lib/db/chunkedIn";
import {
  addCalendarDaysToYyyyMmDd,
  isYyyyMmDd,
  istanbulLastNDaysInclusive,
  istanbulLoadFetchRangeForPerformance,
  istanbulTodayKey,
} from "@/lib/performance/performanceDateRange";
import { resolveOrganizationTimeZone } from "@/lib/organization/timeZone";
import {
  computeRiskStats,
  fillCalendarDays,
  filterTrainingLoadsByIstanbulInclusiveRange,
  processACWRData,
  processEWMAData,
} from "@/lib/performance/loadSeries";
import type { TrainingLoadRow as TrainingLoadRowType, WellnessReportRow } from "@/types/performance";
import { csvFilename } from "@/lib/export/csv";
import { buildCsvFromRows } from "@/lib/export/csvStream";
import { createJobContext, runJob } from "@/lib/jobs";
import { checkExportRateLimit } from "@/lib/rateLimit";
import {
  shouldUseDailyTrainingLoadMv,
  fetchDailyTrainingLoadMvRows,
} from "@/lib/performance/dailyTrainingLoadMv";
import { logger } from "@/lib/monitoring/logger";

function assertUuid(id: string | null | undefined): id is string {
  return isUuid(id);
}

export type PerformanceAnalyticsDateRange = {
  dateFrom: string;
  dateTo: string;
};

/**
 * Hata sınıflandırması:
 * - "permission_denied"  → kullanıcı oturumu var ama bu veriyi görme yetkisi yok
 * - "invalid_input"      → uuid/argüman hatası
 * - "auth_required"      → oturum yok / süresi dolmuş
 * - "fetch_error"        → DB / runtime hatası
 *
 * `error` (insan-okur Türkçe metin) geriye uyumluluk için aynen kalır;
 * `errorKind` opsiyonel ve eski tüketicileri kırmaz. UI bu alana göre
 * "Yetkiniz yok" / "Veri yok" ayrımını yapar.
 */
export type PerformanceAnalyticsErrorKind =
  | "permission_denied"
  | "invalid_input"
  | "auth_required"
  | "fetch_error";

export async function listPerformanceAnalyticsData(
  organizationId: string,
  athleteProfileId: string | null,
  dateRange?: PerformanceAnalyticsDateRange | null
) {
  return withServerActionGuard("performance.listPerformanceAnalyticsData", async () => {
  if (!assertUuid(organizationId)) {
    return { error: "Gecersiz organizasyon kimligi." as const, errorKind: "invalid_input" as const };
  }
  if (athleteProfileId !== null && !assertUuid(athleteProfileId)) {
    return { error: "Gecersiz sporcu kimligi." as const, errorKind: "invalid_input" as const };
  }

  const sessionClient = await createServerSupabaseClient();
  const { data: authData, error: authError } = await sessionClient.auth.getUser();
  if (authError || !authData.user) {
    return { error: "Gecersiz oturum." as const, errorKind: "auth_required" as const };
  }

  const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
  if ("error" in resolved) {
    return { error: resolved.error, errorKind: "auth_required" as const };
  }
  const actor = resolved.actor;

  if (!actor.organizationId || actor.organizationId !== organizationId) {
    return {
      error: "Bu organizasyonun performans verisine erisiminiz yok." as const,
      errorKind: "permission_denied" as const,
    };
  }

  const actorRole = actor.role;
  if (actorRole !== "admin" && actorRole !== "coach") {
    return {
      error: "Bu sayfa yalnizca yonetici veya koç icindir." as const,
      errorKind: "permission_denied" as const,
    };
  }
  if (actorRole === "coach") {
    const coachBlock = messageIfCoachCannotOperate(actor.role, actor.isActive);
    if (coachBlock) return { error: coachBlock, errorKind: "permission_denied" as const };
  }

  const permissions =
    actorRole === "coach"
      ? await getCoachPermissions(actor.id, organizationId)
      : DEFAULT_COACH_PERMISSIONS;

  if (actorRole === "coach" && !hasCoachPermission(permissions, "can_view_reports")) {
    return {
      error: "Performans raporlarini goruntuleme yetkiniz yok." as const,
      errorKind: "permission_denied" as const,
    };
  }

  const orgTimeZone = await resolveOrganizationTimeZone(organizationId);

  const canViewAllAthletes = actorRole !== "coach" || permissions.can_view_all_athletes;
  if (actorRole === "coach" && !canViewAllAthletes) {
    if (athleteProfileId !== null) {
      return {
        error: "Tum sporculari goruntuleme yetkiniz yok." as const,
        errorKind: "permission_denied" as const,
      };
    }
    const d = istanbulLastNDaysInclusive(28, orgTimeZone);
    return {
      loads: [] as Record<string, unknown>[],
      reports: [] as Record<string, unknown>[],
      appliedRange: { dateFrom: d.from, dateTo: d.to },
      timeZone: orgTimeZone,
    };
  }

  if (athleteProfileId) {
    const adminClient = createSupabaseAdminClient();
    const { data: athleteRow } = await adminClient
      .from("profiles")
      .select("id, role, organization_id, is_active")
      .eq("id", athleteProfileId)
      .maybeSingle();
    if (!athleteRow || getSafeRole(athleteRow.role) !== "sporcu" || athleteRow.organization_id !== organizationId) {
      return {
        error: "Sporcu bulunamadi veya bu organizasyona ait degil." as const,
        errorKind: "permission_denied" as const,
      };
    }
    if (!profileRowIsActive(athleteRow.is_active)) {
      return {
        error: "Pasif sporcu icin performans verisi gosterilmez." as const,
        errorKind: "permission_denied" as const,
      };
    }
  }

  const adminClient = createSupabaseAdminClient();

  const todayKey = istanbulTodayKey(orgTimeZone);
  const rawTo = dateRange?.dateTo?.trim() ?? "";
  const rawFrom = dateRange?.dateFrom?.trim() ?? "";
  const dateTo = isYyyyMmDd(rawTo) ? rawTo : todayKey;
  const dateFrom = isYyyyMmDd(rawFrom) ? rawFrom : addCalendarDaysToYyyyMmDd(dateTo, -27);
  if (dateFrom > dateTo) {
    return {
      error: "Baslangic tarihi bitis tarihinden sonra olamaz." as const,
      errorKind: "invalid_input" as const,
    };
  }

  const loadUtcRange = istanbulLoadFetchRangeForPerformance(dateFrom, dateTo, orgTimeZone);
  if (!loadUtcRange) {
    return {
      error: "Antrenman yuku tarih araligi hesaplanamadi." as const,
      errorKind: "invalid_input" as const,
    };
  }

  let profileIdsForLoads: string[] = [];
  if (athleteProfileId) {
    profileIdsForLoads = [athleteProfileId];
  } else {
    const { data: orgAthletes } = await adminClient
      .from("profiles")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("role", "sporcu");
    profileIdsForLoads = (orgAthletes || []).map((r) => r.id);
  }

  // Faz 8.1 — büyük org cap + narrow select.
  // Tek sporcu görünümünde profil join'i display name için gerekli; takım
  // görünümünde aggregateTrainingLoadsByCalendarDay sonrası profiles
  // alanı null'a düşürüldüğü için join cost'u boşa harcanmaz.
  const profileIdsTotalCount = new Set(profileIdsForLoads.filter(Boolean)).size;
  const fetchPlan = planProfileLoadFetch(profileIdsForLoads, {
    mode: athleteProfileId ? "single" : "team",
    scope: "listPerformanceAnalyticsData",
  });
  profileIdsForLoads = fetchPlan.profileIds;

  let loads: Record<string, unknown>[] = [];
  let mvFreshness: { source: "mv" | "live"; refreshedAt: string | null; reason: string } | null = null;

  // Faz 12.2 — MV read-path (takım modu, opt-in, conditional).
  // Eligibility kontrolü: feature flag + team mode + min profil + min gün sayısı.
  // MV'den okuma başarısız/stale/empty olursa live chunked .in() fallback'i
  // doğal akışta devam eder (loads boş kalır → aşağıdaki "if (loads.length === 0)"
  // bloğuna düşmez, çünkü mevcut blok "profileIdsForLoads.length > 0" koşulu).
  // Bu yüzden MV başarısız olursa flag set ederek live'a yönlendiriyoruz.
  let useLivePath = true;
  if (!athleteProfileId && profileIdsForLoads.length > 0) {
    const dayCount =
      Math.floor(
        (new Date(`${dateTo}T00:00:00.000Z`).getTime() -
          new Date(`${dateFrom}T00:00:00.000Z`).getTime()) /
          (24 * 60 * 60 * 1000)
      ) + 1;
    const eligibility = shouldUseDailyTrainingLoadMv({
      athleteProfileId,
      profileCount: profileIdsForLoads.length,
      dayCount: Math.max(0, dayCount),
    });
    if (eligibility.eligible) {
      const mvResult = await fetchDailyTrainingLoadMvRows(adminClient, {
        organizationId,
        fromKey: dateFrom,
        toKey: dateTo,
      });
      if (mvResult.status === "ok") {
        loads = mvResult.rows.map((row) => ({ ...row, profiles: null })) as unknown as Record<
          string,
          unknown
        >[];
        useLivePath = false;
        mvFreshness = {
          source: "mv",
          refreshedAt: mvResult.refreshedAt,
          reason: "ok",
        };
        logger.info("performance.mv.read", "team aggregate served from MV", {
          organizationId,
          profileCount: profileIdsForLoads.length,
          dayCount,
          mvRowCount: mvResult.mvRowCount,
          refreshedAt: mvResult.refreshedAt,
        });
      } else {
        mvFreshness = {
          source: "live",
          refreshedAt: mvResult.status === "stale" ? mvResult.refreshedAt : null,
          reason:
            mvResult.status === "stale"
              ? "stale"
              : mvResult.status === "empty"
                ? "empty"
                : "error",
        };
        logger.info("performance.mv.read", "MV not used, falling back to live", {
          organizationId,
          profileCount: profileIdsForLoads.length,
          dayCount,
          mvStatus: mvResult.status,
        });
      }
    } else {
      mvFreshness = {
        source: "live",
        refreshedAt: null,
        reason: eligibility.reason,
      };
    }
  }

  if (useLivePath && profileIdsForLoads.length > 0) {
    // Faz 9.2 — chunked .in() for 1000+ athletes. Server-side sıralama
    // her chunk için yapılır; aggregateTrainingLoadsByCalendarDay ardından
    // çağrılacağı için global order tekrar gerekli değil ama defensive olarak
    // birleştirme sonrası `measurement_date` ASC sort uygulanır.
    const chunkedResult = await chunkedInQuery(
      profileIdsForLoads,
      async (chunk) =>
        await adminClient
          .from("training_loads")
          .select(trainingLoadsSelectClause(fetchPlan.needsProfileJoin))
          .in("profile_id", chunk)
          .gte("measurement_date", loadUtcRange.from)
          .lt("measurement_date", loadUtcRange.toExclusive)
          .order("measurement_date", { ascending: true }),
      { scope: "listPerformanceAnalyticsData.training_loads" }
    );
    if (chunkedResult.error) {
      return {
        error: `Antrenman yuku verisi alinamadi: ${chunkedResult.error.message}` as const,
        errorKind: "fetch_error" as const,
      };
    }
    const loadRows = chunkedResult.data;
    // Chunk birleştirmesi sonrası global sort (parity).
    if (loadRows.length > 1 && profileIdsForLoads.length > 1) {
      loadRows.sort((a, b) => {
        const ad = (a as { measurement_date?: string }).measurement_date ?? "";
        const bd = (b as { measurement_date?: string }).measurement_date ?? "";
        return ad.localeCompare(bd);
      });
    }
    loads = ((loadRows as unknown as Record<string, unknown>[]) || []).map((row) => {
      const profile = (row as { profiles?: { full_name?: string | null; email?: string | null } }).profiles;
      return {
        ...row,
        profiles: profile
          ? {
              ...profile,
              full_name: toDisplayName(profile.full_name, profile.email, "Sporcu"),
            }
          : null,
      };
    });
  }

  // Faz 12.2 — MV path zaten team-day shape döndürür (reduceMvRowsToTeamDayRows);
  // tekrar aggregate etmek matematiği bozar. Sadece live path için aggregate.
  if (useLivePath && profileIdsForLoads.length > 1 && loads.length > 0) {
    const aggregated = aggregateTrainingLoadsByCalendarDay(loads as unknown as TrainingLoadRow[]);
    loads = aggregated.map((row) => ({
      ...row,
      profiles: null,
    })) as Record<string, unknown>[];
  }

  let wellnessQuery = adminClient
    .from("wellness_reports")
    .select(
      "id, profile_id, report_date, resting_heart_rate, fatigue, sleep_quality, muscle_soreness, stress_level, energy_level, notes, profiles(full_name, email, id, organization_id)"
    )
    .eq("profiles.organization_id", organizationId)
    .gte("report_date", dateFrom)
    .lte("report_date", dateTo)
    .order("report_date", { ascending: false })
    .limit(200);

  if (athleteProfileId) {
    wellnessQuery = wellnessQuery.eq("profile_id", athleteProfileId);
  }

  const { data: reports, error: wellnessError } = await wellnessQuery;
  if (wellnessError) {
    return {
      error: `Wellness verisi alinamadi: ${wellnessError.message}` as const,
      errorKind: "fetch_error" as const,
    };
  }

  return {
    loads,
    appliedRange: { dateFrom, dateTo },
    timeZone: orgTimeZone,
    mvFreshness,
    // FAZ 32: hard cap kesintisi artik sessiz degil — UI gorunur uyari basar.
    athleteCap: fetchPlan.cappedAtHard
      ? { capped: true as const, cap: PROFILE_LOAD_FETCH_HARD_CAP, total: profileIdsTotalCount }
      : null,
    reports: (reports || []).map((row) => {
      const profile = (row as { profiles?: { full_name?: string | null; email?: string | null } }).profiles;
      return {
        ...row,
        profiles: profile
          ? {
              ...profile,
              full_name: toDisplayName(profile.full_name, profile.email, "Sporcu"),
            }
          : null,
      };
    }),
  };
  });
}

/**
 * Faz 5.4 — Performans Merkezi summary CSV export.
 *
 * Org içindeki aktif sporcular için tek satır per sporcu özet:
 *   ad, ölçüm sayısı, ACWR (son), EWMA (son), risk gün, sweet spot gün,
 *   ort. RPE, monotony, strain, readiness, wellness rapor sayısı, dönem.
 *
 * Performans:
 *   - Tek query ile tüm aktif sporcular alınır.
 *   - Tek query ile tüm `training_loads` (profile_id IN list, tarih aralığı) çekilir.
 *   - Tek query ile tüm `wellness_reports` çekilir.
 *   - Her sporcu için yardımcı fonksiyonlarla (loadSeries) hesap yapılır → N+1 yok.
 *
 * Cap: 200 sporcu (öngörülemeyen büyük org'larda CSV'yi koruma altında tutar).
 *
 * Saha testi trendi bu sürümde dahil değildir; hesabı pahalı olduğu için
 * Faz 6 backlog'unda. Şimdilik Performans Merkezi'nin saha test sinyali
 * UI'da görüntüleniyor (athleticFieldActions.summarizeFieldTestSignalsForAthlete).
 */
const PERFORMANCE_SUMMARY_HARD_CAP = 200;

export async function exportPerformanceSummaryCSV(
  organizationId: string,
  dateRange?: PerformanceAnalyticsDateRange | null
) {
  return withServerActionGuard("performance.exportPerformanceSummaryCSV", async () => {
  if (!assertUuid(organizationId)) {
    return { error: "Geçersiz organizasyon kimliği.", errorKind: "invalid_input" as PerformanceAnalyticsErrorKind };
  }

  const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
  if ("error" in resolved) {
    return { error: resolved.error, errorKind: "auth_required" as PerformanceAnalyticsErrorKind };
  }
  const actor = resolved.actor;
  if (!actor.organizationId || actor.organizationId !== organizationId) {
    return {
      error: "Bu organizasyonun performans verisine erişiminiz yok.",
      errorKind: "permission_denied" as PerformanceAnalyticsErrorKind,
    };
  }
  const actorRole = actor.role;
  if (actorRole !== "admin" && actorRole !== "coach") {
    return {
      error: "Performans özet dışa aktarımı yalnızca yönetici veya koç içindir.",
      errorKind: "permission_denied" as PerformanceAnalyticsErrorKind,
    };
  }
  if (actorRole === "coach") {
    const coachBlock = messageIfCoachCannotOperate(actor.role, actor.isActive);
    if (coachBlock) return { error: coachBlock, errorKind: "permission_denied" as PerformanceAnalyticsErrorKind };
    const permissions = await getCoachPermissions(actor.id, organizationId);
    if (!hasCoachPermission(permissions, "can_view_reports") || !permissions.can_view_all_athletes) {
      return {
        error: "Tüm sporcular için performans dışa aktarımı yapma yetkiniz yok.",
        errorKind: "permission_denied" as PerformanceAnalyticsErrorKind,
      };
    }
  }

  // Faz 11.7 — Rate limit.
  const rateLimitDecision = checkExportRateLimit({
    userId: actor.id,
    organizationId,
    exportKind: "performance",
  });
  if (!rateLimitDecision.allowed) {
    return {
      error: `Performans dışa aktarımı için çok fazla istek yapıldı. Lütfen ${Math.ceil(rateLimitDecision.retryAfterMs / 1000)} saniye sonra tekrar deneyin.`,
      errorKind: "fetch_error" as PerformanceAnalyticsErrorKind,
    };
  }

  const orgTimeZone = await resolveOrganizationTimeZone(organizationId);
  const todayKey = istanbulTodayKey(orgTimeZone);
  const rawTo = dateRange?.dateTo?.trim() ?? "";
  const rawFrom = dateRange?.dateFrom?.trim() ?? "";
  const dateTo = isYyyyMmDd(rawTo) ? rawTo : todayKey;
  const dateFrom = isYyyyMmDd(rawFrom) ? rawFrom : addCalendarDaysToYyyyMmDd(dateTo, -27);
  if (dateFrom > dateTo) {
    return { error: "Başlangıç tarihi bitiş tarihinden sonra olamaz.", errorKind: "invalid_input" as PerformanceAnalyticsErrorKind };
  }
  const loadUtcRange = istanbulLoadFetchRangeForPerformance(dateFrom, dateTo, orgTimeZone);
  if (!loadUtcRange) {
    return { error: "Antrenman yükü tarih aralığı hesaplanamadı.", errorKind: "invalid_input" as PerformanceAnalyticsErrorKind };
  }

  const adminClient = createSupabaseAdminClient();

  const { data: athleteRows, error: athleteErr } = await adminClient
    .from("profiles")
    .select("id, full_name, email")
    .eq("organization_id", organizationId)
    .eq("role", "sporcu")
    .eq("is_active", true)
    .order("full_name", { ascending: true })
    .limit(PERFORMANCE_SUMMARY_HARD_CAP);
  if (athleteErr) {
    return { error: `Sporcu listesi alınamadı: ${athleteErr.message}`, errorKind: "fetch_error" as PerformanceAnalyticsErrorKind };
  }
  const athletes = (athleteRows || []).map((row) => ({
    id: row.id,
    full_name: toDisplayName(row.full_name, row.email, "Sporcu"),
  }));

  if (athletes.length === 0) {
    const { csv } = buildCsvFromRows(
      [
        "Sporcu",
        "Yük Kayıt Sayısı",
        "ACWR (son)",
        "EWMA (son)",
        "Kritik Gün (>1.5)",
        "Sweet Spot Gün (0.8–1.3)",
        "EWMA Riskli Gün (>1.5)",
        "Ortalama RPE",
        "Monotony",
        "Strain (AU)",
        "Readiness",
        "Readiness Kayıt",
        "Wellness Rapor",
        "Dönem Başı",
        "Dönem Sonu",
      ],
      []
    );
    return {
      csv,
      filename: csvFilename("performans", "ozet", { from: dateFrom, to: dateTo }),
      rowCount: 0,
      truncated: false,
      cap: PERFORMANCE_SUMMARY_HARD_CAP,
    };
  }

  const profileIds = athletes.map((a) => a.id);
  // Faz 9.2 — chunked .in() to keep PostgREST URL payload safe at 1000+ ids.
  const loadChunked = await chunkedInQuery(
    profileIds,
    async (chunk) =>
      await adminClient
        .from("training_loads")
        .select("profile_id, total_load, rpe_score, measurement_date")
        .in("profile_id", chunk)
        .gte("measurement_date", loadUtcRange.from)
        .lt("measurement_date", loadUtcRange.toExclusive)
        .order("measurement_date", { ascending: true }),
    { scope: "exportPerformanceSummaryCSV.training_loads" }
  );
  if (loadChunked.error) {
    return {
      error: `Antrenman yükü alınamadı: ${loadChunked.error.message}`,
      errorKind: "fetch_error" as PerformanceAnalyticsErrorKind,
    };
  }
  const loadRows = loadChunked.data;

  const reportChunked = await chunkedInQuery(
    profileIds,
    async (chunk) =>
      await adminClient
        .from("wellness_reports")
        .select(
          "id, profile_id, report_date, resting_heart_rate, fatigue, sleep_quality, muscle_soreness, stress_level, energy_level, notes"
        )
        .in("profile_id", chunk)
        .gte("report_date", dateFrom)
        .lte("report_date", dateTo)
        .order("report_date", { ascending: false }),
    { scope: "exportPerformanceSummaryCSV.wellness_reports" }
  );
  if (reportChunked.error) {
    return {
      error: `Wellness raporları alınamadı: ${reportChunked.error.message}`,
      errorKind: "fetch_error" as PerformanceAnalyticsErrorKind,
    };
  }
  const reportRows = reportChunked.data;

  const loadsByProfile = new Map<string, TrainingLoadRowType[]>();
  for (const row of (loadRows || []) as TrainingLoadRowType[]) {
    const pid = (row as { profile_id?: string }).profile_id;
    if (!pid) continue;
    const arr = loadsByProfile.get(pid) || [];
    arr.push(row);
    loadsByProfile.set(pid, arr);
  }
  const reportsByProfile = new Map<string, WellnessReportRow[]>();
  for (const row of (reportRows || []) as WellnessReportRow[]) {
    const pid = (row as { profile_id?: string }).profile_id;
    if (!pid) continue;
    const arr = reportsByProfile.get(pid) || [];
    arr.push(row);
    reportsByProfile.set(pid, arr);
  }

  const headers = [
    "Sporcu",
    "Yük Kayıt Sayısı",
    "ACWR (son)",
    "EWMA (son)",
    "Kritik Gün (>1.5)",
    "Sweet Spot Gün (0.8–1.3)",
    "EWMA Riskli Gün (>1.5)",
    "Ortalama RPE",
    "Monotony",
    "Strain (AU)",
    "Readiness",
    "Readiness Kayıt",
    "Wellness Rapor",
    "Dönem Başı",
    "Dönem Sonu",
  ];

  const rows: ReadonlyArray<unknown>[] = athletes.map((athlete) => {
    const rawLoads = loadsByProfile.get(athlete.id) || [];
    const filteredLoads = filterTrainingLoadsByIstanbulInclusiveRange(rawLoads, dateFrom, dateTo, orgTimeZone);
    const filledLoads = filteredLoads.length > 0 ? fillCalendarDays(filteredLoads, dateFrom, dateTo) : [];
    const acwrPoints = filledLoads.length ? processACWRData(filledLoads) : [];
    const ewmaPoints = filledLoads.length ? processEWMAData(filledLoads) : [];
    const reports = reportsByProfile.get(athlete.id) || [];
    const stats = computeRiskStats(acwrPoints, ewmaPoints, filledLoads, reports);
    const lastAcwr = acwrPoints.length ? acwrPoints[acwrPoints.length - 1].ratio : null;
    const lastEwma = ewmaPoints.length ? ewmaPoints[ewmaPoints.length - 1].ewmaRatio : null;
    return [
      athlete.full_name,
      filteredLoads.length,
      lastAcwr != null && Number.isFinite(lastAcwr) ? Number(lastAcwr.toFixed(2)) : "",
      lastEwma != null && Number.isFinite(lastEwma) ? Number(lastEwma.toFixed(2)) : "",
      stats.critical,
      stats.sweetSpot,
      stats.ewmaRisk,
      stats.avgRpe ?? "",
      stats.monotony ?? "",
      stats.strain ?? "",
      stats.readinessReportCount > 0 ? stats.readiness : "",
      stats.readinessReportCount,
      reports.length,
      dateFrom,
      dateTo,
    ];
  });

  // Faz 9.4 — `runJob` ile sarmak: kullanıcı çıktısı aynı, telemetry standart
  // (job kind, duration, row count, truncation). İleride gerçek queue'ya
  // taşımak için signature hazır.
  const jobCtx = createJobContext({
    kind: "export.performance",
    initiator: { kind: "user", id: actor.id, role: actorRole },
    organizationId,
    attributes: { dateFrom, dateTo, athleteCount: athletes.length },
  });
  const jobResult = await runJob<{
    csv: string;
    filename: string;
    rowCount: number;
    truncated: boolean;
    cap: number;
  }>(jobCtx, async () => {
    const built = buildCsvFromRows(headers, rows, { maxRows: PERFORMANCE_SUMMARY_HARD_CAP });
    const filename = csvFilename("performans", "ozet", { from: dateFrom, to: dateTo });
    const truncated = built.truncated || athletes.length >= PERFORMANCE_SUMMARY_HARD_CAP;
    return {
      data: {
        csv: built.csv,
        filename,
        rowCount: built.rowCount,
        truncated,
        cap: PERFORMANCE_SUMMARY_HARD_CAP,
      },
      rowCount: built.rowCount,
      truncated,
      cap: PERFORMANCE_SUMMARY_HARD_CAP,
    };
  });
  if (jobResult.status === "failed" || !jobResult.data) {
    return {
      error: jobResult.error || "Performans özeti dışa aktarımı başarısız oldu.",
      errorKind: "fetch_error" as PerformanceAnalyticsErrorKind,
    };
  }
  return jobResult.data;
  });
}
