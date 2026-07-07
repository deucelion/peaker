"use client";
import { useState, useEffect } from "react";
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
import { fetchMeAccessClient } from "@/lib/auth/meAccessClient";
import { useUnreadNotificationsLive } from "@/lib/hooks/useUnreadNotificationsLive";
import { PATHS } from "@/lib/navigation/routeRegistry";
import { hrefTahsilatKaydet } from "@/lib/finance/tahsilatMerkeziLinks";
import type { CoachPermissions, AthletePermissions } from "@/lib/types";
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { unreadCount, badgePulse } = useUnreadNotificationsLive();
  const [coachPermissions, setCoachPermissions] = useState<CoachPermissions | null>(null);
  const [athletePermissions, setAthletePermissions] = useState<AthletePermissions | null>(null);
  const [organizationName, setOrganizationName] = useState("PEAKER");
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  const isSuperAdminRoute =
    pathname === PATHS.superAdmin ||
    pathname.startsWith(`${PATHS.superAdmin}/`) ||
    pathname === PATHS.sistemSaglik;

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
              if (isSuperAdminRoute) {
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
          setRole(payload.role);
          setUserName(payload.fullName || "Peaker User");
          setOrganizationId(payload.organizationId ?? null);
          setUserId(payload.userId ?? null);
          setPermissionsLoading(true);
          setCoachPermissions(null);
          setAthletePermissions(null);
          const accessPayload = await fetchMeAccessClient();
          if (!cancelled && accessPayload.ok) {
            if (payload.role === "coach") {
              setCoachPermissions(accessPayload.coachPermissions || DEFAULT_COACH_PERMISSIONS);
            } else if (payload.role === "sporcu") {
              setAthletePermissions(accessPayload.athletePermissions || DEFAULT_ATHLETE_PERMISSIONS);
            }
          }
          if (!cancelled) setPermissionsLoading(false);
          setOrganizationName(payload.organizationName ?? "");
          setLoading(false);
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
  }, [router, pathname, isSuperAdminRoute]);

  const handleLogout = async () => {
    await clearAllOfflineActions();
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
  };

  const visibleNav = (section: NavSection) =>
    DASHBOARD_NAV_ITEMS.filter((item) => item.section === section && isDashboardNavItemVisible(item, navCtx));
  const quickActions =
    isCoachOrAdmin && !permissionsLoading
      ? [
          ...(safeRole === "admin"
            ? [
                { label: "Grup Dersi Planla", href: "/antrenman-yonetimi?modul=grup-dersleri&view=ders-olustur" },
                { label: "Özel Ders Planla", href: "/antrenman-yonetimi?modul=ozel-dersler&view=planlama" },
                { label: "Yoklama Aç", href: "/antrenman-yonetimi?modul=grup-dersleri&view=yoklama" },
                { label: "Sporcu Ekle", href: "/sporcular/yeni" },
                { label: "Tahsilat Kaydet", href: hrefTahsilatKaydet() },
                { label: "Saha Testi Girişi", href: hrefFieldTestSession(todayFieldTestSessionDate()) },
              ]
            : []),
          ...(safeRole === "coach" && coachPermissions?.can_create_lessons
            ? [{ label: "Grup Dersi Planla", href: "/antrenman-yonetimi?modul=grup-dersleri&view=ders-olustur" }]
            : []),
          ...(safeRole === "coach" && coachPermissions?.can_manage_training_notes
            ? [{ label: "Özel Ders Planla", href: "/antrenman-yonetimi?modul=ozel-dersler&view=planlama" }]
            : []),
          ...(safeRole === "coach" && coachPermissions?.can_take_attendance
            ? [{ label: "Yoklama Aç", href: "/antrenman-yonetimi?modul=grup-dersleri&view=yoklama" }]
            : []),
          ...(safeRole === "coach" && coachPermissions?.can_manage_athlete_profiles
            ? [{ label: "Sporcu Ekle", href: "/sporcular/yeni" }]
            : []),
          ...(safeRole === "coach" && coachPermissions?.can_view_reports
            ? [
                { label: "Tahsilat Kaydet", href: PATHS.finans },
                { label: "Saha Testi Girişi", href: hrefFieldTestSession(todayFieldTestSessionDate()) },
              ]
            : []),
        ]
      : [];

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="h-[100dvh] bg-[#09090b] flex flex-col items-center justify-center text-[#7c3aed]">
        <Loader2 className="animate-spin mb-4" size={40} />
        <span className="text-[10px] font-black uppercase tracking-[0.5em] italic">SENKRONİZE EDİLİYOR</span>
      </div>
    );
  }

  const closeMobileSidebar = () => setIsSidebarOpen(false);

  const sidebarBody = (onNavigate?: () => void) => (
    <>
      <div className="flex items-center gap-2.5 p-6 mb-4">
        <div className="w-8 h-8 bg-[#7c3aed] rounded-lg flex items-center justify-center font-black italic text-base text-white shadow-lg shadow-[#7c3aed]/20">P</div>
        <div className="flex flex-col text-white">
          <span className="text-xl font-black tracking-tighter italic leading-none">{organizationName}<span className="text-[#7c3aed]">.</span></span>
          <span className="text-[8px] text-gray-600 font-bold tracking-[0.2em] uppercase mt-0.5">Powered by Peaker</span>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-4 text-sm overflow-y-auto custom-scrollbar">
        {isSuperAdmin && (
          <div className="mb-6">
            <p className="text-[9px] font-black text-gray-700 uppercase tracking-[0.2em] mb-3 ml-2 italic opacity-40">SYSTEM OWNER</p>
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
            <p className="text-[9px] font-black text-gray-700 uppercase tracking-[0.2em] mb-3 ml-2 italic opacity-40">İŞ AKIŞLARI</p>
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
            <p className="text-[9px] font-black text-gray-700 uppercase tracking-[0.2em] mb-3 ml-2 italic opacity-40">SPORCU ERİŞİMİ</p>
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

      <div className="p-4 border-t border-white/5 space-y-0.5">
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
            className="fixed left-0 top-[env(safe-area-inset-top,0px)] bottom-[env(safe-area-inset-bottom,0px)] z-[110] flex w-64 flex-col border-r border-white/5 bg-[#0b0b0d] lg:hidden dashboard-shell-chrome"
          >
            {sidebarBody(closeMobileSidebar)}
          </aside>
        </>
      ) : null}

      <div className="flex min-h-[100dvh] bg-[#09090b]">
        <aside className="dashboard-shell-chrome hidden w-64 shrink-0 flex-col border-r border-white/5 bg-[#0b0b0d] lg:flex">
          {sidebarBody()}
        </aside>

        <main className="relative z-0 flex min-w-0 flex-1 flex-col bg-[#09090b] pt-[env(safe-area-inset-top,0px)] lg:pt-0">
        <header className="dashboard-shell-chrome flex min-h-16 shrink-0 items-center justify-between border-b border-white/5 bg-[#09090b]/95 px-4 sm:px-6">
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
                  <div className="absolute right-0 z-30 mt-2 min-w-56 rounded-xl border border-white/10 bg-[#121215] p-1 shadow-2xl">
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
                <Trophy size={8} className="text-[#7c3aed]" />
                <span className="text-[7px] font-black italic uppercase tracking-[0.15em] text-gray-500">
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
                  className={`absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-[#7c3aed] text-white rounded-full ring-2 ring-[#09090b] text-[8px] font-black flex items-center justify-center transition-transform ${badgePulse ? "animate-pulse scale-110 ring-violet-400/80" : ""}`}
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
            <DashboardOfflineShell organizationId={organizationId} userId={userId} />
            {isCoachOrAdmin && !permissionsLoading ? (
              <div className="mb-4">
                <CoachMobileQuickStrip />
              </div>
            ) : null}
            {children}
            {process.env.NODE_ENV === "development" ? <PeakerDebugInstaller /> : null}
          </div>
        </div>
        </main>
      </div>
    </>
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
    "w-full flex items-center gap-3 px-3 min-h-11 py-2.5 rounded-lg transition-all group text-left font-bold italic tracking-tight text-[12px] touch-manipulation";
  const variants: Record<"default" | "highlight", string> = {
    default: active ? 'bg-[#7c3aed]/10 text-white border border-white/5 shadow-md' : 'text-gray-500 sm:hover:text-white sm:hover:bg-white/5',
    highlight: active ? 'bg-[#7c3aed] text-white shadow-lg shadow-[#7c3aed]/20' : 'bg-[#7c3aed]/5 text-[#7c3aed] border border-[#7c3aed]/10 sm:hover:bg-[#7c3aed]/10'
  };

  return (
    <HardNavLink href={href} className={`block ${baseStyles} ${variants[variant]}`} onClick={onNavigate}>
      <span className={`${active ? 'text-[#7c3aed]' : 'text-gray-500 sm:group-hover:text-[#7c3aed]'} transition-all`}>
        {icon}
      </span>
      {label}
    </HardNavLink>
  );
}