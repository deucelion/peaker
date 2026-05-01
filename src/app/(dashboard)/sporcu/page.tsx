"use client";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import {
  Camera,
  Activity,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Plus,
  Moon,
  Loader2,
  Clock,
  Package,
  User,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer
} from "recharts";

import { updateAthleteSelfProfile, uploadAthleteAvatar } from "@/lib/actions/athleteSelfProfileActions";
import { getAthletePanelSnapshot } from "@/lib/actions/snapshotActions";
import { listMyAthleteInjuryNotes } from "@/lib/actions/injuryNoteActions";
import { getMyFinanceDetailForAthlete } from "@/lib/actions/financeActions";
import PerformanceRadar from "@/components/PerformanceRadar";
import Notification from "@/components/Notification";
import EmptyStateCard from "@/components/EmptyStateCard";
import Link from "next/link";
import type { ProfileBasic, PaymentRow } from "@/types/domain";
import { DEFAULT_ATHLETE_PERMISSIONS } from "@/lib/types";
import type { AthleteInjuryNoteRecord } from "@/lib/types";
import type { FinanceStatusSummary } from "@/lib/types";
import { getFinanceStatusPresentation } from "@/lib/finance/statusPresentation";

export default function SporcuPanel() {
  const [profile, setProfile] = useState<ProfileBasic | null>(null);
  const [payment, setPayment] = useState<PaymentRow | null>(null);
  const [metrics, setMetrics] = useState<Array<{ tarih: string; kilo: number | null; yag: number | null }>>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [permissions, setPermissions] = useState(DEFAULT_ATHLETE_PERMISSIONS);
  const [attendancePreview, setAttendancePreview] = useState<
    Array<{ title: string; at: string; status: string }>
  >([]);
  const [injuryNotes, setInjuryNotes] = useState<AthleteInjuryNoteRecord[]>([]);
  const [financeSummary, setFinanceSummary] = useState<FinanceStatusSummary | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await getAthletePanelSnapshot();
      if ("error" in snapshot) {
        setProfileMessage(snapshot.error || "Veri alinamadi.");
        return;
      }
      setProfile(snapshot.profile as ProfileBasic);
      setPermissions(snapshot.permissions);
      setPayment((snapshot.payment as PaymentRow | null) || null);
      setMetrics(snapshot.metrics || []);
      setAttendancePreview((snapshot.attendancePreview || []).filter((r) => r.at));
      const injuryRes = await listMyAthleteInjuryNotes();
      if ("error" in injuryRes) {
        setProfileMessage(injuryRes.error || "Sakatlik gecmisi alinamadi.");
      } else {
        setInjuryNotes(injuryRes.notes || []);
      }
      const financeRes = await getMyFinanceDetailForAthlete();
      if (!("error" in financeRes)) {
        setFinanceSummary(financeRes.summary);
      }
    } catch (e) { 
      console.error("Veri çekme hatası:", e); 
    } finally { 
      setLoading(false); 
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      const file = event.target.files?.[0];
      if (!file || !profile) return;

      const fd = new FormData();
      fd.append("file", file);
      const result = await uploadAthleteAvatar(fd);
      if ("error" in result && result.error) {
        setProfileMessage("Yukleme hatasi: " + result.error);
        return;
      }
      if ("publicUrl" in result && result.publicUrl) {
        setProfile({ ...profile, avatar_url: result.publicUrl });
        setProfileMessage("Profil fotografi guncellendi.");
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Bilinmeyen hata";
      setProfileMessage("Yukleme hatasi: " + message);
    }
  }

  async function handleSave() {
    if (!profile) return;
    setSaveLoading(true);

    const fd = new FormData();
    fd.append("full_name", profile.full_name ?? "");
    fd.append("height", profile.height != null ? String(profile.height) : "");
    fd.append("weight", profile.weight != null ? String(profile.weight) : "");
    fd.append("position", profile.position ?? "");
    fd.append("number", profile.number ?? "");

    const result = await updateAthleteSelfProfile(fd);
    if ("error" in result && result.error) {
      setProfileMessage(result.error);
    } else {
      setIsEditing(false);
      void fetchData();
      setProfileMessage("Profil basariyla guncellendi.");
    }
    setSaveLoading(false);
  }

  if (loading) return (
    <div className="flex min-h-[60dvh] min-w-0 flex-col items-center justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] text-white">
      <Loader2 className="mb-8 animate-spin text-[#7c3aed]" size={60} aria-hidden />
      <p className="text-center text-xs font-black uppercase italic tracking-[0.5em] opacity-50">Senkronize Ediliyor...</p>
    </div>
  );

  const financePresentation = getFinanceStatusPresentation(financeSummary);
  if (!permissions.can_view_development_profile) {
    return (
      <div className="min-w-0 px-2 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
        <Notification message="Gelisim profili goruntuleme yetkiniz kapali." variant="info" />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-8 overflow-x-hidden pb-8 animate-in fade-in duration-700 sm:space-y-12 sm:pb-16">
      
      {/* HEADER */}
      <header className="flex min-w-0 flex-col items-stretch justify-between gap-6 xl:flex-row xl:items-end xl:gap-8">
        <div className="min-w-0 space-y-4">
          <div className="flex items-center gap-3">
             <div className="h-[2px] w-10 bg-[#7c3aed]"></div>
             <span className="text-[10px] font-black text-[#7c3aed] uppercase tracking-[0.4em] italic">Athlete Hub</span>
          </div>
          <h1 className="break-words text-4xl font-black uppercase leading-[0.9] tracking-tighter text-white italic sm:text-5xl md:text-6xl md:leading-[0.85]">
            KİŞİSEL <br/><span className="text-[#7c3aed]">ANALİZ</span>
          </h1>
        </div>

        <button 
          type="button"
          onClick={() => isEditing ? handleSave() : setIsEditing(true)} 
          className={`min-h-11 w-full touch-manipulation rounded-[1.5rem] px-6 py-3 font-black uppercase italic transition-all text-[10px] tracking-[0.2em] sm:w-auto sm:shrink-0 ${
            isEditing ? "bg-white text-black" : "bg-[#7c3aed] text-white shadow-xl shadow-[#7c3aed]/20"
          }`}
        >
          {saveLoading ? <Loader2 className="animate-spin" size={18} aria-hidden /> : isEditing ? "KAYDET" : "PROFİLİ DÜZENLE"}
        </button>
      </header>
      {profileMessage && (
        <Notification message={profileMessage} variant={profileMessage.toLowerCase().includes("hata") ? "error" : "success"} />
      )}

      <section className="rounded-[2rem] border border-white/10 bg-[#121215] p-5 sm:p-6">
        <h3 className="text-sm font-black italic uppercase tracking-tight text-white">Bugün Öncelik</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Link
            href={permissions.can_view_morning_report ? "/sporcu/sabah-raporu" : "/sporcu"}
            className="rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/10 px-4 py-3 text-[10px] font-black uppercase text-[#c4b5fd] touch-manipulation"
          >
            {permissions.can_view_morning_report ? "Önce sabah raporunu gir" : "Bugün profilini kontrol et"}
          </Link>
          <Link
            href="/sporcu/finans"
            className={`rounded-xl border px-4 py-3 text-[10px] font-black uppercase touch-manipulation ${financePresentation.badgeClass}`}
          >
            {financePresentation.label}
          </Link>
          <Link
            href={permissions.can_view_programs ? "/programlarim" : "/sporcu"}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-black uppercase text-gray-300 touch-manipulation"
          >
            {permissions.can_view_programs ? "Günün programını aç" : "Bugün için odak notu yok"}
          </Link>
        </div>
      </section>

      {permissions.can_view_development_profile && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-[#121215] border border-white/10 rounded-[2rem] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black italic uppercase text-white tracking-tight">Yoklama özeti</h3>
              <Clock className="text-[#7c3aed]" size={20} />
            </div>
            {attendancePreview.length === 0 ? (
              <p className="text-[10px] text-gray-500 font-bold uppercase">Henüz yoklama kaydı yok. İlk dersten sonra burada görünecek.</p>
            ) : (
              <ul className="space-y-2">
                {attendancePreview.map((row, i) => (
                  <li
                    key={`${row.at}-${i}`}
                    className="flex justify-between gap-3 text-[10px] font-bold text-gray-400 border border-white/5 rounded-xl px-3 py-2"
                  >
                    <span className="text-white truncate">{row.title}</span>
                    <span className="shrink-0 text-gray-500">
                      {row.at ? new Date(row.at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "-"}
                    </span>
                    <span className="shrink-0 uppercase text-[#c4b5fd]">{row.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {permissions.can_view_programs && (
            <Link
              href="/programlarim"
              className="group flex touch-manipulation flex-col justify-between rounded-[2rem] border border-white/10 bg-[#121215] p-6 transition-colors sm:hover:border-[#7c3aed]/30"
            >
              <div className="flex items-center gap-2 text-[#7c3aed]">
                <Package size={20} />
                <span className="text-[10px] font-black uppercase tracking-widest">Programlar</span>
              </div>
              <h3 className="text-2xl font-black italic uppercase text-white mt-4 leading-tight">
                Program <span className="text-[#7c3aed]">geçmişi</span>
              </h3>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-2 sm:group-hover:text-gray-400">
                Haftalık plan ve notlara git →
              </p>
            <p className="text-[10px] font-bold text-gray-400">Bugün için programı açıp yapılacakları işaretleyin.</p>
            </Link>
          )}
        </section>
      )}

      {permissions.can_view_development_profile && (
        <section className="rounded-[2rem] border border-white/10 bg-[#121215] p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-black italic uppercase text-white tracking-tight">
              Sakatlık <span className="text-[#7c3aed]">Geçmişi</span>
            </h3>
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">Sadece görüntüleme</span>
          </div>
          {injuryNotes.length === 0 ? (
            <EmptyStateCard
              title="Kayıt bulunamadı"
              description="Sakatlık geçmişinde görüntülenecek bir kayıt yok."
              reason="Henüz sakatlık notu girilmemiş olabilir."
              primaryAction={{ label: "Programlarımı aç", href: "/programlarim" }}
              secondaryAction={{ label: "Takvime git", href: "/takvim" }}
              compact
            />
          ) : (
            <div className="space-y-3">
              {injuryNotes.map((item) => (
                <article key={item.id} className="rounded-2xl border border-white/5 bg-black/30 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs font-black uppercase text-white break-words">{item.injuryType}</p>
                    <span className="text-[10px] text-gray-500 font-bold uppercase">
                      {new Date(item.createdAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm font-bold text-gray-300">{item.note}</p>
                  {item.assets.length > 0 ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {item.assets.map((asset) => (
                        <a
                          key={asset.path}
                          href={asset.signedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="overflow-hidden rounded-xl border border-white/10 bg-black/40"
                        >
                          <Image
                            src={asset.signedUrl}
                            alt={item.injuryType}
                            width={240}
                            height={160}
                            unoptimized
                            className="h-20 w-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* QUICK ACTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {permissions.can_view_morning_report && (
        <Link href="/sporcu/sabah-raporu" className="group relative overflow-hidden rounded-[2.75rem] border border-[#7c3aed]/20 bg-[#121215] p-8 shadow-xl touch-manipulation">
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-2 text-[#7c3aed]"><Moon size={20} /><span className="text-[10px] font-black uppercase tracking-widest">Readiness</span></div>
            <h3 className="text-3xl font-black italic uppercase text-white leading-none">SABAH <br/> <span className="text-[#7c3aed]">RAPORU GİR</span></h3>
            <div className="flex items-center gap-2 text-white/40 text-[9px] font-bold uppercase tracking-widest sm:group-hover:text-white transition-colors">HEMEN BİLDİR <ChevronRight size={14} aria-hidden /></div>
          </div>
          <div className="absolute right-8 top-8 rounded-[2rem] bg-[#7c3aed] p-5 shadow-xl shadow-[#7c3aed]/40 transition-transform sm:group-hover:rotate-12"><Plus size={32} className="text-white" strokeWidth={3} aria-hidden /></div>
        </Link>
        )}

        {permissions.can_view_financial_status && (
        <Link
          href="/sporcu/finans"
          className={`p-8 rounded-[2.75rem] border flex flex-col justify-between shadow-xl transition-colors ${
            financePresentation.tone === "green"
              ? "bg-emerald-500/5 border-emerald-500/20 sm:hover:border-emerald-500/40"
              : financePresentation.tone === "yellow"
                ? "bg-amber-500/5 border-amber-500/20 sm:hover:border-amber-500/40"
                : financePresentation.tone === "orange"
                  ? "bg-orange-500/5 border-orange-500/20 sm:hover:border-orange-500/40"
                  : "bg-rose-500/5 border-rose-500/20 sm:hover:border-rose-500/40"
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="space-y-4">
              <div className={`flex items-center gap-2 ${financePresentation.inlineTextClass}`}><CreditCard size={20} /><span className="text-[10px] font-black uppercase tracking-widest">Finansal Statü</span></div>
              <h3 className={`text-3xl font-black italic uppercase leading-none ${financePresentation.inlineTextClass}`}>
                {financePresentation.label}
              </h3>
            </div>
            <div
              className={`p-4 rounded-3xl ${
                financePresentation.tone === "green"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : financePresentation.tone === "yellow"
                    ? "bg-amber-500/20 text-amber-400"
                    : financePresentation.tone === "orange"
                      ? "bg-orange-500/20 text-orange-400"
                      : "bg-rose-500/20 text-rose-400"
              }`}
            >
              {financePresentation.tone === "green" ? <CheckCircle2 size={32} /> : <AlertCircle size={32} />}
            </div>
          </div>
          {financePresentation.tone !== "green" && (
            <div
              className={`mt-8 pt-6 flex justify-between items-center ${
                financePresentation.tone === "yellow"
                  ? "border-t border-amber-500/10"
                  : financePresentation.tone === "orange"
                    ? "border-t border-orange-500/10"
                    : "border-t border-rose-500/10"
              }`}
            >
              <span className="text-[10px] font-black text-gray-500 uppercase italic">Sonraki: {financeSummary?.nextDueDate || payment?.due_date || "-"}</span>
              <span className="text-2xl font-black italic text-white">₺{financeSummary?.nextAmount ?? payment?.amount ?? 0}</span>
            </div>
          )}
          <p className="mt-3 text-[9px] font-bold uppercase tracking-widest text-gray-500">{financePresentation.label}</p>
          <p className="mt-2 text-[10px] font-bold text-gray-400">
            {financePresentation.tone === "green"
              ? "Bu ay ödeme tamamlandı. Sonraki tarihi kontrol edin."
              : "Ödeme durumunu finans detayından takip edin."}
          </p>
        </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* PROFİL */}
        <aside className="lg:col-span-4 space-y-10">
          <div className="relative flex flex-col items-center overflow-hidden rounded-[2rem] border border-white/5 bg-[#121215] p-6 shadow-2xl sm:rounded-[3rem] sm:p-10 lg:rounded-[4rem] lg:p-12">
            <div className="group relative mb-8 sm:mb-10">
              <div className="mx-auto h-40 w-40 rounded-[2.5rem] border-[6px] border-[#7c3aed]/10 p-1 sm:h-48 sm:w-48 sm:rounded-[3rem] md:h-56 md:w-56 md:rounded-[4rem]">
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[2rem] border-2 border-[#7c3aed]/20 bg-black sm:rounded-[2.5rem] md:rounded-[3.5rem]">
                  {profile?.avatar_url ? (
                    <Image
                      src={profile.avatar_url}
                      className="h-full w-full object-cover"
                      alt={profile.full_name || "Sporcu"}
                      width={224}
                      height={224}
                    />
                  ) : (
                    <User size={80} className="text-[#7c3aed]/20" />
                  )}
                </div>
              </div>
              <input type="file" id="avatarInput" hidden onChange={handleAvatarUpload} />
              <button
                type="button"
                onClick={() => document.getElementById('avatarInput')?.click()}
                className="absolute bottom-2 right-2 min-h-11 min-w-11 touch-manipulation rounded-[1.5rem] border-4 border-[#121215] bg-[#7c3aed] p-3 text-white shadow-xl transition-all sm:p-4 sm:hover:scale-110"
                aria-label="Profil fotoğrafı yükle"
              >
                <Camera size={20} aria-hidden />
              </button>
            </div>
            <h2 className="mb-4 break-words px-2 text-center text-2xl font-black uppercase tracking-tighter text-white italic sm:text-3xl md:text-4xl">{profile?.full_name}</h2>
            <div className="flex items-center gap-3 mb-10">
              <span className="px-4 py-1.5 bg-[#7c3aed]/10 text-[#7c3aed] rounded-full text-[10px] font-black uppercase tracking-widest border border-[#7c3aed]/20">{profile?.position || "PLAYER"}</span>
              <span className="text-gray-600 font-black italic text-xl">#{profile?.number || "00"}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 w-full pt-10 border-t border-white/5">
              <StatItem label="BOY" value={profile?.height} unit="cm" isEditing={isEditing} onChange={(v)=>setProfile(profile ? { ...profile, height: Number(v) || null } : profile)} />
              <StatItem label="KİLO" value={profile?.weight} unit="kg" isEditing={isEditing} onChange={(v)=>setProfile(profile ? { ...profile, weight: Number(v) || null } : profile)} />
            </div>
            {isEditing && profile && (
              <div className="grid grid-cols-1 gap-3 w-full pt-4">
                <input
                  value={profile.full_name ?? ""}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  placeholder="Ad Soyad"
                  className="min-h-11 w-full min-w-0 touch-manipulation rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-base font-bold italic text-white outline-none focus:border-[#7c3aed] sm:text-sm"
                />
                <div className="grid min-w-0 grid-cols-2 gap-3">
                  <input
                    value={profile.position ?? ""}
                    onChange={(e) => setProfile({ ...profile, position: e.target.value })}
                    placeholder="Pozisyon"
                    className="min-h-11 min-w-0 touch-manipulation rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-base font-bold italic text-white outline-none focus:border-[#7c3aed] sm:text-sm"
                  />
                  <input
                    value={profile.number ?? ""}
                    onChange={(e) => setProfile({ ...profile, number: e.target.value })}
                    placeholder="Numara"
                    className="min-h-11 min-w-0 touch-manipulation rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-base font-bold italic text-white outline-none focus:border-[#7c3aed] sm:text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ANALİZ */}
        <main className="lg:col-span-8 space-y-10">
          {permissions.can_view_skill_radar && (
          <section className="group rounded-[2rem] border border-white/5 bg-[#121215] p-6 shadow-2xl sm:rounded-[3rem] sm:p-10 lg:rounded-[4rem] lg:p-12">
             <div className="mb-8 flex min-w-0 items-center justify-between sm:mb-12">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4"><div className="shrink-0 rounded-3xl bg-[#7c3aed]/10 p-3 text-[#7c3aed] sm:p-4"><Activity size={24} aria-hidden /></div><h3 className="break-words text-xl font-black uppercase tracking-tighter text-white italic sm:text-2xl">Beceri <span className="text-[#7c3aed]">Radarı</span></h3></div>
                <ArrowUpRight className="shrink-0 text-gray-700 transition-colors sm:group-hover:text-[#7c3aed]" size={28} aria-hidden />
             </div>
             <div className="h-[min(70vw,22rem)] min-h-[240px] w-full min-w-0 sm:h-[400px] sm:min-h-[400px] lg:h-[450px] lg:min-h-[450px]"><PerformanceRadar /></div>
          </section>
          )}

          {permissions.can_view_performance_metrics && (
          <section className="rounded-[2rem] border border-white/5 bg-[#121215] p-6 shadow-2xl sm:rounded-[3rem] sm:p-10 lg:rounded-[4rem] lg:p-12">
             <div className="mb-8 flex min-w-0 items-center gap-3 sm:mb-12 sm:gap-4"><div className="shrink-0 rounded-3xl bg-green-500/10 p-3 text-green-500 sm:p-4"><TrendingUp size={24} aria-hidden /></div><h3 className="break-words text-xl font-black uppercase tracking-tighter text-white italic sm:text-2xl">Kütle <span className="text-green-500">Trendi</span></h3></div>
             <div className="h-[min(55vw,20rem)] min-h-[220px] w-full min-w-0 sm:h-[320px] sm:min-h-[320px] lg:h-[350px] lg:min-h-[350px]">
                {metrics.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics} margin={{ left: -20 }}>
                      <defs><linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4}/><stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                      <XAxis dataKey="tarih" stroke="#4b5563" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                      <YAxis stroke="#4b5563" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ backgroundColor: '#1c1c21', border: '1px solid #7c3aed33', borderRadius: '20px' }} />
                      <Area type="monotone" dataKey="kilo" stroke="#7c3aed" strokeWidth={5} fill="url(#weightGrad)" dot={{fill: '#7c3aed', r: 5}} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div className="h-full flex items-center justify-center text-gray-700 italic font-black uppercase text-xs">Veri Bekleniyor...</div>}
             </div>
          </section>
          )}
        </main>
      </div>
    </div>
  );
}

function StatItem({
  label,
  value,
  unit,
  isEditing,
  onChange,
}: {
  label: string;
  value: string | number | null | undefined;
  unit: string;
  isEditing: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center rounded-[2.5rem] border border-white/5 bg-black/40 p-4 transition-all sm:hover:border-[#7c3aed]/40 sm:p-6">
      <p className="mb-3 text-[9px] font-black uppercase italic tracking-widest text-gray-600">{label}</p>
      {isEditing ? (
        <input type="number" inputMode="decimal" className="min-h-11 w-full min-w-0 touch-manipulation border-b-2 border-[#7c3aed]/50 bg-transparent text-center text-2xl font-black text-[#7c3aed] outline-none sm:text-3xl" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <div className="flex items-baseline gap-1"><span className="text-4xl font-black text-white italic tracking-tighter">{value || "0"}</span><span className="text-[10px] text-gray-700 font-black uppercase">{unit}</span></div>
      )}
    </div>
  );
}