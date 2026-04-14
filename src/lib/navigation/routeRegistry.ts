/**
 * Tek kaynak: path'ler, rol matrisi (roleMatrix), proxy ve coach/sporcu izin kontrolleri buradan türetilir.
 *
 * Yeni dashboard route eklerken:
 * 1. `PATHS` içine sabit ekleyin.
 * 2. Erişim kuralına göre şu listelerden uygun olanlara ekleyin:
 *    - PUBLIC_PATH_PREFIXES | SUPER_ADMIN_EXCLUSIVE_PREFIXES | ADMIN_ONLY_PREFIXES
 *    - MANAGEMENT_ROUTE_PREFIXES (admin+coach) ve/veya ATHLETE_SHARED_ROUTE_PREFIXES (coach sporcu sayfaları)
 *    - sporcu dışı liste: SPORCU_ROLE_NON_BRANCH_PREFIXES (ATHLETE_SHARED’ten türetilir; `/sporcu` hariç)
 * 3. Koç rapor veya not alanına giriyorsa: COACH_REPORT_GATE_PREFIXES | COACH_TRAINING_NOTES_PREFIXES
 * 4. Sporcu izin anahtarı gerekiyorsa: ATHLETE_ROUTE_PERMISSION_RULES
 * 5. Sidebar: `dashboardNavConfig.ts` → DASHBOARD_NAV_ITEMS (+ managementGroup / coachNeedsAll / athleteNeeds)
 */

import type { AthletePermissionKey } from "@/lib/types/athletePermission";

/** Tüm bilinen path sabitleri (nav / yönlendirme için tek referans) */
export const PATHS = {
  login: "/login",
  passwordReset: "/sifre-guncelleme",
  orgDurumu: "/org-durumu",
  adminAccount: "/yonetici-hesap-durumu",
  coachAccount: "/koc-hesap-durumu",
  athleteAccount: "/sporcu-hesap-durumu",
  superAdmin: "/super-admin",
  sistemSaglik: "/sistem-saglik",
  home: "/",
  performans: "/performans",
  performansAyarlar: "/performans/ayarlar",
  performansWellnessDetay: "/performans/wellness-detay",
  sahaTestleri: "/saha-testleri",
  idmanRaporu: "/idman-raporu",
  oyuncular: "/oyuncular",
  takimlar: "/takimlar",
  antrenmanYonetimi: "/antrenman-yonetimi",
  dersler: "/dersler",
  notlarHaftalikProgram: "/notlar-haftalik-program",
  ozelDersPaketleri: "/ozel-ders-paketleri",
  finans: "/finans",
  koclar: "/koclar",
  bildirimler: "/bildirimler",
  anket: "/anket",
  takvim: "/takvim",
  programlarim: "/programlarim",
  ozelDersPaketlerim: "/ozel-ders-paketlerim",
  sporcu: "/sporcu",
  sporcuSabahRaporu: "/sporcu/sabah-raporu",
} as const;

export type AppPath = (typeof PATHS)[keyof typeof PATHS];

export const PUBLIC_PATH_PREFIXES = [PATHS.login, PATHS.passwordReset] as const;

/** proxy / layout ile uyumlu sabit isimler */
export const ORG_LIFECYCLE_INFO_ROUTE = PATHS.orgDurumu;
export const ADMIN_ACCOUNT_INFO_ROUTE = PATHS.adminAccount;
export const COACH_ACCOUNT_INFO_ROUTE = PATHS.coachAccount;
export const SPORCU_ACCOUNT_INFO_ROUTE = PATHS.athleteAccount;

/** super_admin dışındaki roller için kapalı (super_admin daha önce true döner) */
export const SUPER_ADMIN_EXCLUSIVE_PREFIXES = [PATHS.superAdmin, PATHS.sistemSaglik] as const;

/** Yalnızca organizasyon admini */
export const ADMIN_ONLY_PREFIXES = [PATHS.finans, PATHS.koclar] as const;

/** Yönetim & analiz: admin + coach (coach için proxy'de ek izin kontrolleri var) */
export const MANAGEMENT_ROUTE_PREFIXES = [
  PATHS.home,
  PATHS.performans,
  PATHS.performansAyarlar,
  PATHS.sahaTestleri,
  PATHS.idmanRaporu,
  PATHS.oyuncular,
  PATHS.takimlar,
  PATHS.antrenmanYonetimi,
  PATHS.dersler,
  PATHS.notlarHaftalikProgram,
  PATHS.ozelDersPaketleri,
  PATHS.bildirimler,
] as const;

/**
 * Koç panelinde sporcu sayfaları da açılabilir; sporcu rolü için /sporcu altı ayrı kurallı.
 * coach erişimi: MANAGEMENT ∪ ATHLETE_SHARED (roleMatrix).
 */
export const ATHLETE_SHARED_ROUTE_PREFIXES = [
  PATHS.anket,
  PATHS.takvim,
  PATHS.sporcu,
  PATHS.bildirimler,
  PATHS.programlarim,
  PATHS.ozelDersPaketlerim,
  PATHS.performansAyarlar,
] as const;

/** sporcu rolü: /sporcu dışındaki sporcu alanı */
export const SPORCU_ROLE_NON_BRANCH_PREFIXES = ATHLETE_SHARED_ROUTE_PREFIXES.filter((p) => p !== PATHS.sporcu);

const UUID_V4 = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

export function normalizePathname(pathname: string): string {
  return pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
}

/** Koç/admin sporcu kartı: /sporcu/<uuid> */
export function isAthleteManagementProfilePath(pathname: string): boolean {
  const p = normalizePathname(pathname);
  return new RegExp(`^${PATHS.sporcu}/${UUID_V4}$`, "i").test(p);
}

export function matchesPathPrefix(pathname: string, base: string): boolean {
  const p = normalizePathname(pathname);
  const b = normalizePathname(base);
  return p === b || p.startsWith(`${b}/`);
}

export function matchesAnyPrefix(pathname: string, bases: readonly string[]): boolean {
  return bases.some((b) => matchesPathPrefix(pathname, b));
}

/** sporcu hesabı: yalnızca kendi paneli + sabah raporu; UUID profil yok */
export function isSporcuBranchAllowedForAthlete(pathname: string): boolean {
  const p = normalizePathname(pathname);
  if (isAthleteManagementProfilePath(p)) return false;
  if (p === PATHS.sporcu) return true;
  if (p === PATHS.sporcuSabahRaporu || p.startsWith(`${PATHS.sporcuSabahRaporu}/`)) return true;
  return false;
}

/** Proxy coachPermissions: rapor sayfaları */
export const COACH_REPORT_GATE_PREFIXES = [
  PATHS.performans,
  PATHS.performansAyarlar,
  PATHS.performansWellnessDetay,
  PATHS.idmanRaporu,
  PATHS.sahaTestleri,
] as const;

/** Proxy coachPermissions: antrenman notu / özel paket yönetimi */
export const COACH_TRAINING_NOTES_PREFIXES = [PATHS.notlarHaftalikProgram, PATHS.ozelDersPaketleri] as const;

export type AthleteRoutePermissionRule = {
  path: string;
  match: "exact" | "prefix";
  permission: AthletePermissionKey;
};

/** sporcu proxy: path → athlete_permissions anahtarı */
export const ATHLETE_ROUTE_PERMISSION_RULES: readonly AthleteRoutePermissionRule[] = [
  { path: PATHS.sporcuSabahRaporu, match: "prefix", permission: "can_view_morning_report" },
  { path: PATHS.programlarim, match: "exact", permission: "can_view_programs" },
  { path: PATHS.ozelDersPaketlerim, match: "exact", permission: "can_view_programs" },
  { path: PATHS.takvim, match: "exact", permission: "can_view_calendar" },
  { path: PATHS.bildirimler, match: "exact", permission: "can_view_notifications" },
  { path: PATHS.anket, match: "exact", permission: "can_view_rpe_entry" },
  { path: PATHS.sporcu, match: "exact", permission: "can_view_development_profile" },
] as const;

export function athletePathPermissionRule(pathname: string): AthleteRoutePermissionRule | null {
  const p = normalizePathname(pathname);
  for (const rule of ATHLETE_ROUTE_PERMISSION_RULES) {
    if (rule.match === "exact" && p === normalizePathname(rule.path)) return rule;
    if (rule.match === "prefix" && (p === normalizePathname(rule.path) || p.startsWith(`${normalizePathname(rule.path)}/`))) {
      return rule;
    }
  }
  return null;
}
