"use client";
import Image from "next/image";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Eye, EyeOff, Search, Loader2, User, Lock, ShieldCheck, Mail, CheckCircle2 } from "lucide-react";
import type { ProfileBasic } from "@/types/domain";
import Notification from "@/components/Notification";
import type { AthletePermissionKey, AthletePermissions } from "@/lib/types";
import { DEFAULT_ATHLETE_PERMISSIONS } from "@/lib/types";
import { listAthletesWithPermissionsForSettings, updateAthletePermissions } from "@/lib/actions/athletePermissionActions";
import { fetchMeRoleClient } from "@/lib/auth/meRoleClient";
import { PATHS } from "@/lib/navigation/routeRegistry";

interface AthleteProfile extends ProfileBasic {
  permissions?: AthletePermissions;
}

interface UserProfile extends ProfileBasic {
  email?: string | null;
}

export default function AyarlarPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("profil");
  const [athletes, setAthletes] = useState<AthleteProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [mailSent, setMailSent] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null); // Hangi sporcu güncelleniyor?
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  const [canManageVisibility, setCanManageVisibility] = useState(false);

  const checkUser = useCallback(async () => {
    setLoading(true);
    try {
      const rolePayload = await fetchMeRoleClient();
      if (!rolePayload.ok) {
        if (rolePayload.httpStatus === 403) {
          if (rolePayload.error === "admin_inactive") {
            router.replace(PATHS.adminAccount);
            return;
          }
          if (rolePayload.error === "coach_inactive") {
            router.replace(PATHS.coachAccount);
            return;
          }
          if (rolePayload.error === "athlete_inactive") {
            router.replace(PATHS.athleteAccount);
            return;
          }
          if (rolePayload.error === "organization_blocked") {
            if (rolePayload.gateStatus) {
              router.replace(`${PATHS.orgDurumu}?reason=${encodeURIComponent(rolePayload.gateStatus)}`);
            } else {
              router.replace(PATHS.orgDurumu);
            }
            return;
          }
        }
        setSecurityMessage("Profil bilgisi alinamadi.");
        return;
      }
      const resolvedRole = rolePayload.role;
      setRole(resolvedRole);
      setUserProfile({
        id: rolePayload.userId,
        full_name: rolePayload.fullName ?? null,
        organization_id: rolePayload.organizationId ?? null,
        email: rolePayload.email ?? null,
      } as UserProfile);

      if (resolvedRole === "coach" || resolvedRole === "admin") {
        setActiveTab("yetkiler");
        const listRes = await listAthletesWithPermissionsForSettings();
        if ("error" in listRes) {
          setSecurityMessage(listRes.error ?? "Sporcu listesi yuklenemedi.");
          setAthletes([]);
          setCanManageVisibility(false);
        } else {
          setAthletes(listRes.athletes as unknown as AthleteProfile[]);
          setCanManageVisibility(listRes.canManageVisibility);
        }
      } else {
        setActiveTab("profil");
      }
    } catch (err) {
      console.error("Kullanıcı kontrol hatası:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void checkUser();
  }, [checkUser]);

  const handlePasswordReset = async () => {
    try {
      if (userProfile?.email) {
        const { error } = await supabase.auth.resetPasswordForEmail(userProfile.email, {
          redirectTo: `${window.location.origin}/sifre-guncelleme`,
        });
        if (error) throw error;
        setMailSent(true);
        setSecurityMessage("Şifre sıfırlama bağlantısı gönderildi.");
        setTimeout(() => setMailSent(false), 5000);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Bilinmeyen hata";
      setSecurityMessage("Hata: " + message);
    }
  };

  const toggleSetting = async (athleteId: string, current: AthletePermissions | undefined, key: AthletePermissionKey) => {
    setUpdatingId(athleteId);
    const baseline = current || DEFAULT_ATHLETE_PERMISSIONS;
    const nextValue = !baseline[key];
    const result = await updateAthletePermissions(athleteId, { [key]: nextValue });
    if (result?.success) {
      setAthletes((prev) =>
        prev.map((a) =>
          a.id === athleteId ? { ...a, permissions: { ...(a.permissions || DEFAULT_ATHLETE_PERMISSIONS), [key]: nextValue } } : a
        )
      );
    } else {
      setSecurityMessage(result?.error || "Yetki güncellemesi başarısız.");
    }
    setUpdatingId(null);
  };

  const isCoach = role === 'coach' || role === 'admin';

  if (loading) return (
    <div className="flex flex-col justify-center items-center min-h-[50dvh] gap-4 px-4 min-w-0 overflow-x-hidden pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] text-center">
      <Loader2 className="animate-spin text-[#7c3aed]" size={48} aria-hidden />
      <p className="text-gray-500 font-black italic uppercase text-[10px] tracking-wide sm:tracking-widest animate-pulse break-words max-w-md">
        Ayarlar Yükleniyor...
      </p>
    </div>
  );

  return (
    <div className="space-y-6 sm:space-y-10 pb-[max(5rem,env(safe-area-inset-bottom,0px))] min-w-0 overflow-x-hidden animate-in fade-in duration-700">
      <header className="min-w-0">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black italic text-white uppercase tracking-tighter leading-tight break-words">
          {isCoach ? "SİSTEM" : "HESAP"} <span className="text-[#7c3aed]">AYARLARI</span>
        </h1>
        <div className="flex items-start gap-3 mt-3 sm:mt-4 text-gray-500 font-bold text-[9px] sm:text-[10px] uppercase tracking-wide sm:tracking-widest italic border-l-2 border-[#7c3aed] pl-3 sm:pl-4 min-w-0">
          <ShieldCheck size={14} className="text-[#7c3aed] shrink-0 mt-0.5" aria-hidden />
          <span className="break-words">{isCoach ? "PANEL GÖRÜNÜRLÜK VE YETKİ YÖNETİMİ" : "KİŞİSEL TERCİHLER VE GÜVENLİK"}</span>
        </div>
      </header>

      {/* TABS NAVIGATION */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-[#121215] border border-white/5 rounded-[1.5rem] w-full min-w-0 sm:w-fit">
        <button 
          type="button"
          onClick={() => setActiveTab("profil")}
          className={`min-h-11 flex-1 sm:flex-none px-4 sm:px-8 py-3 rounded-xl font-black italic text-[10px] uppercase transition-all flex items-center justify-center gap-2 touch-manipulation ${
            activeTab === 'profil' ? 'bg-[#7c3aed] text-white shadow-xl shadow-[#7c3aed]/20' : 'text-gray-500 sm:hover:text-white'
          }`}
        >
          <User size={14} aria-hidden /> Profil
        </button>

        {isCoach && (
          <button 
            type="button"
            onClick={() => setActiveTab("yetkiler")}
            className={`min-h-11 flex-1 sm:flex-none px-4 sm:px-8 py-3 rounded-xl font-black italic text-[10px] uppercase transition-all flex items-center justify-center gap-2 touch-manipulation ${
              activeTab === 'yetkiler' ? 'bg-[#7c3aed] text-white shadow-xl shadow-[#7c3aed]/20' : 'text-gray-500 sm:hover:text-white'
            }`}
          >
            <ShieldCheck size={14} aria-hidden /> Yetkiler
          </button>
        )}

        <button 
          type="button"
          onClick={() => setActiveTab("guvenlik")}
          className={`min-h-11 flex-1 sm:flex-none px-4 sm:px-8 py-3 rounded-xl font-black italic text-[10px] uppercase transition-all flex items-center justify-center gap-2 touch-manipulation ${
            activeTab === 'guvenlik' ? 'bg-[#7c3aed] text-white shadow-xl shadow-[#7c3aed]/20' : 'text-gray-500 sm:hover:text-white'
          }`}
        >
          <Lock size={14} aria-hidden /> Güvenlik
        </button>
      </div>

      {/* TAB CONTENT: YETKİLER */}
      {activeTab === "yetkiler" && isCoach && (
        <div className="space-y-5 sm:space-y-6 animate-in slide-in-from-bottom-2 duration-500 min-w-0">
          {!canManageVisibility && (
            <div className="min-w-0 break-words">
              <Notification message="Sporcu gorunurluk ayarlari icin yetkiniz yok." variant="error" />
            </div>
          )}
          <div className="relative w-full max-w-md min-w-0">
            <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" size={18} aria-hidden />
            <input 
              type="search" 
              placeholder="KADRODA ARA..." 
              autoComplete="off"
              className="w-full min-h-11 bg-[#121215] border border-white/5 py-3 pl-12 sm:pl-14 pr-4 rounded-2xl outline-none focus:border-[#7c3aed]/50 transition-all font-black italic text-base sm:text-[11px] text-white uppercase tracking-wide sm:tracking-widest touch-manipulation"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid gap-4 min-w-0">
            {athletes.filter(a => a.full_name?.toLowerCase().includes(searchTerm.toLowerCase())).map((athlete) => (
              <div key={athlete.id} className="bg-[#121215] border border-white/5 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2.5rem] flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5 sm:gap-6 sm:hover:bg-white/[0.01] transition-all group min-w-0">
                <div className="flex items-center gap-4 sm:gap-5 min-w-0 w-full lg:w-auto">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 bg-[#1c1c21] rounded-2xl border border-white/5 flex items-center justify-center font-black italic text-lg sm:text-xl text-[#7c3aed] sm:group-hover:border-[#7c3aed]/30 transition-all">
                    {athlete.avatar_url ? (
                      <Image
                        src={athlete.avatar_url}
                        className="h-full w-full object-cover rounded-2xl"
                        alt=""
                        width={56}
                        height={56}
                      />
                    ) : (
                      athlete.full_name?.[0]
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base sm:text-lg font-black italic uppercase text-white tracking-tighter break-words">{athlete.full_name}</h3>
                    <p className="text-[9px] text-gray-600 font-black uppercase tracking-wide sm:tracking-widest italic break-words">{athlete.team || "TAKIM BELİRSİZ"}</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap justify-center gap-2 sm:gap-3 min-w-0">
                  <PermissionToggle 
                    label="Sabah Raporu" 
                    active={athlete.permissions?.can_view_morning_report !== false} 
                    loading={updatingId === athlete.id}
                    onClick={() => canManageVisibility && toggleSetting(athlete.id, athlete.permissions, 'can_view_morning_report')} 
                  />
                  <PermissionToggle 
                    label="Programlar" 
                    active={athlete.permissions?.can_view_programs !== false} 
                    loading={updatingId === athlete.id}
                    onClick={() => canManageVisibility && toggleSetting(athlete.id, athlete.permissions, 'can_view_programs')} 
                  />
                  <PermissionToggle 
                    label="Takvim" 
                    active={athlete.permissions?.can_view_calendar !== false} 
                    loading={updatingId === athlete.id}
                    onClick={() => canManageVisibility && toggleSetting(athlete.id, athlete.permissions, 'can_view_calendar')} 
                  />
                  <PermissionToggle 
                    label="Bildirimler" 
                    active={athlete.permissions?.can_view_notifications !== false} 
                    loading={updatingId === athlete.id}
                    onClick={() => canManageVisibility && toggleSetting(athlete.id, athlete.permissions, 'can_view_notifications')} 
                  />
                  <PermissionToggle 
                    label="RPE Girişi"
                    active={athlete.permissions?.can_view_rpe_entry !== false} 
                    loading={updatingId === athlete.id}
                    onClick={() => canManageVisibility && toggleSetting(athlete.id, athlete.permissions, 'can_view_rpe_entry')} 
                  />
                  <PermissionToggle 
                    label="Gelisim Profili" 
                    active={athlete.permissions?.can_view_development_profile !== false} 
                    loading={updatingId === athlete.id}
                    onClick={() => canManageVisibility && toggleSetting(athlete.id, athlete.permissions, 'can_view_development_profile')} 
                  />
                  <PermissionToggle 
                    label="Finansal Durum" 
                    active={athlete.permissions?.can_view_financial_status !== false} 
                    loading={updatingId === athlete.id}
                    onClick={() => canManageVisibility && toggleSetting(athlete.id, athlete.permissions, 'can_view_financial_status')} 
                  />
                  <PermissionToggle 
                    label="Performans Metrik" 
                    active={athlete.permissions?.can_view_performance_metrics !== false} 
                    loading={updatingId === athlete.id}
                    onClick={() => canManageVisibility && toggleSetting(athlete.id, athlete.permissions, 'can_view_performance_metrics')} 
                  />
                  <PermissionToggle 
                    label="Wellness Metrik" 
                    active={athlete.permissions?.can_view_wellness_metrics !== false} 
                    loading={updatingId === athlete.id}
                    onClick={() => canManageVisibility && toggleSetting(athlete.id, athlete.permissions, 'can_view_wellness_metrics')} 
                  />
                  <PermissionToggle 
                    label="Skill Radar" 
                    active={athlete.permissions?.can_view_skill_radar !== false} 
                    loading={updatingId === athlete.id}
                    onClick={() => canManageVisibility && toggleSetting(athlete.id, athlete.permissions, 'can_view_skill_radar')} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: PROFİL */}
      {activeTab === "profil" && (
        <div className="max-w-3xl w-full min-w-0 grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8 animate-in slide-in-from-bottom-2 duration-500">
          <div className="bg-[#121215] border border-white/5 p-5 sm:p-8 md:p-10 rounded-[1.75rem] sm:rounded-[3rem] shadow-2xl relative overflow-hidden min-w-0">
             <div className="absolute top-0 right-0 w-32 h-32 bg-[#7c3aed]/5 rounded-full blur-3xl -mr-16 -mt-16" />
             <h3 className="text-lg sm:text-xl font-black italic text-white uppercase mb-6 sm:mb-8 flex items-center gap-3 break-words">
               <User className="text-[#7c3aed] shrink-0" size={20} aria-hidden /> KİMLİK BİLGİLERİ
             </h3>
             <div className="space-y-6">
                <InfoBox label="Tam Adınız" value={userProfile?.full_name ?? ""} />
                <InfoBox label="Bağlı Organizasyon" value={userProfile?.organization_id ? "PEAKER ELITE" : "GENEL"} highlight />
                <div className="grid grid-cols-2 gap-4">
                  <InfoBox label="Rol" value={role ? role.toUpperCase() : ""} />
                  <InfoBox label="Numara" value={`#${userProfile?.number || "00"}`} />
                </div>
             </div>
          </div>

          <div className="bg-[#121215] border border-white/5 p-5 sm:p-8 md:p-10 rounded-[1.75rem] sm:rounded-[3rem] shadow-2xl min-w-0">
             <h3 className="text-lg sm:text-xl font-black italic text-white uppercase mb-6 sm:mb-8 flex items-center gap-3 break-words">
               <Mail className="text-[#7c3aed] shrink-0" size={20} aria-hidden /> İLETİŞİM
             </h3>
             <div className="space-y-6">
                <InfoBox label="E-Posta Adresi" value={userProfile?.email ?? ""} />
                <div className="p-4 sm:p-6 bg-[#1c1c21] rounded-2xl border border-white/5 italic min-w-0">
                  <p className="text-[10px] text-gray-500 font-bold uppercase leading-relaxed tracking-wide sm:tracking-wider break-words">
                    Profil bilgilerinizde bir hata olduğunu düşünüyorsanız lütfen teknik ekip ile iletişime geçin.
                  </p>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: GÜVENLİK */}
      {activeTab === "guvenlik" && (
        <div className="max-w-2xl w-full min-w-0 bg-[#121215] border border-white/5 p-5 sm:p-8 md:p-10 rounded-[1.75rem] sm:rounded-[3rem] animate-in slide-in-from-bottom-2 duration-500 shadow-2xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 min-w-0">
            <h3 className="text-lg sm:text-xl font-black italic text-white uppercase flex items-center gap-3 break-words">
              <Lock className="text-red-500 shrink-0" size={20} aria-hidden /> GUVENLIK MERKEZI
            </h3>
            {mailSent && <span className="text-[9px] font-black italic text-green-500 bg-green-500/10 px-4 py-1 rounded-full animate-bounce shrink-0 self-start sm:self-auto">MAİL GÖNDERİLDİ</span>}
          </div>
          
          <div className="p-5 sm:p-8 bg-red-500/5 border border-red-500/10 rounded-[1.5rem] sm:rounded-[2rem] mb-6 sm:mb-10 min-w-0">
            <p className="text-gray-400 text-[11px] font-bold uppercase leading-relaxed tracking-[0.08em] sm:tracking-[0.1em] break-words">
              Şifre değişikliği için sistemde kayıtlı olan <span className="text-white underline decoration-[#7c3aed]">{userProfile?.email?.replace(/(.{3})(.*)(?=@)/, "$1***")}</span> adresine bir güvenli bağlantı gönderilecektir.
            </p>
          </div>

          <button 
            type="button"
            onClick={handlePasswordReset}
            disabled={mailSent}
            className={`w-full min-h-[3.5rem] sm:min-h-0 p-5 sm:p-6 rounded-2xl font-black italic text-[10px] sm:text-[11px] transition-all flex items-center justify-between gap-3 group border uppercase tracking-[0.15em] sm:tracking-[0.2em] touch-manipulation ${
              mailSent 
              ? 'bg-green-500/20 border-green-500/30 text-green-500 cursor-default' 
              : 'bg-[#1c1c21] sm:hover:bg-[#7c3aed] text-white border-white/5 sm:hover:border-[#7c3aed] sm:hover:scale-[1.02] active:scale-[0.99] shadow-xl'
            }`}
          >
            <span>{mailSent ? "BAĞLANTI GÖNDERİLDİ" : "ŞİFRE SIFIRLAMA MAİLİ GÖNDER"}</span>
            {mailSent ? <CheckCircle2 size={20} aria-hidden /> : <Mail size={20} className="text-gray-600 sm:group-hover:text-white" aria-hidden />}
          </button>
          {securityMessage && (
            <div className="min-w-0 break-words mt-4">
              <Notification message={securityMessage} variant={securityMessage.toLowerCase().startsWith("hata") ? "error" : "success"} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// YARDIMCI BİLEŞENLER
function PermissionToggle({ label, active, onClick, loading }: { label: string, active: boolean, onClick: () => void, loading: boolean }) {
  return (
    <button 
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`min-h-11 min-w-0 max-w-full px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-black italic text-[9px] sm:text-[10px] uppercase transition-all flex items-center gap-2 sm:gap-3 border shadow-sm touch-manipulation ${
        active 
        ? 'bg-[#7c3aed]/10 border-[#7c3aed]/30 text-[#7c3aed]' 
        : 'bg-black/20 border-white/5 text-gray-600'
      } ${loading ? 'opacity-50 cursor-not-allowed' : 'sm:hover:scale-105 active:scale-[0.98]'}`}
    >
      <span className="shrink-0" aria-hidden>{active ? <Eye size={14}/> : <EyeOff size={14}/>}</span>
      <span className="text-left break-words">{label}</span>
    </button>
  );
}

function InfoBox({ label, value, highlight }: { label: string, value: string, highlight?: boolean }) {
  return (
    <div>
      <label className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] ml-2 mb-2 block italic">{label}</label>
      <div className={`w-full min-w-0 p-4 sm:p-5 rounded-2xl font-bold text-xs border transition-all break-words ${
        highlight 
        ? 'bg-[#7c3aed]/5 border-[#7c3aed]/20 text-[#7c3aed] italic' 
        : 'bg-[#1c1c21] border-white/5 text-gray-200'
      }`}>
        {value || "---"}
      </div>
    </div>
  );
}