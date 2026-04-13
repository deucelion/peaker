import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { createServerSupabaseReadClient } from "@/lib/supabase/server-read";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { extractSessionRole } from "@/lib/auth/sessionClaims";
import { asSingleDynamicParam } from "@/lib/navigation/dynamicParams";
import { fetchOrganizationByIdAdmin } from "@/lib/organization/adminOrganizationQuery";
import { ORGANIZATION_STATUS_LABELS, parseOrganizationStatus } from "@/lib/organization/lifecycle";
import SuperAdminAddCoachForm from "../SuperAdminAddCoachForm";
import SuperAdminLicensePanel from "../SuperAdminLicensePanel";
import SuperAdminOrgLifecyclePanel from "../SuperAdminOrgLifecyclePanel";
import { isUuid } from "@/lib/validation/uuid";

interface PageProps {
  params: Promise<{ organizationId: string | string[] | undefined }>;
}

export default async function SuperAdminOrganizationDetailPage({ params }: PageProps) {
  const raw = await params;
  const organizationId = asSingleDynamicParam(raw.organizationId);
  if (!organizationId || !isUuid(organizationId)) {
    notFound();
  }

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
      // ignore: claim fallback asagida denenir
    }
  }
  if (!profile?.role && sessionRole === "super_admin") {
    try {
      const adminBootstrap = createSupabaseAdminClient();
      const { error } = await adminBootstrap.from("profiles").upsert(
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
        const refreshed = await sessionClient.from("profiles").select("id, role").eq("id", authData.user.id).maybeSingle();
        profile = refreshed.data;
      }
    } catch {
      // ignore
    }
  }
  if (getSafeRole(profile?.role) !== "super_admin" && sessionRole !== "super_admin") redirect("/login");

  const adminClient = createSupabaseAdminClient();
  const orgFetch = await fetchOrganizationByIdAdmin(adminClient, organizationId);
  if (orgFetch.error) {
    console.error("[super-admin/org] organizations query:", orgFetch.error.message);
    throw orgFetch.error;
  }
  if (!orgFetch.data) notFound();
  const org = orgFetch.data;

  const [profilesRes, lessonsRes, programsRes] = await Promise.all([
    adminClient
      .from("profiles")
      .select("id, role, full_name, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    adminClient
      .from("training_schedule")
      .select("id, title, start_time, location, created_at, status")
      .eq("organization_id", organizationId)
      .order("start_time", { ascending: false })
      .limit(12),
    adminClient
      .from("athlete_programs")
      .select("id, title, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);
  const orgStatus = parseOrganizationStatus(org.status);
  const profiles = profilesRes.data || [];
  const lessons = lessonsRes.data || [];
  const programs = programsRes.data || [];

  const athletes = profiles.filter((p) => p.role === "sporcu").length;
  const coaches = profiles.filter((p) => p.role === "coach").length;
  const admins = profiles.filter((p) => p.role === "admin").length;
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date();
  dayEnd.setHours(23, 59, 59, 999);
  const todayIso = dayStart.toISOString();
  const todayEndIso = dayEnd.toISOString();
  const todayLessons = lessons.filter((l) => l.start_time && l.start_time >= todayIso && l.start_time <= todayEndIso).length;
  const activeStatusCount = lessons.filter((l) => l.status !== "cancelled").length;

  return (
    <div className="space-y-5 sm:space-y-6 pb-[max(3rem,env(safe-area-inset-bottom,0px))] min-w-0 overflow-x-hidden">
      <header className="border-b border-white/5 pb-5 sm:pb-6 min-w-0">
        <Link
          href="/super-admin"
          className="inline-flex min-h-11 items-center rounded-xl border border-white/5 bg-[#121215] px-4 py-2 text-[#c4b5fd] text-[10px] font-black uppercase touch-manipulation sm:hover:border-[#7c3aed]/30 sm:hover:bg-[#7c3aed]/10 sm:hover:text-[#e9d5ff]"
        >
          {"<-"} Geri Don
        </Link>
        <h1 className="text-3xl sm:text-4xl font-black italic text-white uppercase tracking-tighter mt-3 break-words leading-tight">
          {org.name || `ORG-${org.id.slice(0, 8).toUpperCase()}`}
        </h1>
        <p className="text-gray-500 font-bold text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.25em] italic mt-2 break-words">
          Oluşturulma: {org.created_at ? new Date(org.created_at).toLocaleDateString("tr-TR") : "-"} • Güncellenme:{" "}
          {org.updated_at ? new Date(org.updated_at).toLocaleString("tr-TR") : "-"}
        </p>
        <p className="text-[10px] text-gray-500 font-bold mt-1 uppercase">
          Durum: <span className="text-white">{ORGANIZATION_STATUS_LABELS[orgStatus]}</span>
        </p>
      </header>

      <SuperAdminLicensePanel
        organizationId={org.id}
        organizationName={org.name || `ORG-${org.id.slice(0, 8).toUpperCase()}`}
        status={orgStatus}
        startsAt={org.starts_at ?? null}
        endsAt={org.ends_at ?? null}
        lifecycleColumnsPresent={orgFetch.lifecycleColumnsPresent}
      />

      <SuperAdminOrgLifecyclePanel
        organizationId={org.id}
        organizationName={org.name || `ORG-${org.id.slice(0, 8).toUpperCase()}`}
        status={orgStatus}
        lifecycleColumnsPresent={orgFetch.lifecycleColumnsPresent}
      />

      <SuperAdminAddCoachForm organizationId={org.id} />

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 min-w-0">
        <Mini label="Admin" value={admins} />
        <Mini label="Koç" value={coaches} />
        <Mini label="Sporcu" value={athletes} />
        <Mini label="Toplam Ders" value={lessons.length} />
        <Mini label="Bugünkü Ders" value={todayLessons} />
        <Mini label="Aktif Ders" value={activeStatusCount} />
      </section>

      <section className="grid lg:grid-cols-2 gap-4 min-w-0">
        <div className="bg-[#121215] border border-white/5 rounded-[1.5rem] p-4 sm:p-5 min-w-0">
          <p className="text-white text-sm font-black italic uppercase mb-3">Son Ders Aktivitesi</p>
          {lessons.length === 0 ? (
            <p className="text-[10px] text-gray-500 font-bold uppercase">Ders verisi yok</p>
          ) : (
            <div className="grid gap-2 min-w-0">
              {lessons.slice(0, 8).map((lesson) => (
                <div key={lesson.id} className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 min-w-0">
                  <p className="text-white text-xs font-black italic uppercase break-words">{lesson.title}</p>
                  <p className="text-[10px] text-gray-500 font-bold break-words">
                    {lesson.start_time ? new Date(lesson.start_time).toLocaleString("tr-TR") : "-"} • {lesson.location || "Lokasyon yok"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#121215] border border-white/5 rounded-[1.5rem] p-4 sm:p-5 min-w-0">
          <p className="text-white text-sm font-black italic uppercase mb-3">Son Program Aktivitesi</p>
          {programs.length === 0 ? (
            <p className="text-[10px] text-gray-500 font-bold uppercase">Program verisi yok</p>
          ) : (
            <div className="grid gap-2 min-w-0">
              {programs.map((program) => (
                <div key={program.id} className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 min-w-0">
                  <p className="text-white text-xs font-black italic uppercase break-words">{program.title || "Program"}</p>
                  <p className="text-[10px] text-gray-500 font-bold break-words">
                    {program.created_at ? new Date(program.created_at).toLocaleString("tr-TR") : "-"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#121215] border border-white/5 rounded-xl p-2.5 sm:p-3 min-w-0">
      <p className="text-[8px] sm:text-[9px] text-gray-500 font-black uppercase truncate">{label}</p>
      <p className="text-xl sm:text-2xl text-white font-black italic tabular-nums">{value}</p>
    </div>
  );
}
