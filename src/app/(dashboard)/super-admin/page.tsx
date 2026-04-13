import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { createServerSupabaseReadClient } from "@/lib/supabase/server-read";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { extractSessionRole } from "@/lib/auth/sessionClaims";
import { getSystemHealthReport } from "@/lib/diagnostics/systemHealth";
import {
  isMissingOrganizationLifecycleColumnError,
  ORG_ADMIN_SELECT_FULL,
} from "@/lib/organization/adminOrganizationQuery";
import {
  SUPER_ADMIN_LICENSE_SIGNAL_LABELS,
  superAdminLicenseSignal,
} from "@/lib/organization/license";
import type { SuperAdminOrganizationSummary } from "@/lib/types";
import type { SystemHealthReport } from "@/lib/types/diagnostics";
import { ORGANIZATION_STATUS_LABELS, parseOrganizationStatus, type OrganizationStatus } from "@/lib/organization/lifecycle";
import SuperAdminCreateOrgForm from "./SuperAdminCreateOrgForm";

function orgStatusChipClass(s: OrganizationStatus): string {
  switch (s) {
    case "active":
      return "text-emerald-300 border-emerald-500/25 bg-emerald-500/10";
    case "trial":
      return "text-sky-300 border-sky-500/25 bg-sky-500/10";
    case "suspended":
      return "text-amber-300 border-amber-500/25 bg-amber-500/10";
    case "archived":
      return "text-gray-400 border-white/10 bg-white/5";
    case "expired":
      return "text-red-300 border-red-500/25 bg-red-500/10";
    default:
      return "text-gray-300 border-white/10 bg-white/5";
  }
}

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfTodayIso() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

const emptyHealthReport: SystemHealthReport = {
  generatedAt: new Date().toISOString(),
  overallPassed: false,
  checks: [],
};

type MarkedRow = {
  marked_at: string;
  training_schedule: { organization_id?: string | null; start_time?: string | null }[] | { organization_id?: string | null; start_time?: string | null } | null;
};

export default async function SuperAdminPage() {
  const sessionClient = await createServerSupabaseReadClient();
  const { data: authData } = await sessionClient.auth.getUser();
  if (!authData.user) redirect("/login");

  let { data: profile } = await sessionClient.from("profiles").select("id, role").eq("id", authData.user.id).maybeSingle();
  const sessionRole = getSafeRole(extractSessionRole(authData.user));
  if (!profile) {
    try {
      const adminClient = createSupabaseAdminClient();
      const byId = await adminClient.from("profiles").select("id, role").eq("id", authData.user.id).maybeSingle();
      if (byId.data) profile = byId.data;
    } catch {
      // guard asagida claim ile de kontrol edilecek
    }
  }
  if (!profile?.role && sessionRole === "super_admin") {
    // Recovery: super admin auth claim var, profile kaydi eksikse tamamla.
    try {
      const adminClient = createSupabaseAdminClient();
      const { error } = await adminClient.from("profiles").upsert(
        {
          id: authData.user.id,
          email: authData.user.email ?? null,
          full_name: authData.user.email ?? "Super Admin",
          role: "super_admin",
          organization_id: null,
          is_active: true,
        },
        { onConflict: "id" }
      );
      if (!error) {
        const refresh = await sessionClient.from("profiles").select("id, role").eq("id", authData.user.id).maybeSingle();
        profile = refresh.data;
      }
    } catch {
      // sayfa guard'i aşağıda karar verir
    }
  }
  if (getSafeRole(profile?.role) !== "super_admin" && sessionRole !== "super_admin") redirect("/login");

  let health: SystemHealthReport = emptyHealthReport;
  try {
    health = await getSystemHealthReport();
  } catch {
    health = {
      ...emptyHealthReport,
      checks: [
        {
          key: "health_fetch",
          title: "Sistem saglik raporu",
          passed: false,
          details: "Rapor alinamadi (cache veya sunucu).",
          migration: "diagnostics",
        },
      ],
    };
  }

  let loadError: string | null = null;
  let organizations: Array<{
    id: string;
    name: string | null;
    created_at?: string | null;
    status?: string | null;
    starts_at?: string | null;
    ends_at?: string | null;
    updated_at?: string | null;
  }> = [];
  let profiles: Array<{ organization_id?: string | null; role?: string | null }> = [];
  let lessons: Array<{ organization_id?: string | null; start_time?: string | null; created_at?: string | null }> = [];
  let markedRows: MarkedRow[] = [];

  try {
    const adminClient = createSupabaseAdminClient();
    const fullOrgRes = await adminClient.from("organizations").select(ORG_ADMIN_SELECT_FULL).order("created_at", { ascending: false });
    if (fullOrgRes.error && isMissingOrganizationLifecycleColumnError(fullOrgRes.error.message)) {
      loadError =
        "Organizasyon lifecycle kolonlari eksik. Supabase migration (20260403_organization_lifecycle.sql) uygulayin; /sistem-saglik sayfasina bakin.";
    } else if (fullOrgRes.error) {
      loadError = fullOrgRes.error.message;
    } else {
      organizations = fullOrgRes.data || [];
    }

    const [profilesRes, lessonsRes, markedRes] = await Promise.all([
      adminClient.from("profiles").select("organization_id, role"),
      adminClient.from("training_schedule").select("organization_id, start_time, created_at"),
      adminClient
        .from("training_participants")
        .select("marked_at, training_schedule!inner(organization_id, start_time)")
        .not("marked_at", "is", null),
    ]);

    profiles = profilesRes.data || [];
    lessons = lessonsRes.data || [];

    if (markedRes.error) {
      markedRows = [];
    } else {
      markedRows = (markedRes.data || []) as MarkedRow[];
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Bilinmeyen hata";
    loadError = msg;
  }

  if (loadError) {
    return (
      <div className="space-y-4 rounded-[1.5rem] border border-amber-500/30 bg-amber-500/5 p-5 sm:p-8 pb-[max(2rem,env(safe-area-inset-bottom,0px))] min-w-0 overflow-x-hidden">
        <h1 className="text-lg sm:text-xl font-black italic uppercase text-white break-words">Super Admin Veri Yuklenemedi</h1>
        <p className="text-[11px] text-gray-400 font-bold break-words">
          Bu ekran service role ile tum organizasyonlari okur. Asagidaki mesaj genelde SUPABASE_SERVICE_ROLE_KEY eksik/yanlis, Supabase
          erisim hatasi veya sema uyumsuzlugunu gosterir.
        </p>
        <pre className="text-[10px] text-amber-200/90 whitespace-pre-wrap break-all rounded-xl border border-white/10 bg-black/30 p-3">{loadError}</pre>
        <Link href="/sistem-saglik" className="inline-flex min-h-11 items-center text-[10px] font-black uppercase text-[#c4b5fd] touch-manipulation">
          Sistem saglik sayfasina git
        </Link>
      </div>
    );
  }

  const roleCounts = new Map<string, { athletes: number; coaches: number }>();
  profiles.forEach((row) => {
    const orgId = row.organization_id || "";
    if (!orgId) return;
    if (!roleCounts.has(orgId)) roleCounts.set(orgId, { athletes: 0, coaches: 0 });
    const bucket = roleCounts.get(orgId)!;
    if (row.role === "sporcu") bucket.athletes += 1;
    if (row.role === "coach") bucket.coaches += 1;
  });

  const lessonStats = new Map<string, { total: number; today: number; lastActivityAt: string | null }>();
  const todayIso = startOfTodayIso();
  const todayEndIso = endOfTodayIso();
  lessons.forEach((row) => {
    const orgId = row.organization_id || "";
    if (!orgId) return;
    if (!lessonStats.has(orgId)) lessonStats.set(orgId, { total: 0, today: 0, lastActivityAt: null });
    const bucket = lessonStats.get(orgId)!;
    bucket.total += 1;
    if (row.start_time && row.start_time >= todayIso && row.start_time <= todayEndIso) bucket.today += 1;
    const candidate = row.start_time || row.created_at || null;
    if (candidate && (!bucket.lastActivityAt || candidate > bucket.lastActivityAt)) bucket.lastActivityAt = candidate;
  });

  const attendanceTodayByOrg = new Map<string, number>();
  markedRows.forEach((row) => {
    const schedule = Array.isArray(row.training_schedule) ? row.training_schedule[0] : row.training_schedule;
    const orgId = schedule?.organization_id || "";
    if (!orgId || !row.marked_at) return;
    if (row.marked_at >= todayIso) {
      attendanceTodayByOrg.set(orgId, (attendanceTodayByOrg.get(orgId) || 0) + 1);
    }
  });

  const orgSummaries: SuperAdminOrganizationSummary[] = organizations.map((org) => {
    const roleBucket = roleCounts.get(org.id) || { athletes: 0, coaches: 0 };
    const lessonBucket = lessonStats.get(org.id) || { total: 0, today: 0, lastActivityAt: null };
    const attendanceMarkedToday = attendanceTodayByOrg.get(org.id) || 0;
    const healthStatus: "healthy" | "warning" =
      lessonBucket.total > 0 && roleBucket.coaches > 0 && roleBucket.athletes > 0 ? "healthy" : "warning";
    const status = parseOrganizationStatus(org.status);
    const licenseSignal = superAdminLicenseSignal(status, org.starts_at ?? null, org.ends_at ?? null);
    return {
      organizationId: org.id,
      name: org.name || `ORG-${org.id.slice(0, 8).toUpperCase()}`,
      createdAt: org.created_at || null,
      status,
      startsAt: org.starts_at ?? null,
      endsAt: org.ends_at ?? null,
      updatedAt: org.updated_at ?? null,
      licenseSignal,
      athletes: roleBucket.athletes,
      coaches: roleBucket.coaches,
      totalLessons: lessonBucket.total,
      todayLessons: lessonBucket.today,
      attendanceMarkedToday,
      lastActivityAt: lessonBucket.lastActivityAt,
      health: healthStatus,
    };
  });

  const totalAthletes = orgSummaries.reduce((sum, org) => sum + org.athletes, 0);
  const totalCoaches = orgSummaries.reduce((sum, org) => sum + org.coaches, 0);
  const totalLessons = orgSummaries.reduce((sum, org) => sum + org.totalLessons, 0);
  const todayLessons = orgSummaries.reduce((sum, org) => sum + org.todayLessons, 0);
  const operationalOrgCount = orgSummaries.filter((org) => org.status === "active" || org.status === "trial").length;
  const activeOrganizations30d = orgSummaries.filter((org) => (org.lastActivityAt || "") >= daysAgoIso(30)).length;
  const criticalWarnings = orgSummaries.filter((org) => org.health === "warning").length + (health.overallPassed ? 0 : 1);
  const licenseAttentionCount = orgSummaries.filter(
    (org) =>
      org.licenseSignal.kind === "expired_by_date" ||
      org.licenseSignal.kind === "pending_start" ||
      org.licenseSignal.kind === "expiring_soon" ||
      org.licenseSignal.kind === "no_dates"
  ).length;
  const licenseAlertLines = orgSummaries
    .filter((org) => org.licenseSignal.kind !== "ok")
    .map((org) => {
      const base = SUPER_ADMIN_LICENSE_SIGNAL_LABELS[org.licenseSignal.kind];
      const extra =
        org.licenseSignal.kind === "expiring_soon" ? ` (${org.licenseSignal.daysLeft} gun)` : "";
      return `${org.name} • ${base}${extra}`;
    })
    .slice(0, 8);

  const mostActive = [...orgSummaries].sort((a, b) => b.totalLessons - a.totalLessons).slice(0, 5);
  const attendanceLeaders = [...orgSummaries].sort((a, b) => b.attendanceMarkedToday - a.attendanceMarkedToday).slice(0, 5);
  const newestOrgs = [...orgSummaries]
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, 5);

  return (
    <div className="space-y-5 sm:space-y-6 pb-[max(3rem,env(safe-area-inset-bottom,0px))] min-w-0 overflow-x-hidden">
      <header className="border-b border-white/5 pb-5 sm:pb-6 min-w-0">
        <h1 className="text-3xl sm:text-4xl font-black italic text-white uppercase tracking-tighter break-words leading-tight">
          SUPER ADMIN <span className="text-[#7c3aed]">CONTROL CENTER</span>
        </h1>
        <p className="text-gray-500 font-bold text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.25em] italic mt-2 sm:mt-3 break-words">
          Tüm organizasyonlar için üst seviye operasyon paneli
        </p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-9 gap-2 sm:gap-3 min-w-0">
        <KpiCard label="Toplam Org" value={orgSummaries.length} />
        <KpiCard label="Operasyonel Org" value={operationalOrgCount} />
        <KpiCard label="Toplam Sporcu" value={totalAthletes} />
        <KpiCard label="Toplam Koç" value={totalCoaches} />
        <KpiCard label="Toplam Ders" value={totalLessons} />
        <KpiCard label="30g Aktif Org" value={activeOrganizations30d} />
        <KpiCard label="Bugünkü Ders" value={todayLessons} />
        <KpiCard label="Kritik Uyarı" value={criticalWarnings} warning={criticalWarnings > 0} />
        <KpiCard label="Lisans dikkat" value={licenseAttentionCount} warning={licenseAttentionCount > 0} />
      </section>

      <section className="grid lg:grid-cols-12 gap-4 min-w-0">
        <div className="lg:col-span-8 bg-[#121215] border border-white/5 rounded-[1.5rem] p-4 sm:p-5 min-w-0 overflow-hidden">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4 min-w-0">
            <p className="text-white text-sm font-black italic uppercase">Organizasyonlar</p>
            <p className="text-[10px] text-gray-500 font-bold uppercase">{orgSummaries.length} kayit</p>
          </div>
          <div className="grid gap-3 min-w-0">
            {orgSummaries.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-white/10 rounded-xl">
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-wider italic">
                  Henuz organizasyon kaydi bulunmuyor.
                </p>
              </div>
            ) : (
              orgSummaries.map((org) => (
                <Link
                  key={org.organizationId}
                  href={`/super-admin/${org.organizationId}`}
                  className="block bg-black/20 border border-white/10 rounded-xl p-4 sm:hover:border-[#7c3aed]/30 transition-all min-w-0 touch-manipulation"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 min-w-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-black italic uppercase break-words">{org.name}</p>
                      <p className="text-[10px] text-gray-500 font-bold break-words">
                        Oluşturulma: {org.createdAt ? new Date(org.createdAt).toLocaleDateString("tr-TR") : "-"}
                      </p>
                      <p className="text-[10px] text-gray-500 font-bold mt-1 normal-case break-words">
                        Lisans:{" "}
                        {org.startsAt ? new Date(org.startsAt).toLocaleString("tr-TR") : (
                          <span className="text-amber-200/80">baslangic tanimli degil</span>
                        )}{" "}
                        →{" "}
                        {org.endsAt ? (
                          new Date(org.endsAt).toLocaleString("tr-TR")
                        ) : (
                          <span className="text-sky-200/80">bitis yok (sinirsiz)</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase flex-wrap min-w-0">
                      <span
                        className={`px-2 py-1 rounded-lg border ${orgStatusChipClass(org.status)}`}
                      >
                        {ORGANIZATION_STATUS_LABELS[org.status]}
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300">{org.athletes} sporcu</span>
                      <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300">{org.coaches} koc</span>
                      <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300">{org.todayLessons} bugun</span>
                      <span
                        className={`px-2 py-1 rounded-lg border ${org.health === "healthy" ? "text-green-400 border-green-500/20 bg-green-500/10" : "text-amber-300 border-amber-500/20 bg-amber-500/10"}`}
                      >
                        {org.health === "healthy" ? "SAGLIKLI" : "UYARI"}
                      </span>
                      {org.licenseSignal.kind !== "ok" ? (
                        <span
                          className={`px-2 py-1 rounded-lg border max-w-full sm:max-w-[220px] break-words text-left ${
                            org.licenseSignal.kind === "expired_by_date" || org.licenseSignal.kind === "pending_start"
                              ? "text-red-200 border-red-500/25 bg-red-500/10"
                              : org.licenseSignal.kind === "expiring_soon"
                                ? "text-amber-200 border-amber-500/25 bg-amber-500/10"
                                : "text-sky-200 border-sky-500/25 bg-sky-500/10"
                          }`}
                          title={
                            SUPER_ADMIN_LICENSE_SIGNAL_LABELS[org.licenseSignal.kind] +
                            (org.licenseSignal.kind === "expiring_soon" ? ` (${org.licenseSignal.daysLeft} gun)` : "")
                          }
                        >
                          {SUPER_ADMIN_LICENSE_SIGNAL_LABELS[org.licenseSignal.kind]}
                          {org.licenseSignal.kind === "expiring_soon" ? ` ${org.licenseSignal.daysLeft}g` : ""}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4 min-w-0">
          <SuperAdminCreateOrgForm />
          <section className="bg-[#121215] border border-white/5 rounded-[1.5rem] p-4 sm:p-5 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 min-w-0">
              <p className="text-white text-sm font-black italic uppercase">Sistem Sagligi</p>
              <Link href="/sistem-saglik" className="min-h-9 inline-flex items-center text-[#c4b5fd] text-[10px] font-black uppercase touch-manipulation shrink-0">
                Detay
              </Link>
            </div>
            <p className={`text-[10px] font-black uppercase ${health.overallPassed ? "text-green-400" : "text-red-400"}`}>
              {health.overallPassed ? "KRITIK SCHEMA HAZIR" : "KRITIK SORUN VAR"}
            </p>
          </section>
        </div>
      </section>

      <section className="grid lg:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 min-w-0">
        <ListBlock title="En Aktif Organizasyonlar" items={mostActive.map((o) => `${o.name} • ${o.totalLessons} ders`)} />
        <ListBlock title="Attendance Liderleri (Bugun)" items={attendanceLeaders.map((o) => `${o.name} • ${o.attendanceMarkedToday} isaretleme`)} />
        <ListBlock title="Yeni Organizasyonlar" items={newestOrgs.map((o) => `${o.name} • ${o.createdAt ? new Date(o.createdAt).toLocaleDateString("tr-TR") : "-"}`)} />
        <ListBlock title="Lisans / tarih dikkat" items={licenseAlertLines.length ? licenseAlertLines : ["Tum orglar lisans sinyalinde OK veya statü askida/arşiv"]} />
      </section>
    </div>
  );
}

function KpiCard({ label, value, warning }: { label: string; value: string | number; warning?: boolean }) {
  return (
    <div className="bg-[#121215] border border-white/5 rounded-xl p-2.5 sm:p-3 min-w-0">
      <p className="text-[8px] sm:text-[9px] text-gray-500 font-black uppercase leading-tight break-words">{label}</p>
      <p className={`text-xl sm:text-2xl font-black italic tabular-nums break-all ${warning ? "text-amber-300" : "text-white"}`}>{value}</p>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-[#121215] border border-white/5 rounded-[1.5rem] p-4 sm:p-5 min-w-0">
      <p className="text-white text-sm font-black italic uppercase mb-3 break-words">{title}</p>
      {items.length === 0 ? (
        <p className="text-[10px] text-gray-500 font-bold uppercase">Veri yok</p>
      ) : (
        <div className="grid gap-2 min-w-0">
          {items.map((item) => (
            <p key={item} className="text-[10px] text-gray-300 font-bold bg-black/20 border border-white/10 rounded-lg px-3 py-2 break-words">
              {item}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
