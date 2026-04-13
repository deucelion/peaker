"use client";
import { useState, useEffect, useCallback } from "react";
import { Users, Calendar, Activity, CreditCard, Clock, AlertCircle, BarChart3, Target, Loader2, UserPlus2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addCoach } from "@/lib/actions/coachActions";
import { bootstrapTenantHomeDashboard } from "@/lib/actions/snapshotActions";
import { updateOrganizationDisplayNameAction } from "@/lib/actions/organizationProfileActions";
import { DEFAULT_COACH_PERMISSIONS } from "@/lib/types";
import { toDisplayName } from "@/lib/profile/displayName";
import { normalizeEmailInput } from "@/lib/email/emailNormalize";

// --- TYPESCRIPT INTERFACES ---
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend: string;
  color: string;
}

interface TeamPaymentRow {
  name: string;
  completionRate: number;
  paymentStatus: string;
  warning: boolean;
}

interface RecentTraining {
  id: string;
  title: string;
  start_time: string;
  location: string | null;
}

interface CoachListItem {
  id: string;
  full_name: string;
  email: string | null;
  created_at?: string | null;
}

interface AdminLessonRow {
  id: string;
  title: string;
  start_time: string;
  location: string | null;
  capacity: number | null;
  coach_id: string | null;
  coach_profile?: { full_name?: string | null } | { full_name?: string | null }[] | null;
  training_participants?: Array<{ attendance_status?: string | null }>;
}

interface RecentProgramRow {
  id: string;
  title: string | null;
  created_at: string;
  coach_profile?: { full_name?: string | null } | { full_name?: string | null }[] | null;
  athlete_profile?: { full_name?: string | null } | { full_name?: string | null }[] | null;
}

interface CoachLessonRow {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  capacity: number | null;
  training_participants?: Array<{ attendance_status?: string | null }>;
}

interface CoachProgramRow {
  id: string;
  title: string | null;
  created_at: string;
  is_active: boolean | null;
  athlete_profile?: { full_name?: string | null } | { full_name?: string | null }[] | null;
}

interface CoachNotificationRow {
  id: string;
  message: string;
  read: boolean;
  created_at: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalPlayers: 0,
    activeTrainings: 0,
    attendanceRate: "-",
    monthlyRevenue: "-",
  });
  const [recentActivities, setRecentActivities] = useState<RecentTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState("PEAKER LAB");
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [orgNameSaving, setOrgNameSaving] = useState(false);
  const [orgNameHint, setOrgNameHint] = useState<string | null>(null);
  const [role, setRole] = useState<"super_admin" | "admin" | "coach" | "sporcu">("sporcu");
  const [coaches, setCoaches] = useState<CoachListItem[]>([]);
  const [teamPaymentRows, setTeamPaymentRows] = useState<TeamPaymentRow[]>([]);
  const [coachForm, setCoachForm] = useState({ fullName: "", email: "", password: "" });
  const [coachSubmitting, setCoachSubmitting] = useState(false);
  const [coachFeedback, setCoachFeedback] = useState<string | null>(null);
  const [attendanceTarget, setAttendanceTarget] = useState<number | null>(null);
  const [attendanceTrend, setAttendanceTrend] = useState("VERI YOK");
  const [revenueTrend, setRevenueTrend] = useState("VERI YOK");
  const [coachPermissions, setCoachPermissions] = useState(DEFAULT_COACH_PERMISSIONS);
  const [todayLessons, setTodayLessons] = useState<CoachLessonRow[]>([]);
  const [pendingAttendanceLessons, setPendingAttendanceLessons] = useState<CoachLessonRow[]>([]);
  const [upcomingLessons, setUpcomingLessons] = useState<CoachLessonRow[]>([]);
  const [recentPrograms, setRecentPrograms] = useState<CoachProgramRow[]>([]);
  const [notificationPreview, setNotificationPreview] = useState<CoachNotificationRow[]>([]);
  const [adminTodayLessons, setAdminTodayLessons] = useState<AdminLessonRow[]>([]);
  const [adminPendingAttendance, setAdminPendingAttendance] = useState<AdminLessonRow[]>([]);
  const [adminRecentPrograms, setAdminRecentPrograms] = useState<RecentProgramRow[]>([]);
  const [adminRecentAttendanceUpdates, setAdminRecentAttendanceUpdates] = useState<
    Array<{ training_id: string; marked_at: string | null; athlete_name: string }>
  >([]);
  const [activeCoachCountToday, setActiveCoachCountToday] = useState(0);
  /** Son 7 gün ders sayısı, 30 gün yoklama oranı (işaretlenen), katılımcı sporcu sayısı */
  const [coachOpsMetrics, setCoachOpsMetrics] = useState<{
    lessons7d: number;
    attendanceRate: string;
    activeAthletes: number;
  } | null>(null);
  const router = useRouter();

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const boot = await bootstrapTenantHomeDashboard();
      if ("redirectTo" in boot) {
        router.replace(boot.redirectTo);
        return;
      }
      if ("loadError" in boot) {
        console.error("Dashboard Load Error:", boot.loadError);
        return;
      }
      const snapshot = boot.snapshot;
      if ("error" in snapshot) {
        console.error("Dashboard Load Error:", snapshot.error);
        return;
      }
      setRole((snapshot.role || "sporcu") as "super_admin" | "admin" | "coach" | "sporcu");
      setOrgName(snapshot.orgName || "PEAKER LAB");
      setCurrentOrgId(snapshot.organizationId || null);

      if (snapshot.role === "coach" && snapshot.coach) {
        setCoachPermissions(snapshot.coach.permissions || DEFAULT_COACH_PERMISSIONS);
        setTodayLessons((snapshot.coach.todayLessons || []) as CoachLessonRow[]);
        setUpcomingLessons((snapshot.coach.upcomingLessons || []) as CoachLessonRow[]);
        setPendingAttendanceLessons((snapshot.coach.pendingAttendanceLessons || []) as CoachLessonRow[]);
        setNotificationPreview((snapshot.coach.notificationPreview || []) as CoachNotificationRow[]);
        setRecentPrograms((snapshot.coach.recentPrograms || []) as CoachProgramRow[]);
        setCoachOpsMetrics(snapshot.coach.opsMetrics || null);
        setStats((prev) => ({ ...prev, activeTrainings: snapshot.coach?.activeTrainings || 0 }));
        setLoading(false);
        return;
      }

      if (snapshot.role === "admin" && snapshot.admin) {
        setStats(snapshot.admin.stats || { totalPlayers: 0, activeTrainings: 0, attendanceRate: "-", monthlyRevenue: "-" });
        const attendanceNumeric = Number(snapshot.admin.stats?.attendanceRate ?? "-");
        if (!Number.isNaN(attendanceNumeric) && attendanceNumeric > 0) {
          setAttendanceTarget(Math.max(75, Math.min(98, Math.round(attendanceNumeric + 5))));
        } else {
          setAttendanceTarget(null);
        }
        setAttendanceTrend(snapshot.admin.attendanceTrend || "VERI YOK");
        setRevenueTrend(snapshot.admin.revenueTrend || "VERI YOK");
        setRecentActivities((snapshot.admin.recentActivities || []) as RecentTraining[]);
        setCoaches((snapshot.admin.coaches || []) as CoachListItem[]);
        setTeamPaymentRows((snapshot.admin.teamStats || []) as TeamPaymentRow[]);
        setAdminTodayLessons((snapshot.admin.adminTodayLessons || []) as AdminLessonRow[]);
        setAdminPendingAttendance((snapshot.admin.adminPendingAttendance || []) as AdminLessonRow[]);
        setActiveCoachCountToday(snapshot.admin.activeCoachCountToday || 0);
        setAdminRecentPrograms((snapshot.admin.adminRecentPrograms || []) as RecentProgramRow[]);
        setAdminRecentAttendanceUpdates(snapshot.admin.adminRecentAttendanceUpdates || []);
      }
    } catch (err) {
      console.error("Dashboard Load Error:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  const handleCoachCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCoachSubmitting(true);
    setCoachFeedback(null);

    const fd = new FormData();
    fd.append("fullName", coachForm.fullName);
    fd.append("email", normalizeEmailInput(coachForm.email));
    fd.append("password", coachForm.password);

    const result = await addCoach(fd);
    if (result && "success" in result && result.success) {
      const note =
        "alreadyExisted" in result && result.alreadyExisted
          ? " (zaten kayitli koc; liste senkron)"
          : "repairedOrphan" in result && result.repairedOrphan
            ? " (auth kullanicisi vardi, profil tamamlandi)"
            : "";
      setCoachFeedback(`Coach hesabi basariyla olusturuldu.${note}`);
      setCoachForm({ fullName: "", email: "", password: "" });
      fetchDashboardData();
    } else {
      setCoachFeedback((result && "error" in result && result.error) || "Coach olusturulurken hata olustu.");
    }
    setCoachSubmitting(false);
  };

  const handleOrgNameSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentOrgId) return;
    setOrgNameSaving(true);
    setOrgNameHint(null);
    const result = await updateOrganizationDisplayNameAction(currentOrgId, orgName);
    if (result?.success) {
      setOrgNameHint("Organizasyon adi kaydedildi. Kenar cubugunu guncellemek icin sayfayi yenileyin.");
    } else {
      setOrgNameHint(result?.error || "Ad guncellenemedi.");
    }
    setOrgNameSaving(false);
  };

  if (loading) return (
    <div className="flex min-h-[50dvh] min-w-0 flex-col items-center justify-center space-y-6 overflow-x-hidden px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
      <Loader2 className="animate-spin text-[#7c3aed]" size={40} aria-hidden />
      <span className="animate-pulse text-center text-[9px] font-black uppercase italic tracking-[0.5em] text-white">
        Veri İzolasyonu Sağlanıyor
      </span>
    </div>
  );

  if (role === "super_admin") return null;

  if (role === "coach") {
    return (
      <div className="ui-page min-w-0 overflow-x-hidden animate-in fade-in duration-700">
        <header className="flex min-w-0 flex-col justify-between gap-6 border-b border-white/5 pb-6 md:flex-row md:items-end">
          <div className="min-w-0">
            <h1 className="ui-h1">
              GUNLUK <span className="text-[#7c3aed]">OPERASYON</span>
            </h1>
            <p className="ui-lead break-words">
              {orgName} • Bugun ne yapmaliyim paneli
            </p>
          </div>
          <div className="grid grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-[10px] font-black uppercase w-full min-w-0">
            <span className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300">BUGUN {todayLessons.length}</span>
            <span className="px-3 py-2 rounded-xl bg-[#7c3aed]/10 border border-[#7c3aed]/20 text-[#c4b5fd]">BEKLEYEN {pendingAttendanceLessons.length}</span>
            {coachOpsMetrics && (
              <>
                <span className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300">7G DERS {coachOpsMetrics.lessons7d}</span>
                <span className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sky-300">YOKLAMA {coachOpsMetrics.attendanceRate}</span>
                <span className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-emerald-300">SPORCU {coachOpsMetrics.activeAthletes}</span>
              </>
            )}
          </div>
        </header>

        <section className="ui-card min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 min-w-0">
            <h3 className="ui-h2-sm shrink-0">Bugünkü Derslerim</h3>
            {coachPermissions.can_create_lessons && (
              <Link href="/dersler" className="inline-flex justify-center px-3 py-2.5 sm:py-2 rounded-xl bg-[#7c3aed] sm:hover:bg-[#6d28d9] text-white text-[10px] font-black uppercase touch-manipulation shrink-0">
                Ders Oluştur
              </Link>
            )}
          </div>
          {todayLessons.length === 0 ? (
            <p className="text-gray-500 text-[10px] font-black uppercase italic">Bugun planli ders yok.</p>
          ) : (
            <div className="grid gap-3">
              {todayLessons.map((lesson) => {
                const participantCount = (lesson.training_participants || []).length;
                const pending = (lesson.training_participants || []).filter((p) => (p.attendance_status || "registered") === "registered").length;
                return (
                  <div key={lesson.id} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-black italic uppercase break-words">{lesson.title}</p>
                      <p className="text-[10px] text-gray-500 font-bold italic break-words">
                        {new Date(lesson.start_time).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} • {lesson.location || "Ana Saha"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase">
                      <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-gray-300">
                        {participantCount}/{lesson.capacity || 0}
                      </span>
                      <span className={`px-3 py-1 rounded-xl border ${pending === 0 ? "text-green-400 border-green-500/20 bg-green-500/10" : "text-amber-300 border-amber-500/20 bg-amber-500/10"}`}>
                        {pending === 0 ? "YOKLAMA ALINDI" : `${pending} BEKLIYOR`}
                      </span>
                      <Link href={`/dersler/${lesson.id}`} className="inline-flex min-h-10 items-center rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-gray-300 touch-manipulation">
                        DETAY
                      </Link>
                      {coachPermissions.can_take_attendance && (
                        <Link href={`/antrenman-yonetimi?trainingId=${lesson.id}`} className="inline-flex min-h-10 items-center rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/10 px-3 py-1 text-[#c4b5fd] touch-manipulation">
                          YOKLAMA
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {coachPermissions.can_take_attendance && (
          <section className="ui-card">
            <h3 className="ui-h2-sm mb-4">Yoklama Bekleyen Dersler</h3>
            {pendingAttendanceLessons.length === 0 ? (
              <p className="text-gray-500 text-[10px] font-black uppercase italic">Bekleyen yoklama yok.</p>
            ) : (
              <div className="grid gap-2">
                {pendingAttendanceLessons.map((lesson) => (
                  <Link key={lesson.id} href={`/antrenman-yonetimi?trainingId=${lesson.id}`} className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-amber-300 text-[10px] font-black uppercase break-words touch-manipulation min-h-11 flex items-center">
                    {lesson.title} • HIZLI YOKLAMA
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="ui-card">
          <h3 className="ui-h2-sm mb-4">Yaklaşan Dersler</h3>
          {upcomingLessons.length === 0 ? (
            <p className="text-gray-500 text-[10px] font-black uppercase italic">Yaklaşan ders bulunmuyor.</p>
          ) : (
            <div className="grid gap-2">
              {upcomingLessons.map((lesson) => (
                <div key={lesson.id} className="bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3 min-w-0">
                  <p className="text-white text-sm font-black italic uppercase break-words">{lesson.title}</p>
                  <p className="text-[10px] text-gray-500 font-bold italic break-words">
                    {new Date(lesson.start_time).toLocaleString("tr-TR")} • {lesson.location || "Ana Saha"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {coachPermissions.can_manage_training_notes && (
          <section className="ui-card min-w-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 min-w-0">
              <h3 className="ui-h2-sm shrink-0">Sporcu / Program Akisi</h3>
              <Link href="/notlar-haftalik-program" className="inline-flex justify-center px-3 py-2.5 sm:py-2 rounded-xl bg-[#7c3aed] sm:hover:bg-[#6d28d9] text-white text-[10px] font-black uppercase touch-manipulation shrink-0">
                Yeni Program Yaz
              </Link>
            </div>
            {recentPrograms.length === 0 ? (
              <p className="text-gray-500 text-[10px] font-black uppercase italic">Son program kaydi bulunmuyor.</p>
            ) : (
              <div className="grid gap-2">
                {recentPrograms.map((program) => {
                  const athlete = Array.isArray(program.athlete_profile) ? program.athlete_profile[0] : program.athlete_profile;
                  return (
                    <div key={program.id} className="bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3 min-w-0">
                      <p className="text-white text-sm font-black italic uppercase break-words">{program.title || "Program"}</p>
                      <p className="text-[10px] text-gray-500 font-bold italic break-words">
                        Sporcu: {toDisplayName(athlete?.full_name, undefined, "Sporcu")} • {new Date(program.created_at).toLocaleString("tr-TR")}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <section className="ui-card min-w-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4 min-w-0">
            <h3 className="ui-h2-sm shrink-0">Bildirimler</h3>
            <Link href="/bildirimler" className="text-[#7c3aed] text-[10px] font-black uppercase py-2 sm:py-0 touch-manipulation shrink-0">
              TUMUNU GOR
            </Link>
          </div>
          {notificationPreview.length === 0 ? (
            <p className="text-gray-500 text-[10px] font-black uppercase italic">Bildirim bulunmuyor.</p>
          ) : (
            <div className="grid gap-2">
              {notificationPreview.map((n) => (
                <div key={n.id} className={`rounded-xl px-4 py-3 border min-w-0 ${n.read ? "bg-white/[0.02] border-white/5" : "bg-[#7c3aed]/10 border-[#7c3aed]/20"}`}>
                  <p className="text-white text-xs font-black italic break-words">{n.message}</p>
                  <p className="text-[10px] text-gray-500 font-bold italic">{new Date(n.created_at).toLocaleString("tr-TR")}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="ui-page min-w-0 overflow-x-hidden animate-in fade-in duration-700">
      {/* HEADER - Font boyutu text-7xl'den 5xl'e çekildi */}
      <header className="flex min-w-0 flex-col justify-between gap-6 border-b border-white/5 pb-8 md:flex-row md:items-end">
        <div className="min-w-0">
          <h1 className="ui-h1">
            AKADEMİ <span className="text-[#7c3aed]">PANELİ</span>
          </h1>
          <p className="ui-lead break-words">
            {orgName} • Performans Yönetim Merkezi
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 bg-[#121215] border border-white/5 px-4 py-3 rounded-xl shadow-xl min-w-0 max-w-full">
          <div className="w-10 h-10 shrink-0 bg-green-500/10 rounded-lg flex items-center justify-center text-green-500">
            <Target size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest leading-none mb-1">HEDEF</p>
            <p className="text-base font-black italic text-white leading-none break-words">
              {attendanceTarget === null ? "VERI YOK" : `%${attendanceTarget} KATILIM`}
            </p>
          </div>
        </div>
      </header>

      {/* STAT CARDS - Grid Gap ve Padding optimize edildi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 min-w-0">
        <StatCard 
          icon={<Users size={20} />} 
          label="Toplam Sporcu" 
          value={stats.totalPlayers} 
          trend="ORGANIZASYON" 
          color="from-[#7c3aed] to-[#4c1d95]" 
        />
        <StatCard
          icon={<UserPlus2 size={20} />}
          label="Aktif Koç"
          value={coaches.length}
          trend={`${activeCoachCountToday} BUGUN DERSI VAR`}
          color="from-cyan-500 to-blue-900"
        />
        <StatCard 
          icon={<Calendar size={20} />} 
          label="Bugünkü Ders"
          value={stats.activeTrainings} 
          trend={`${adminPendingAttendance.length} YOKLAMA BEKLIYOR`}
          color="from-blue-600 to-indigo-900" 
        />
        <StatCard 
          icon={<Activity size={20} />} 
          label="Katılım Oranı" 
          value={stats.attendanceRate === "-" ? "-" : `%${stats.attendanceRate}`} 
          trend={attendanceTrend}
          color="from-orange-500 to-red-800" 
        />
        <StatCard 
          icon={<CreditCard size={20} />} 
          label="Aylık Ciro" 
          value={stats.monthlyRevenue === "-" ? "-" : `₺${stats.monthlyRevenue}`} 
          trend={revenueTrend}
          color="from-emerald-500 to-green-900" 
        />
        <StatCard
          icon={<AlertCircle size={20} />}
          label="Bekleyen Yoklama"
          value={adminPendingAttendance.length}
          trend={adminPendingAttendance.length > 0 ? "AKSİYON GEREKLİ" : "TEMİZ"}
          color="from-amber-500 to-orange-900"
        />
        <StatCard
          icon={<Clock size={20} />}
          label="Son Yoklama Kayıtları"
          value={adminRecentAttendanceUpdates.length}
          trend="LISTEDE EN FAZLA 5"
          color="from-fuchsia-500 to-purple-900"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-w-0">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-8 space-y-6 min-w-0">
          <section className="ui-card min-w-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 min-w-0">
              <h3 className="ui-h2 min-w-0 break-words">Bugünkü Operasyon Özeti</h3>
              <Link href="/dersler" className="text-[#7c3aed] text-[10px] font-black uppercase tracking-widest py-2 sm:py-0 touch-manipulation shrink-0">
                DERSLER
              </Link>
            </div>
            {adminTodayLessons.length > 0 ? (
              <div className="grid gap-3">
                {adminTodayLessons.map((lesson) => {
                  const coach = Array.isArray(lesson.coach_profile) ? lesson.coach_profile[0] : lesson.coach_profile;
                  const pendingCount = (lesson.training_participants || []).filter((p) => (p.attendance_status || "registered") === "registered").length;
                  const totalParticipants = (lesson.training_participants || []).length;
                  return (
                    <div key={lesson.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-black italic uppercase break-words">{lesson.title}</p>
                        <p className="text-[10px] text-gray-500 font-bold italic break-words">
                          {new Date(lesson.start_time).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} • {toDisplayName(coach?.full_name, undefined, "Koç")} • {lesson.location || "Ana Saha"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase">
                        <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-gray-300">{totalParticipants}/{lesson.capacity || 0}</span>
                        <span className={`px-3 py-1 rounded-xl border ${pendingCount > 0 ? "text-amber-300 border-amber-500/20 bg-amber-500/10" : "text-green-400 border-green-500/20 bg-green-500/10"}`}>
                          {pendingCount > 0 ? `${pendingCount} BEKLIYOR` : "TAMAMLANDI"}
                        </span>
                        <Link href={`/antrenman-yonetimi?trainingId=${lesson.id}`} className="inline-flex min-h-10 items-center rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/10 px-3 py-1 text-[#c4b5fd] touch-manipulation">YOKLAMA</Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10">
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest italic">Bugun planli ders yok.</p>
                <Link href="/dersler" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#7c3aed] px-4 py-2 text-[10px] font-black uppercase text-white touch-manipulation">İlk Dersi Oluştur</Link>
              </div>
            )}
          </section>

          <section className="ui-card relative overflow-hidden min-w-0">
            <h3 className="ui-h2 flex flex-wrap items-center gap-3 mb-8 relative z-10 min-w-0">
              <BarChart3 className="text-[#7c3aed] shrink-0" size={24} /> <span className="break-words">Coach / Ekip Durumu</span>
            </h3>
            <div className="space-y-6 relative z-10">
              {coaches.length > 0 ? (
                coaches.slice(0, 5).map((coach) => {
                  const todayLoad = adminTodayLessons.filter((lesson) => lesson.coach_id === coach.id).length;
                  const pendingCount = adminTodayLessons
                    .filter((lesson) => lesson.coach_id === coach.id)
                    .reduce(
                      (sum, lesson) =>
                        sum +
                        (lesson.training_participants || []).filter(
                          (participant) => (participant.attendance_status || "registered") === "registered"
                        ).length,
                      0
                    );
                  return (
                    <div key={coach.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-4 border-b border-white/5 last:border-0 min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-black italic text-base uppercase tracking-tight break-words">{toDisplayName(coach.full_name, coach.email, "Koç")}</p>
                        <p className="break-all text-[9px] font-bold uppercase italic tracking-widest text-gray-600 sm:break-normal sm:truncate">{coach.email || "E-POSTA YOK"}</p>
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        <p className="text-[10px] font-black text-[#7c3aed] uppercase">{todayLoad} DERS</p>
                        <p className={`text-[9px] font-black uppercase ${pendingCount > 0 ? "text-amber-300" : "text-green-400"}`}>
                          {pendingCount > 0 ? `${pendingCount} BEKLEYEN` : "TEMIZ"}
                        </p>
                        <Link href={`/koclar/${coach.id}`} className="inline-flex min-h-10 items-center text-[9px] font-black uppercase text-gray-500 touch-manipulation">DETAY</Link>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-gray-500 italic text-center py-2 uppercase font-black text-[10px] tracking-widest">
                  Koç verisi bulunamadı.
                </p>
              )}
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#7c3aed]/5 rounded-full blur-[100px]" />
          </section>

          {teamPaymentRows.length > 0 && (
            <section className="ui-card min-w-0">
              <h3 className="ui-h2 flex flex-wrap items-center gap-3 mb-6 min-w-0">
                <CreditCard className="text-[#7c3aed] shrink-0" size={22} /> <span className="break-words">Takım tahsilat özeti</span>
              </h3>
              <div className="space-y-3">
                {teamPaymentRows.slice(0, 5).map((row) => (
                  <div
                    key={row.name}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-3 border-b border-white/5 last:border-0 min-w-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-black italic text-sm uppercase tracking-tight break-words">{row.name}</p>
                      <p className="text-[9px] text-gray-600 font-bold uppercase italic tracking-widest">
                        Tamamlanma %{row.completionRate}
                      </p>
                    </div>
                    <p
                      className={`text-[10px] font-black italic uppercase shrink-0 sm:text-right ${
                        row.warning ? "text-red-400" : "text-green-400"
                      }`}
                    >
                      {row.paymentStatus}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="ui-card min-w-0">
            <h3 className="ui-h2 mb-8 break-words">Son Operasyonlar</h3>
            <div className="grid gap-4">
              {recentActivities.length > 0 ? recentActivities.slice(0, 3).map((t, i) => (
                <div key={t.id || i} className="p-4 rounded-[1.25rem] bg-white/[0.02] border border-white/5 min-w-0">
                  <p className="text-white font-black italic uppercase text-sm break-words">DERS: {t.title}</p>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest italic break-words">
                    {new Date(t.start_time).toLocaleDateString('tr-TR')} • {t.location || "Merkez"}
                  </p>
                </div>
              )) : (
                <p className="text-gray-500 italic text-center py-6 uppercase font-black text-[10px] tracking-widest">Ders hareketi yok</p>
              )}
              {adminRecentPrograms.slice(0, 2).map((p) => {
                const coach = Array.isArray(p.coach_profile) ? p.coach_profile[0] : p.coach_profile;
                const athlete = Array.isArray(p.athlete_profile) ? p.athlete_profile[0] : p.athlete_profile;
                return (
                  <div key={p.id} className="p-4 rounded-[1.25rem] bg-white/[0.02] border border-white/5 min-w-0">
                    <p className="text-white font-black italic uppercase text-sm break-words">PROGRAM: {p.title || "Program"}</p>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest italic break-words">
                      {toDisplayName(coach?.full_name, undefined, "Koç")} {"->"} {toDisplayName(athlete?.full_name, undefined, "Sporcu")} • {new Date(p.created_at).toLocaleDateString("tr-TR")}
                    </p>
                  </div>
                );
              })}
              {adminRecentAttendanceUpdates.slice(0, 2).map((item) => (
                <div
                  key={`${item.training_id}-${item.marked_at ?? "x"}`}
                  className="p-4 rounded-[1.25rem] bg-white/[0.02] border border-white/5 min-w-0"
                >
                  <p className="text-white font-black italic uppercase text-sm">YOKLAMA GUNCELLENDI</p>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest italic break-words">
                    {item.athlete_name} •{" "}
                    {item.marked_at ? new Date(item.marked_at).toLocaleString("tr-TR") : "—"}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-4 space-y-6 min-w-0">
          {role === "admin" && currentOrgId && (
            <div className="bg-[#121215] border border-white/10 p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl min-w-0">
              <h3 className="ui-h2 !text-lg mb-4">Organizasyon adi</h3>
              <p className="text-[10px] text-gray-500 font-bold mb-3 leading-relaxed">
                Panel başlığında ve raporlarda görünen isim. Super admin de tüm organizasyonlar için adı değiştirebilir.
              </p>
              <form onSubmit={handleOrgNameSave} className="space-y-3">
                <input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="min-h-11 w-full min-w-0 touch-manipulation rounded-2xl border border-white/10 bg-[#1c1c21] px-4 py-3 text-base font-bold italic text-white outline-none focus:border-[#7c3aed]/60 sm:text-xs"
                  minLength={2}
                  maxLength={120}
                  required
                />
                <button
                  type="submit"
                  disabled={orgNameSaving}
                  className="w-full min-h-11 bg-white/10 sm:hover:bg-white/15 border border-white/15 text-white py-2.5 rounded-2xl text-[10px] font-black uppercase disabled:opacity-50 touch-manipulation"
                >
                  {orgNameSaving ? "Kaydediliyor..." : "Adi kaydet"}
                </button>
              </form>
              {orgNameHint && <p className="mt-2 break-words text-[10px] font-bold text-gray-400">{orgNameHint}</p>}
            </div>
          )}
          {role === "admin" && (
            <div className="bg-[#121215] border border-white/10 p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl min-w-0">
              <h3 className="ui-h2 !text-lg mb-5 flex flex-wrap items-center gap-3 min-w-0">
                <UserPlus2 size={18} className="text-[#7c3aed] shrink-0" /> <span className="break-words">Koç Yönetimi</span>
              </h3>

              <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 min-w-0">
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                  <p className="text-[9px] text-gray-600 font-black uppercase">TOPLAM KOC</p>
                  <p className="text-2xl text-white font-black italic">{coaches.length}</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                  <p className="text-[9px] text-gray-600 font-black uppercase">BUGUN AKTIF</p>
                  <p className="text-2xl text-white font-black italic">{activeCoachCountToday}</p>
                </div>
              </div>

              <form onSubmit={handleCoachCreate} className="space-y-3">
                <input
                  required
                  value={coachForm.fullName}
                  onChange={(e) => setCoachForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  placeholder="AD SOYAD"
                  className="min-h-11 w-full min-w-0 touch-manipulation rounded-2xl border border-white/10 bg-[#1c1c21] px-4 py-3 text-base font-bold uppercase italic text-white outline-none focus:border-[#7c3aed]/60 sm:text-xs"
                />
                <input
                  required
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  value={coachForm.email}
                  onChange={(e) => setCoachForm((prev) => ({ ...prev, email: normalizeEmailInput(e.target.value) }))}
                  placeholder="E-POSTA"
                  className="min-h-11 w-full min-w-0 touch-manipulation rounded-2xl border border-white/10 bg-[#1c1c21] px-4 py-3 text-base font-bold italic text-white outline-none focus:border-[#7c3aed]/60 sm:text-xs"
                />
                <input
                  required
                  type="text"
                  autoComplete="new-password"
                  minLength={6}
                  value={coachForm.password}
                  onChange={(e) => setCoachForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="GECICI SIFRE (EN AZ 6)"
                  className="min-h-11 w-full min-w-0 touch-manipulation rounded-2xl border border-white/10 bg-[#1c1c21] px-4 py-3 text-base font-bold uppercase italic text-white outline-none focus:border-[#7c3aed]/60 sm:text-xs"
                />

                <button
                  type="submit"
                  disabled={coachSubmitting}
                  className="w-full min-h-11 bg-[#7c3aed] sm:hover:bg-[#6d28d9] disabled:opacity-60 text-white py-3 rounded-2xl text-[10px] font-black italic uppercase tracking-[0.2em] transition-all touch-manipulation"
                >
                  {coachSubmitting ? "OLUSTURULUYOR..." : "YENI KOC EKLE"}
                </button>
              </form>

              {coachFeedback && (
                <p className="mt-3 break-words text-[10px] font-bold uppercase italic tracking-wider text-gray-300">{coachFeedback}</p>
              )}

              <div className="mt-5 pt-5 border-t border-white/10 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {coaches.length > 0 ? (
                  coaches.slice(0, 5).map((coach) => (
                    <div key={coach.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black italic text-white uppercase break-words">{toDisplayName(coach.full_name, coach.email, "Koç")}</p>
                        <p className="text-[9px] font-bold text-gray-500 italic truncate">{coach.email}</p>
                      </div>
                      <Link href={`/koclar/${coach.id}`} className="text-[9px] text-[#7c3aed] font-black uppercase shrink-0 touch-manipulation py-1">
                        DETAY
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-3">
                    <p className="text-[10px] text-gray-500 font-bold italic uppercase">Henuz koc yok.</p>
                    <Link href="/koclar" className="mt-2 inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase text-gray-300 touch-manipulation">
                      Koçlar Sayfası
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-gradient-to-br from-[#1c1c21] to-[#121215] border border-white/10 p-5 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] relative group cursor-pointer overflow-hidden shadow-2xl min-w-0">
             <h3 className="ui-h2 mb-3 leading-none">Uyarı / Aksiyon</h3>
             <div className="space-y-2 text-[10px] font-bold italic uppercase tracking-wider">
               {adminPendingAttendance.length > 0 ? (
                 <p className="text-amber-300">{adminPendingAttendance.length} dersin yoklamasi eksik.</p>
               ) : (
                 <p className="text-green-400">Yoklama tarafinda kritik bekleyen yok.</p>
               )}
               {coaches.length === 0 && <p className="text-red-400">Sistemde koc yok, once koc ekleyin.</p>}
              {stats.totalPlayers === 0 && <p className="text-red-400">Sistemde sporcu yok, sporcu ekleyin.</p>}
               {adminTodayLessons.length === 0 && <p className="text-gray-400">Bugun ders plani yok.</p>}
             </div>
             <div className="mt-6 flex flex-wrap gap-2">
               <Link href="/dersler" className="inline-flex min-h-10 items-center px-3 py-2 rounded-xl bg-white/10 text-white text-[10px] font-black uppercase touch-manipulation">DERSLER</Link>
              <Link href="/oyuncular" className="inline-flex min-h-10 items-center px-3 py-2 rounded-xl bg-white/10 text-white text-[10px] font-black uppercase touch-manipulation">SPORCULAR</Link>
               <Link href="/koclar" className="inline-flex min-h-10 items-center px-3 py-2 rounded-xl bg-white/10 text-white text-[10px] font-black uppercase touch-manipulation">KOCLAR</Link>
             </div>
          </div>

          <div className="group relative min-w-0 overflow-hidden rounded-[2rem] bg-[#7c3aed] p-5 shadow-2xl sm:rounded-[2.5rem] sm:p-8">
             <div className="absolute -bottom-4 -right-4 opacity-10 transition-transform sm:group-hover:scale-110">
               <AlertCircle size={120} aria-hidden />
             </div>
             <h3 className="mb-3 break-words text-2xl font-black uppercase leading-[0.9] tracking-tighter text-white italic">İzolasyon <br/>Sistemi</h3>
             <p className="mb-8 break-words text-[9px] font-bold uppercase italic tracking-widest text-white/80">
               Verileriniz sadece size özel filtrelenir.
             </p>
             <Link href="/performans/ayarlar" className="block w-full min-h-12 bg-white text-[#7c3aed] py-4 rounded-xl font-black italic text-[10px] uppercase tracking-widest sm:hover:brightness-90 transition-all shadow-xl text-center touch-manipulation">
               GÜVENLİK
             </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTS - StatCard font text-5xl'den 4xl'e indirildi ---
function StatCard({ icon, label, value, trend, color }: StatCardProps) {
  return (
    <div className="ui-card !p-5 sm:!p-7 relative overflow-hidden group sm:hover:border-[#7c3aed]/30 transition-all min-w-0">
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white mb-4 sm:mb-6 shadow-xl`}>
        {icon}
      </div>
      <p className="ui-label text-gray-500 mb-1 leading-none break-words">{label}</p>
      <h2 className="min-w-0 break-words text-3xl font-black italic leading-none tracking-tighter text-white transition-colors sm:group-hover:text-[#7c3aed] sm:text-4xl">
        {value}
      </h2>
      <div className="flex items-start gap-2 mt-4 sm:mt-5 min-w-0">
        <div className="h-[1px] w-3 bg-[#7c3aed]/30 shrink-0 mt-1.5"></div>
        <p className="text-[9px] font-black text-[#7c3aed] uppercase italic tracking-[0.2em] break-words">{trend}</p>
      </div>
    </div>
  );
}
