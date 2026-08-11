import { redirect } from "next/navigation";
import { createServerSupabaseClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getDefaultRouteForRole, getSafeRole } from "@/lib/auth/roleMatrix";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { resolveRouteRoleFromUser } from "@/lib/auth/resolveRouteRole";
import { safeRedirectPath } from "@/lib/auth/routeRedirect";
import { extractSessionFullName, extractSessionOrganizationId, extractSessionRole } from "@/lib/auth/sessionClaims";
import { loadSessionProfileWithAdminFallback } from "@/lib/auth/loadSessionProfile";
import { mergeTenantProfileFromSources } from "@/lib/auth/tenantProfileMerge";
import { evaluateOrganizationProductAccess } from "@/lib/auth/organizationGate";
import {
  LICENSE_PENDING_GATE_STATUS,
  NO_ORGANIZATION_GATE_STATUS,
  ORGANIZATION_ROW_UNAVAILABLE_STATUS,
  SCHEMA_INCOMPLETE_GATE_STATUS,
  isLicensePendingGateStatus,
} from "@/lib/organization/license";
import {
  ORGANIZATION_STATUS_LABELS,
  parseOrganizationStatus,
  type OrganizationStatus,
} from "@/lib/organization/lifecycle";
import OrgDurumuLogoutButton from "./OrgDurumuLogoutButton";
import Link from "next/link";
import { isUuid } from "@/lib/validation/uuid";
import { isInactiveAdminProfile } from "@/lib/admin/lifecycle";
import { isInactiveAthleteProfile } from "@/lib/athlete/lifecycle";
import { isInactiveCoachProfile } from "@/lib/coach/lifecycle";
import { PATHS } from "@/lib/navigation/routeRegistry";

const REASONS: OrganizationStatus[] = ["suspended", "archived", "expired"];
const PROFILE_MISSING_REASON = "profile_missing" as const;

function parseReason(
  raw: string | string[] | undefined
):
  | OrganizationStatus
  | typeof LICENSE_PENDING_GATE_STATUS
  | typeof NO_ORGANIZATION_GATE_STATUS
  | typeof ORGANIZATION_ROW_UNAVAILABLE_STATUS
  | typeof SCHEMA_INCOMPLETE_GATE_STATUS
  | typeof PROFILE_MISSING_REASON
  | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  if (isLicensePendingGateStatus(v)) return LICENSE_PENDING_GATE_STATUS;
  if (v === NO_ORGANIZATION_GATE_STATUS) return NO_ORGANIZATION_GATE_STATUS;
  if (v === ORGANIZATION_ROW_UNAVAILABLE_STATUS) return ORGANIZATION_ROW_UNAVAILABLE_STATUS;
  if (v === SCHEMA_INCOMPLETE_GATE_STATUS) return SCHEMA_INCOMPLETE_GATE_STATUS;
  if (v === PROFILE_MISSING_REASON) return PROFILE_MISSING_REASON;
  const s = parseOrganizationStatus(v);
  return REASONS.includes(s) ? s : null;
}

export default async function OrgDurumuPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const hintReason = parseReason(sp.reason);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const actorResult = await resolveSessionActor();
  if (!("error" in actorResult) && actorResult.actor.role === "super_admin") {
    const target = safeRedirectPath(PATHS.orgDurumu, PATHS.superAdmin);
    if (target) redirect(target);
  }

  const { profile } = await loadSessionProfileWithAdminFallback(user);
  const metaRoleRaw = extractSessionRole(user);
  const metaOrgId = extractSessionOrganizationId(user);
  const metaFullName = extractSessionFullName(user);
  const effectiveProfile = mergeTenantProfileFromSources({
    profile,
    metaRole: metaRoleRaw,
    metaFullName,
    metaOrgId,
  });

  if (!effectiveProfile?.role || !getSafeRole(effectiveProfile.role)) {
    // FAZ 29: metadata'dan super_admin/admin self-provision kaldırıldı.
    // Self-heal yalnızca düşük yetkili tenant rolleri (coach/sporcu) için ve
    // doğrulanmış e-posta + geçerli org id ile yapılır.
    const metaRole = getSafeRole(metaRoleRaw);
    const canRepair =
      (metaRole === "coach" || metaRole === "sporcu") &&
      !!user.email_confirmed_at &&
      !!metaOrgId &&
      isUuid(metaOrgId);
    if (canRepair) {
      try {
        const adminClient = createSupabaseAdminClient();
        const { error: upsertError } = await adminClient.from("profiles").upsert(
          {
            id: user.id,
            email: user.email ?? null,
            full_name:
              extractSessionFullName(user) ?? user.email ?? "User",
            role: metaRole as string,
            organization_id: metaOrgId,
            is_active: true,
          },
          { onConflict: "id" }
        );
        if (!upsertError) {
          const homeTarget = safeRedirectPath(PATHS.orgDurumu, PATHS.home);
          if (homeTarget) redirect(homeTarget);
        }
      } catch {
        // info screen'e düşecek
      }
    }

    const title = "Profil kaydi eksik";
    const description =
      "Oturum acildi ancak profil satiri bulunamadi veya okunamadi. Bu durum yetkilendirme icin zorunlu oldugundan panele gecis engellenir. Lutfen sistem yoneticisi ile iletisime gecin.";
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-16 pb-[max(2rem,env(safe-area-inset-bottom,0px))] ui-page min-w-0">
        <div className="w-full max-w-md space-y-5 sm:space-y-6 rounded-[1.5rem] border border-white/5 ui-card p-5 sm:p-8 shadow-2xl min-w-0">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-[color:var(--peaker-ui-PRIMARY)]">Peaker</p>
            <h1 className="mt-2 text-xl sm:text-2xl font-black italic uppercase tracking-tight text-white break-words">Erisim sinirli</h1>
            <p className="mt-3 text-sm font-bold text-gray-400 leading-relaxed break-words">{description}</p>
          </div>
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
            <p className="text-[10px] font-black uppercase text-amber-200/90">Durum</p>
            <p className="text-lg font-black italic text-white">{title}</p>
          </div>
          <OrgDurumuLogoutButton />
        </div>
      </div>
    );
  }

  if (resolveRouteRoleFromUser(user, effectiveProfile.role) === "super_admin") {
    const target = safeRedirectPath(PATHS.orgDurumu, PATHS.superAdmin);
    if (target) redirect(target);
  }

  if (isInactiveAdminProfile(effectiveProfile.role, effectiveProfile.is_active)) {
    redirect(PATHS.adminAccount);
  }
  if (isInactiveCoachProfile(effectiveProfile.role, effectiveProfile.is_active)) {
    redirect(PATHS.coachAccount);
  }
  if (isInactiveAthleteProfile(effectiveProfile.role, effectiveProfile.is_active)) {
    redirect(PATHS.athleteAccount);
  }

  const gate = await evaluateOrganizationProductAccess(supabase, effectiveProfile);
  if (!gate.blocked) {
    const actorForHome = await resolveSessionActor();
    if (!("error" in actorForHome)) {
      const home = getDefaultRouteForRole(actorForHome.actor.role);
      const target = safeRedirectPath(PATHS.orgDurumu, home);
      if (target) redirect(target);
    }
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-16 pb-[max(2rem,env(safe-area-inset-bottom,0px))] ui-page min-w-0">
        <div className="w-full max-w-md space-y-5 sm:space-y-6 rounded-[1.5rem] border border-white/5 ui-card p-5 sm:p-8 shadow-2xl min-w-0">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-[color:var(--peaker-ui-PRIMARY)]">Peaker</p>
            <h1 className="mt-2 text-xl sm:text-2xl font-black italic uppercase tracking-tight text-white break-words">Yonlendirme bekleniyor</h1>
            <p className="mt-3 text-sm font-bold text-gray-400 leading-relaxed break-words">
              Hesabiniz aktif gorunuyor ancak panele otomatik gecis tamamlanamadi. Asagidaki baglantidan devam edin veya cikis yapip tekrar giris yapin.
            </p>
          </div>
          <Link
            href={PATHS.home}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl ui-btn-primary px-4 py-3 text-[10px] font-black uppercase tracking-wide text-white touch-manipulation"
          >
            Panele git
          </Link>
          <OrgDurumuLogoutButton />
        </div>
      </div>
    );
  }

  const effective = gate.status;
  const title =
    effective === LICENSE_PENDING_GATE_STATUS
      ? "Lisans henüz başlamadı"
      : effective === NO_ORGANIZATION_GATE_STATUS
        ? "Organizasyon atanmamış"
        : effective === ORGANIZATION_ROW_UNAVAILABLE_STATUS
          ? "Organizasyon bilgisi doğrulanamadı"
          : effective === SCHEMA_INCOMPLETE_GATE_STATUS
            ? "Şema güncellemesi gerekli"
            : ORGANIZATION_STATUS_LABELS[effective as OrganizationStatus];
  const description =
    effective === LICENSE_PENDING_GATE_STATUS
      ? "Lisans başlangıç tarihi henüz gelmedi. Süper admin veya yöneticinizle iletişime geçin."
      : effective === NO_ORGANIZATION_GATE_STATUS
        ? "Hesabınız bir organizasyona bağlı değil. Süper admin veya destek ile iletişime geçin."
        : effective === ORGANIZATION_ROW_UNAVAILABLE_STATUS
          ? "Profilinizdeki organizasyon kaydı veritabanında eksik olabilir veya güvenlik kuralları satırı göstermiyor. Süper admin: profiles.organization_id alanını kontrol edin; sorun devam ederse destek ile iletişime geçin."
          : effective === SCHEMA_INCOMPLETE_GATE_STATUS
            ? "Sunucu şeması güvenlik kontrolleri için gerekli organizasyon kolonlarını içermiyor. Süper admin: Supabase migration (20260403_organization_lifecycle.sql) uygulayın; sistem sağlık sayfasına bakın."
            : effective === "archived"
              ? "Bu organizasyon arşivlendi. Panel ve operasyonel özelliklere erişim kapalıdır. Süper admin ile iletişime geçin."
              : effective === "expired"
                ? "Organizasyon lisansının bitiş tarihi geçti veya abonelik süresi doldu. Erişim yenilenene kadar kapalıdır."
                : "Organizasyon geçici olarak askıya alındı. Yöneticiniz veya süper admin ile iletişime geçin.";

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-16 pb-[max(2rem,env(safe-area-inset-bottom,0px))] ui-page min-w-0">
      <div className="w-full max-w-md space-y-5 sm:space-y-6 rounded-[1.5rem] border border-white/5 ui-card p-5 sm:p-8 shadow-2xl min-w-0">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-[color:var(--peaker-ui-PRIMARY)]">Peaker</p>
          <h1 className="mt-2 text-xl sm:text-2xl font-black italic uppercase tracking-tight text-white break-words">Erisim sinirli</h1>
          <p className="mt-3 text-sm font-bold text-gray-400 leading-relaxed break-words">{description}</p>
        </div>
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
          <p className="text-[10px] font-black uppercase text-amber-200/90">Durum</p>
          <p className="text-lg font-black italic text-white">{title}</p>
          {hintReason && hintReason !== effective ? (
            <p className="mt-1 text-[10px] text-gray-500 break-words">URL parametresi farkli; guncel durum yukaridaki gibidir.</p>
          ) : null}
        </div>
        <OrgDurumuLogoutButton />
      </div>
    </div>
  );
}
