import { redirect } from "next/navigation";
import { createServerSupabaseReadClient } from "@/lib/supabase/server-read";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { extractSessionRole } from "@/lib/auth/sessionClaims";
import { getSystemHealthReport } from "@/lib/diagnostics/systemHealth";
import { scanProfileIntegrity } from "@/lib/diagnostics/profileIntegrity";
import ProfileIntegrityPanel from "./ProfileIntegrityPanel";

export default async function SystemHealthPage() {
  const sessionClient = await createServerSupabaseReadClient();
  const { data: authData } = await sessionClient.auth.getUser();
  if (!authData.user) redirect("/login");

  const { data: profile } = await sessionClient
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();
  let effectiveProfile = profile;
  if (!effectiveProfile) {
    try {
      const adminClient = createSupabaseAdminClient();
      const byId = await adminClient.from("profiles").select("role").eq("id", authData.user.id).maybeSingle();
      effectiveProfile = byId.data ?? null;
    } catch {
      effectiveProfile = profile;
    }
  }

  const sessionRole = getSafeRole(extractSessionRole(authData.user));
  if (getSafeRole(effectiveProfile?.role) !== "super_admin" && sessionRole !== "super_admin") redirect("/login");

  const report = await getSystemHealthReport();
  const integrity = await scanProfileIntegrity();
  const envMissing = report.checks.some((check) => check.details.includes("SUPABASE_SERVICE_ROLE_KEY"));
  const failedChecks = report.checks.filter((check) => !check.passed);
  const sqlByMigration: Record<string, string> = {
    "20260330_athlete_permissions.sql": `create table if not exists public.athlete_permissions (
  athlete_id uuid primary key references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  can_view_morning_report boolean not null default true,
  can_view_programs boolean not null default true,
  can_view_calendar boolean not null default true,
  can_view_notifications boolean not null default true,
  can_view_rpe_entry boolean not null default true,
  can_view_development_profile boolean not null default true,
  can_view_financial_status boolean not null default true,
  can_view_performance_metrics boolean not null default true,
  can_view_wellness_metrics boolean not null default true,
  can_view_skill_radar boolean not null default true,
  updated_at timestamptz not null default now()
);`,
    "20260330_attendance_status_normalization.sql": `alter table public.training_participants
add column if not exists attendance_status text;
alter table public.training_participants
add column if not exists marked_by uuid references public.profiles(id) on delete set null;
alter table public.training_participants
add column if not exists marked_at timestamptz;`,
  };

  return (
    <div className="space-y-5 sm:space-y-6 pb-[max(4rem,env(safe-area-inset-bottom,0px))] min-w-0 overflow-x-hidden">
      <header className="border-b border-white/5 pb-5 sm:pb-6 min-w-0">
        <h1 className="text-3xl sm:text-4xl font-black italic text-white uppercase tracking-tighter leading-tight break-words">
          SISTEM <span className="text-[#7c3aed]">SAGLIK</span>
        </h1>
        <p className="text-gray-500 font-bold text-[9px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.3em] italic mt-2 sm:mt-3 border-l-2 border-[#7c3aed] pl-3 sm:pl-4 break-words">
          Migration ve kritik schema bagimlilik denetimi
        </p>
      </header>

      <section className="bg-[#121215] border border-white/5 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
            Son Kontrol: {new Date(report.generatedAt).toLocaleString("tr-TR")}
          </p>
          <span
            className={`px-3 py-1 rounded-xl border text-[10px] font-black uppercase ${
              report.overallPassed
                ? "text-green-400 border-green-500/20 bg-green-500/10"
                : "text-red-400 border-red-500/20 bg-red-500/10"
            }`}
          >
            {report.overallPassed ? "SAGLIKLI" : "KRITIK EKSIK VAR"}
          </span>
        </div>
      </section>

      {envMissing && (
        <section className="bg-amber-500/10 border border-amber-500/30 rounded-[1.5rem] p-4 min-w-0">
          <p className="text-amber-300 text-xs font-black uppercase tracking-wider break-words">
            Environment uyarisi: SUPABASE_SERVICE_ROLE_KEY eksik. Bu nedenle schema kontrolleri dogrulanamiyor.
          </p>
          <p className="text-[10px] text-amber-200/80 font-bold mt-2">
            .env.local dosyasina SUPABASE_SERVICE_ROLE_KEY ekleyin ve dev sunucusunu yeniden baslatin.
          </p>
        </section>
      )}

      <section className="grid gap-3 min-w-0">
        {report.checks.map((check) => (
          <div key={check.key} className="bg-[#121215] border border-white/5 rounded-[1.5rem] p-4 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 min-w-0">
              <p className="text-white text-sm font-black italic uppercase break-words min-w-0">{check.title}</p>
              <span
                className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase border ${
                  check.passed
                    ? "text-green-400 border-green-500/20 bg-green-500/10"
                    : "text-red-400 border-red-500/20 bg-red-500/10"
                }`}
              >
                {check.passed ? "GECTI" : "KALDI"}
              </span>
            </div>
            <p className="text-[10px] text-gray-500 font-bold italic mt-2 break-words">{check.details}</p>
            <p className="text-[10px] text-gray-600 font-black uppercase mt-2 break-all">Migration: {check.migration}</p>
          </div>
        ))}
      </section>

      <ProfileIntegrityPanel
        summary={{
          missingProfileCount: integrity.missingProfileCount,
          orphanProfileCount: integrity.orphanProfileCount,
          missingOrganizationCount: integrity.missingOrganizationCount,
          invalidRoleCount: integrity.invalidRoleCount,
          superAdminRoleMismatchCount: integrity.superAdminRoleMismatchCount,
        }}
      />

      {failedChecks.length > 0 && (
        <section className="bg-[#121215] border border-white/5 rounded-[1.5rem] p-4 space-y-3 min-w-0">
          <p className="text-white text-sm font-black italic uppercase">Copy SQL Checklist</p>
          <p className="text-[10px] text-gray-500 font-bold italic break-words">
            Kalan migrationlar icin SQL Editor uzerinden kopyalayip calistirabilirsiniz.
          </p>
          {failedChecks.map((check) => {
            const sql = sqlByMigration[check.migration];
            if (!sql) return null;
            return (
              <div key={`sql-${check.key}`} className="space-y-2">
                <p className="text-[10px] font-black uppercase text-[#c4b5fd]">{check.migration}</p>
                <pre className="text-[10px] text-gray-300 bg-black/30 border border-white/10 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-words max-w-full">
                  {sql}
                </pre>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
