"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { usePathname, useRouter } from "next/navigation";
import { HardNavLink } from "@/components/navigation/HardNavLink";
import { getSafeRole, type UserRole } from "@/lib/auth/roleMatrix";
import {
  DASHBOARD_NAV_ITEMS,
  isDashboardNavItemActive,
  isDashboardNavItemVisible,
  type DashboardNavIcon,
  type NavSection,
} from "@/lib/navigation/dashboardNavConfig";
import { DEFAULT_COACH_PERMISSIONS } from "@/lib/types";
import { DEFAULT_ATHLETE_PERMISSIONS } from "@/lib/types";
import { 
  LayoutDashboard, Users, Settings, User, Calendar,
  Activity, LogOut,   Trophy, Bell, Bolt, ClipboardCheck, 
  TrendingUp, Loader2, BarChart3, Menu, X, CreditCard, FileText, Plus,
  Shield, Moon,
} from "lucide-react";
import { fetchMeRoleClient } from "@/lib/auth/meRoleClient";
import { looksLikeSuperAdminRole } from "@/lib/auth/resolveRouteRole";
import type { MeAccessApiPayload } from "@/lib/auth/meAccessBootstrap";
import { MeAccessProvider, useMeAccess } from "@/lib/auth/MeAccessProvider";
import { invalidateMeAccessSession } from "@/lib/auth/useMeAccess";
import { DashboardBrandingContent } from "./DashboardBrandingContent";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { resolveLayoutBranding } from "@/lib/organization/branding/surfaces/resolveLayoutBranding";
import { createLayoutThemeStyle, LAYOUT_THEME_VARS } from "@/lib/navigation/layoutThemeTokens";
import {
  buildSidebarNavIconStyle,
  buildSidebarNavItemStyle,
  createSidebarThemeStyleFromBranding,
  SIDEBAR_THEME_VARS,
} from "@/lib/navigation/sidebarThemeTokens";
import {
  createDefaultOrganizationBrandingPresentation,
  createOrganizationBrandingPresentation,
  type OrganizationBrandingPresentation,
} from "@/lib/navigation/organizationBrandingPresentation";
import { BrandingDocumentMetadata } from "@/components/branding/BrandingDocumentMetadata";
import { BrandingSidebarLogo } from "@/components/branding/BrandingSidebarLogo";
import { useUnreadNotificationsLive } from "@/lib/hooks/useUnreadNotificationsLive";
import { PATHS } from "@/lib/navigation/routeRegistry";
import { isQuickActionFeatureVisible } from "@/lib/navigation/quickActionFeatureVisibility";
import { QUICK_ACTION_IDS } from "@/lib/organization/features/surfaces/quickActionEntitlementMap";
import { hrefTahsilatKaydet } from "@/lib/finance/tahsilatMerkeziLinks";
import type { CoachPermissions, AthletePermissions } from "@/lib/types";
import type { OrganizationFeatures } from "@/lib/organization/features/types";
import { PeakerDebugInstaller } from "@/components/dev/PeakerDebugInstaller";
import { DashboardOfflineShell } from "@/components/offline";
import { CoachMobileQuickStrip } from "@/components/mobile/CoachMobileQuickStrip";
import { clearAllOfflineActions } from "@/lib/offline/offlineActionQueue";
import { hrefFieldTestSession, todayFieldTestSessionDate } from "@/lib/fieldTests/fieldTestSessionRoutes";

const NAV_ICONS: Record<DashboardNavIcon, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard size={16} />,
  Activity: <Activity size={16} />,
  Bolt: <Bolt size={16} />,
  Calendar: <Calendar size={16} />,
  BarChart3: <BarChart3 size={16} />,
  ClipboardCheck: <ClipboardCheck size={16} />,
  Users: <Users size={16} />,
  CreditCard: <CreditCard size={16} />,
  FileText: <FileText size={16} />,
  Bell: <Bell size={16} />,
  User: <User size={18} />,
  TrendingUp: <TrendingUp size={16} />,
  Settings: <Settings size={16} />,
  Shield: <Shield size={16} />,
  Moon: <Moon size={16} />,
};

type DashboardLayoutClientProps = {
  children: React.ReactNode;
  initialMeAccess?: MeAccessApiPayload | null;
};

function DashboardLayoutShell({
  children,
  initialMeAccess = null,
  onEnableMeAccessFetch,
}: DashboardLayoutClientProps & {
  onEnableMeAccessFetch: () => void;
}) {
  const { payload: accessPayload, refresh: refreshMeAccess } = useMeAccess();
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [coachPermissions, setCoachPermissions] = useState<CoachPermissions | null>(null);
  const [athletePermissions, setAthletePermissions] = useState<AthletePermissions | null>(null);
  const [organizationFeatures, setOrganizationFeatures] = useState<OrganizationFeatures | null>(() =>
    initialMeAccess?.organizationFeatures ?? null
  );
  const [featuresRevision, setFeaturesRevision] = useState<number | null>(() =>
    initialMeAccess ? initialMeAccess.featuresRevision : null
  );
  const [layoutThemeStyle, setLayoutThemeStyle] = useState<Record<string, string>>(() =>
    initialMeAccess
      ? createLayoutThemeStyle(resolveLayoutBranding(initialMeAccess.organizationBranding).theme)
      : createLayoutThemeStyle(createDefaultBranding().theme)
  );
  const [sidebarThemeStyle, setSidebarThemeStyle] = useState<Record<string, string>>(() =>
    initialMeAccess
      ? createSidebarThemeStyleFromBranding(initialMeAccess.organizationBranding)
      : createSidebarThemeStyleFromBranding(createDefaultBranding())
  );
  const [brandingPresentation, setBrandingPresentation] = useState<OrganizationBrandingPresentation>(() =>
    initialMeAccess
      ? createOrganizationBrandingPresentation(initialMeAccess.organizationBranding)
      : createDefaultOrganizationBrandingPresentation()
  );
  const { unreadCount, badgePulse } = useUnreadNotificationsLive(organizationFeatures);
  const [organizationName, setOrganizationName] = useState("PEAKER");
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const sessionIdentityRef = useRef<{
    userId: string | null;
    organizationId: string | null;
    role: UserRole | null;
  }>({
    userId: null,
    organizationId: null,
    role: null,
  });

  async function tryBootstrapSuperAdminSession(): Promise<boolean> {
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData.user;
    if (!authUser) return false;

    // FAZ 29: metadata claim'inden super_admin UI bootstrap'i kaldırıldı;
    // yalnızca profiles satırındaki rol kabul edilir.
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", authUser.id)
      .maybeSingle();

    if (looksLikeSuperAdminRole(profileRow?.role) || getSafeRole(profileRow?.role) === "super_admin") {
      setRole("super_admin");
      setUserName(profileRow?.full_name || authUser.email || "Super Admin");
      setOrganizationId(null);
      setUserId(authUser.id);
      setOrganizationName("SYSTEM");
      return true;
    }

    return false;
  }

  useEffect(() => {
    let cancelled = false;
    async function resolveRoleAndProfile() {
      try {
        let payload = await fetchMeRoleClient();
        if (!payload.ok && payload.httpStatus === 401) {
          const { data: authData } = await supabase.auth.getUser();
          if (authData.user && !cancelled) {
            await new Promise((r) => setTimeout(r, 120));
            if (!cancelled) payload = await fetchMeRoleClient();
          }
        }

        if (!payload.ok) {
          if (!cancelled) {
            setPermissionsLoading(false);
            setLoading(false);
            if (payload.httpStatus === 401) {
              router.replace(PATHS.login);
            } else if (payload.httpStatus === 403) {
              const currentPath = pathnameRef.current;
              const isOnSuperAdminRoute =
                currentPath === PATHS.superAdmin ||
                currentPath.startsWith(`${PATHS.superAdmin}/`) ||
                currentPath === PATHS.sistemSaglik;
              if (isOnSuperAdminRoute) {
                const allowed = await tryBootstrapSuperAdminSession();
                if (!allowed) {
                  const { data: authData } = await supabase.auth.getUser();
                  const authUser = authData.user;
                  if (authUser) {
                    setRole("super_admin");
                    setUserName(authUser.email ?? "Super Admin");
                    setOrganizationId(null);
                    setUserId(authUser.id);
                    setOrganizationName("SYSTEM");
                  }
                }
                if (!cancelled) {
                  setPermissionsLoading(false);
                  setLoading(false);
                }
                return;
              }
              if (payload.error === "admin_inactive") {
                router.replace(PATHS.adminAccount);
              } else if (payload.error === "coach_inactive") {
                router.replace(PATHS.coachAccount);
              } else if (payload.error === "athlete_inactive") {
                router.replace(PATHS.athleteAccount);
              } else if (payload.error === "organization_blocked") {
                if (payload.gateStatus) {
                  router.replace(`${PATHS.orgDurumu}?reason=${encodeURIComponent(payload.gateStatus)}`);
                } else {
                  router.replace(PATHS.orgDurumu);
                }
              } else if (payload.error === "profile_missing" || payload.error === "invalid_role") {
                router.replace(`${PATHS.orgDurumu}?reason=profile_missing`);
              } else {
                router.replace(PATHS.login);
              }
            } else {
              router.replace(PATHS.login);
            }
          }
          return;
        }

        if (!cancelled) {
          const nextUserId = payload.userId ?? null;
          const nextOrganizationId = payload.organizationId ?? null;
          const identityChanged =
            sessionIdentityRef.current.userId !== nextUserId ||
            sessionIdentityRef.current.organizationId !== nextOrganizationId ||
            sessionIdentityRef.current.role !== payload.role;

          setRole(payload.role);
          setUserName(payload.fullName || "Peaker User");
          setOrganizationId(nextOrganizationId);
          setUserId(nextUserId);
          setOrganizationName(payload.organizationName ?? "");
          setLoading(false);

          if (identityChanged) {
            setPermissionsLoading(true);
            setCoachPermissions(null);
            setAthletePermissions(null);
            invalidateMeAccessSession();
            onEnableMeAccessFetch();
            void refreshMeAccess({ force: true });
            sessionIdentityRef.current = {
              userId: nextUserId,
              organizationId: nextOrganizationId,
              role: payload.role,
            };
          }
        }
      } catch {
        if (!cancelled) {
          setPermissionsLoading(false);
          setLoading(false);
          router.replace(PATHS.login);
        }
      }
    }

    void resolveRoleAndProfile();
    const { data: authSub } = supabase.auth.onAuthStateChange(() => {
      void resolveRoleAndProfile();
    });

    return () => {
      cancelled = true;
      authSub.subscription.unsubscribe();
    };
  }, [router, onEnableMeAccessFetch, refreshMeAccess]);

  useEffect(() => {
    if (!accessPayload?.ok) {
      return;
    }

    setOrganizationFeatures(accessPayload.organizationFeatures);
    setFeaturesRevision(accessPayload.featuresRevision);
    const layoutBranding = resolveLayoutBranding(accessPayload.organizationBranding);
    setLayoutThemeStyle(createLayoutThemeStyle(layoutBranding.theme));
    setSidebarThemeStyle(createSidebarThemeStyleFromBranding(accessPayload.organizationBranding));
    setBrandingPresentation(createOrganizationBrandingPresentation(accessPayload.organizationBranding));
    if (role === "coach") {
      setCoachPermissions(accessPayload.coachPermissions || DEFAULT_COACH_PERMISSIONS);
    } else if (role === "sporcu") {
      setAthletePermissions(accessPayload.athletePermissions || DEFAULT_ATHLETE_PERMISSIONS);
    }
    setPermissionsLoading(false);
  }, [accessPayload, role]);

  const handleLogout = async () => {
    await clearAllOfflineActions();
    invalidateMeAccessSession();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const safeRole = getSafeRole(role);
  const isSuperAdmin = safeRole === "super_admin";
  const isAthlete = safeRole === "sporcu";
  const isCoachOrAdmin = safeRole === "coach" || safeRole === "admin";

  const navCtx = {
    role: safeRole,
    coachPermissions,
    athletePermissions,
    organizationFeatures,
  };

  const visibleNav = (section: NavSection) =>
    DASHBOARD_NAV_ITEMS.filter((item) => item.section === section && isDashboardNavItemVisible(item, navCtx));
  const quickActions = (
    isCoachOrAdmin && !permissionsLoading
      ? [
          ...(safeRole === "admin"
            ? [
                { label: "Grup Dersi Planla", href: "/antrenman-yonetimi?modul=grup-dersleri&view=ders-olustur", quickActionId: QUICK_ACTION_IDS.planGroupLesson },
                { label: "Özel Ders Planla", href: "/antrenman-yonetimi?modul=ozel-dersler&view=planlama", quickActionId: QUICK_ACTION_IDS.planPrivateLesson },
                { label: "Yoklama Aç", href: "/antrenman-yonetimi?modul=grup-dersleri&view=yoklama", quickActionId: QUICK_ACTION_IDS.openAttendance },
                { label: "Sporcu Ekle", href: "/sporcular/yeni", quickActionId: QUICK_ACTION_IDS.addAthlete },
                { label: "Tahsilat Kaydet", href: hrefTahsilatKaydet(), quickActionId: QUICK_ACTION_IDS.recordPayment },
                { label: "Saha Testi Girişi", href: hrefFieldTestSession(todayFieldTestSessionDate()), quickActionId: QUICK_ACTION_IDS.fieldTestEntry },
              ]
            : []),
          ...(safeRole === "coach" && coachPermissions?.can_create_lessons
            ? [{ label: "Grup Dersi Planla", href: "/antrenman-yonetimi?modul=grup-dersleri&view=ders-olustur", quickActionId: QUICK_ACTION_IDS.planGroupLesson }]
            : []),
          ...(safeRole === "coach" && coachPermissions?.can_manage_training_notes
            ? [{ label: "Özel Ders Planla", href: "/antrenman-yonetimi?modul=ozel-dersler&view=planlama", quickActionId: QUICK_ACTION_IDS.planPrivateLesson }]
            : []),
          ...(safeRole === "coach" && coachPermissions?.can_take_attendance
            ? [{ label: "Yoklama Aç", href: "/antrenman-yonetimi?modul=grup-dersleri&view=yoklama", quickActionId: QUICK_ACTION_IDS.openAttendance }]
            : []),
          ...(safeRole === "coach" && coachPermissions?.can_manage_athlete_profiles
            ? [{ label: "Sporcu Ekle", href: "/sporcular/yeni", quickActionId: QUICK_ACTION_IDS.addAthlete }]
            : []),
          ...(safeRole === "coach" && coachPermissions?.can_view_reports
            ? [
                { label: "Tahsilat Kaydet", href: PATHS.finans, quickActionId: QUICK_ACTION_IDS.recordPayment },
                { label: "Saha Testi Girişi", href: hrefFieldTestSession(todayFieldTestSessionDate()), quickActionId: QUICK_ACTION_IDS.fieldTestEntry },
              ]
            : []),
        ]
      : []
  ).filter((action) => isQuickActionFeatureVisible(action.quickActionId, organizationFeatures));

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div
        className="h-[100dvh] flex flex-col items-center justify-center"
        style={{
          ...layoutThemeStyle,
          backgroundColor: LAYOUT_THEME_VARS.BACKGROUND,
          color: LAYOUT_THEME_VARS.PRIMARY,
        }}
      >
        <Loader2 className="animate-spin mb-4" size={40} />
        <span className="text-[10px] font-black uppercase tracking-[0.5em] italic">SENKRONİZE EDİLİYOR</span>
      </div>
    );
  }

  const closeMobileSidebar = () => setIsSidebarOpen(false);

  const sidebarBody = (onNavigate?: () => void) => (
    <>
      <BrandingSidebarLogo
        logo={brandingPresentation.logo}
        metadata={brandingPresentation.metadata}
        organizationName={organizationName}
      />

      <nav
        className="flex-1 space-y-0.5 px-4 text-sm overflow-y-auto custom-scrollbar"
        style={{ scrollbarColor: `${SIDEBAR_THEME_VARS.SIDEBAR_TEXT} transparent` }}
      >
        {isSuperAdmin && (
          <div className="mb-6">
            <p
              className="text-[9px] font-black uppercase tracking-[0.2em] mb-3 ml-2 italic"
              style={{ color: SIDEBAR_THEME_VARS.SIDEBAR_TEXT, opacity: 0.4 }}
            >
              SYSTEM OWNER
            </p>
            {visibleNav("super_admin").map((item) => (
              <NavItem
                key={`${item.section}-${item.href}`}
                href={item.href}
                icon={NAV_ICONS[item.icon]}
                label={item.label}
                active={isDashboardNavItemActive(pathname, item)}
                variant={item.variant}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}

        {isCoachOrAdmin && (
          <div className="mb-6">
            <p
              className="text-[9px] font-black uppercase tracking-[0.2em] mb-3 ml-2 italic"
              style={{ color: SIDEBAR_THEME_VARS.SIDEBAR_TEXT, opacity: 0.4 }}
            >
              İŞ AKIŞLARI
            </p>
            {visibleNav("management").map((item) => (
              <NavItem
                key={`${item.section}-${item.href}`}
                href={item.href}
                icon={NAV_ICONS[item.icon]}
                label={item.label}
                active={isDashboardNavItemActive(pathname, item)}
                variant={item.variant}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
        {isAthlete && (
          <>
            <p
              className="text-[9px] font-black uppercase tracking-[0.2em] mb-3 ml-2 italic"
              style={{ color: SIDEBAR_THEME_VARS.SIDEBAR_TEXT, opacity: 0.4 }}
            >
              SPORCU ERİŞİMİ
            </p>
            {visibleNav("athlete").map((item) => (
              <NavItem
                key={`${item.section}-${item.href}`}
                href={item.href}
                icon={NAV_ICONS[item.icon]}
                label={item.label}
                active={isDashboardNavItemActive(pathname, item)}
                variant={item.variant}
                onNavigate={onNavigate}
              />
            ))}
          </>
        )}
      </nav>

      <div
        className="p-4 border-t space-y-0.5"
        style={{ borderColor: `color-mix(in srgb, ${SIDEBAR_THEME_VARS.SURFACE} 70%, transparent)` }}
      >
        {visibleNav("footer").map((item) => (
          <NavItem
            key={`${item.section}-${item.href}`}
            href={item.href}
            icon={NAV_ICONS[item.icon]}
            label={item.label}
            active={isDashboardNavItemActive(pathname, item)}
            variant={item.variant}
            onNavigate={onNavigate}
          />
        ))}
        <button type="button" onClick={handleLogout} className="flex min-h-11 w-full touch-manipulation items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[11px] font-bold italic tracking-wider text-red-500/40 transition-all sm:hover:bg-red-500/5 sm:hover:text-red-500">
          <LogOut size={16} aria-hidden /> ÇIKIŞ YAP
        </button>
      </div>
    </>
  );

  return (
    <>
      <BrandingDocumentMetadata
        metadata={brandingPresentation.metadata}
        favicon={brandingPresentation.favicon}
      />
      {isSidebarOpen ? (
        <>
          <button
            type="button"
            aria-label="Menüyü kapat"
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={closeMobileSidebar}
          />
          <aside
            id="dashboard-sidebar"
            className="fixed left-0 top-[env(safe-area-inset-top,0px)] bottom-[env(safe-area-inset-bottom,0px)] z-[110] flex w-64 flex-col border-r lg:hidden dashboard-shell-chrome"
            style={{
              ...sidebarThemeStyle,
              backgroundColor: SIDEBAR_THEME_VARS.SIDEBAR_BACKGROUND,
              color: SIDEBAR_THEME_VARS.SIDEBAR_TEXT,
              borderColor: `color-mix(in srgb, ${SIDEBAR_THEME_VARS.SURFACE} 70%, transparent)`,
            }}
          >
            {sidebarBody(closeMobileSidebar)}
          </aside>
        </>
      ) : null}

      <div
        className="flex min-h-[100dvh]"
        style={{
          ...layoutThemeStyle,
          backgroundColor: LAYOUT_THEME_VARS.BACKGROUND,
        }}
      >
        <aside
          className="dashboard-shell-chrome hidden w-64 shrink-0 flex-col border-r lg:flex"
          style={{
            ...sidebarThemeStyle,
            backgroundColor: SIDEBAR_THEME_VARS.SIDEBAR_BACKGROUND,
            color: SIDEBAR_THEME_VARS.SIDEBAR_TEXT,
            borderColor: `color-mix(in srgb, ${SIDEBAR_THEME_VARS.SURFACE} 70%, transparent)`,
          }}
        >
          {sidebarBody()}
        </aside>

        <main
          className="relative z-0 flex min-w-0 flex-1 flex-col pt-[env(safe-area-inset-top,0px)] lg:pt-0"
          style={{ backgroundColor: LAYOUT_THEME_VARS.BACKGROUND }}
        >
        <header
          className="dashboard-shell-chrome flex min-h-16 shrink-0 items-center justify-between border-b border-white/5 px-4 sm:px-6"
          style={{
            backgroundColor: LAYOUT_THEME_VARS.BACKGROUND,
            color: LAYOUT_THEME_VARS.TEXT_PRIMARY,
          }}
        >
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-white touch-manipulation"
            aria-expanded={isSidebarOpen}
            aria-controls="dashboard-sidebar"
          >
            {isSidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          
          <div className="flex items-center gap-2 sm:gap-3 ml-auto text-white text-right min-w-0">
            {quickActions.length > 0 ? (
              <div className="relative hidden md:block">
                <details className="group">
                  <summary className="list-none cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-white/90">
                    <span className="inline-flex items-center gap-1.5">
                      <Plus size={14} />
                      Hızlı İşlem
                    </span>
                  </summary>
                  <div
                    className="absolute right-0 z-30 mt-2 min-w-56 rounded-xl border border-white/10 p-1 shadow-2xl"
                    style={{ backgroundColor: LAYOUT_THEME_VARS.SURFACE }}
                  >
                    {quickActions.map((action) => (
                      <button
                        key={action.href}
                        type="button"
                        onClick={() => router.push(action.href)}
                        className="flex w-full items-center rounded-lg px-3 py-2 text-left text-[11px] font-bold text-gray-300 hover:bg-white/5 hover:text-white"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </details>
              </div>
            ) : null}
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black uppercase italic leading-none">{userName}</span>
              <div className="flex items-center gap-1 mt-1">
                <Trophy size={8} style={{ color: LAYOUT_THEME_VARS.PRIMARY }} />
                <span
                  className="text-[7px] font-black italic uppercase tracking-[0.15em]"
                  style={{ color: LAYOUT_THEME_VARS.TEXT_SECONDARY }}
                >
                  {safeRole === "super_admin" ? "PLATFORM OWNER" : safeRole === "admin" ? "ORG ADMIN" : safeRole === "coach" ? "KOÇ" : "SPORCU"}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/bildirimler")}
              className="min-h-11 min-w-11 inline-flex items-center justify-center bg-white/5 rounded-lg border border-white/5 text-gray-500 relative touch-manipulation shrink-0"
              aria-label="Bildirimler"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span
                  className={`absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full text-[8px] font-black flex items-center justify-center transition-transform ${badgePulse ? "animate-pulse scale-110 ring-violet-400/80" : ""}`}
                  style={{
                    backgroundColor: LAYOUT_THEME_VARS.PRIMARY,
                    color: LAYOUT_THEME_VARS.TEXT_PRIMARY,
                    boxShadow: `0 0 0 2px ${LAYOUT_THEME_VARS.BACKGROUND}`,
                  }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* ANA İÇERİK - children'ın kendi padding yapısına saygı duyan kapsayıcı */}
        <div className="relative z-0 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <div className="p-4 lg:p-6 pb-[max(1rem,env(safe-area-inset-bottom,0px))] w-full max-w-[1400px] mx-auto">
            <DashboardOfflineShell
              organizationId={organizationId}
              userId={userId}
              organizationFeatures={organizationFeatures}
            />
            {isCoachOrAdmin && !permissionsLoading ? (
              <div className="mb-4">
                <CoachMobileQuickStrip />
              </div>
            ) : null}
            <DashboardBrandingContent>
              {children}
              {process.env.NODE_ENV === "development" ? <PeakerDebugInstaller /> : null}
            </DashboardBrandingContent>
          </div>
        </div>
        </main>
      </div>
    </>
  );
}

export default function DashboardLayoutClient({
  children,
  initialMeAccess = null,
}: DashboardLayoutClientProps) {
  const [meAccessFetchEnabled, setMeAccessFetchEnabled] = useState(Boolean(initialMeAccess));

  return (
    <MeAccessProvider initialMeAccess={initialMeAccess} fetchEnabled={meAccessFetchEnabled}>
      <DashboardLayoutShell
        initialMeAccess={initialMeAccess}
        onEnableMeAccessFetch={() => setMeAccessFetchEnabled(true)}
      >
        {children}
      </DashboardLayoutShell>
    </MeAccessProvider>
  );
}

function NavItem({
  href,
  icon,
  label,
  active,
  variant = "default",
  onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  variant?: "default" | "highlight";
  onNavigate?: () => void;
}) {
  const baseStyles =
    "sidebar-nav-item w-full flex items-center gap-3 px-3 min-h-11 py-2.5 rounded-lg transition-all group text-left font-bold italic tracking-tight text-[12px] touch-manipulation border";
  const itemStyle = buildSidebarNavItemStyle({ active, variant });
  const iconStyle = buildSidebarNavIconStyle({ active, variant });
  const hoverClass =
    variant === "highlight"
      ? "sm:hover:bg-[color-mix(in_srgb,var(--peaker-sidebar-theme-PRIMARY)_15%,transparent)]"
      : "sm:hover:bg-[color-mix(in_srgb,var(--peaker-sidebar-theme-SURFACE)_60%,transparent)] sm:hover:text-[var(--peaker-sidebar-theme-SIDEBAR_ACTIVE)]";

  return (
    <HardNavLink
      href={href}
      className={`block ${baseStyles} ${hoverClass} ${active ? "shadow-md" : "border-transparent"}`}
      style={itemStyle}
      onClick={onNavigate}
    >
      <span
        className="transition-all sm:group-hover:text-[var(--peaker-sidebar-theme-PRIMARY)]"
        style={iconStyle}
      >
        {icon}
      </span>
      {label}
    </HardNavLink>
  );
}