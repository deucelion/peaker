"use client";
import React, { useState, useEffect, useMemo } from "react";
import { Moon, Battery, Activity, Brain, Zap, CheckCircle2, Heart, Loader2 } from "lucide-react";
import Link from "next/link";
import Notification from "@/components/Notification";
import {
  getAthleteOrganizationIdForWellness,
  getMorningReportEligibility,
  submitWellnessReportToday,
} from "@/lib/actions/wellnessFormActions";

export default function SporcuWellnessGiris() {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [orgResolveError, setOrgResolveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [form, setForm] = useState({ 
    fatigue: 3, 
    sleep_quality: 3, 
    muscle_soreness: 3, 
    stress_level: 3, 
    energy_level: 3,
    resting_heart_rate: 60 
  });

  const todayDisplay = useMemo(
    () =>
      new Date().toLocaleDateString("tr-TR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getAthleteOrganizationIdForWellness();
      if (cancelled) return;
      if ("error" in res) {
        setOrgResolveError(res.error ?? "Organizasyon bilgisi alınamadı.");
        setOrganizationId(null);
      } else {
        setOrganizationId(res.organizationId);
        setOrgResolveError(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await getMorningReportEligibility();
      setIsAllowed(res.allowed);
    })();
  }, []);

  if (isAllowed === false) {
    return (
      <div className="min-w-0 px-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
        <Notification message="Sabah raporu ekrani sizin icin kapali." variant="info" />
      </div>
    );
  }

  const handleSave = async () => {
    if (!organizationId) {
      setSubmitError("Organizasyon bilgisi alınamadı. Sayfayı yenileyin.");
      return;
    }
    if (form.resting_heart_rate < 30 || form.resting_heart_rate > 220) {
      setSubmitError("Nabız değeri 30–220 aralığında olmalıdır.");
      return;
    }

    setLoading(true);
    setSubmitError(null);

    const result = await submitWellnessReportToday(form);

    setLoading(false);
    if ("error" in result && result.error) {
      setSubmitError(result.error);
      return;
    }
    setSubmitted(true);
  };

  if (submitted) return (
    <div className="min-h-[85dvh] sm:min-h-screen flex flex-col items-center justify-center bg-black text-white p-6 sm:p-10 pb-[max(2rem,env(safe-area-inset-bottom,0px))] text-center animate-in fade-in zoom-in duration-500 min-w-0">
      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#7c3aed]/10 border border-[#7c3aed]/30 rounded-2xl sm:rounded-[2rem] flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(124,58,237,0.2)]">
        <CheckCircle2 className="w-8 h-8 sm:w-9 sm:h-9 text-[#7c3aed]" strokeWidth={2.5} />
      </div>
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-black italic uppercase tracking-tighter leading-none">RAPOR <br/> <span className="text-[#7c3aed]">TAMAMLANDI</span></h1>
      <p className="text-gray-500 mt-4 sm:mt-5 uppercase text-[9px] sm:text-[10px] font-bold tracking-[0.35em] italic leading-relaxed max-w-sm">Veriler aynı veritabanına kaydedildi; antrenör ve yönetici panelleri veriyi sayfa yenilemesi veya sonraki yüklemede görür.</p>
      <Link href="/sporcu" className="mt-8 sm:mt-10 inline-flex min-h-12 items-center justify-center px-8 py-3.5 sm:px-10 sm:py-4 bg-[#121215] border border-white/5 rounded-2xl text-[10px] font-black uppercase italic sm:hover:bg-white/10 transition-all tracking-widest touch-manipulation">
        DASHBOARD&apos;A GİT
      </Link>
    </div>
  );

  return (
    <div className="max-w-xl md:max-w-2xl mx-auto w-full min-w-0 px-3 sm:px-6 md:p-8 space-y-5 sm:space-y-6 min-h-0 bg-black text-white pb-[max(5rem,env(safe-area-inset-bottom,0px))] sm:pb-24 overflow-x-hidden">
      <header className="pt-4 sm:pt-6 md:pt-8 space-y-2 sm:space-y-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="h-px w-6 sm:w-8 bg-[#7c3aed]"></div>
          <span className="text-[9px] sm:text-[10px] font-black text-[#7c3aed] uppercase tracking-[0.4em] sm:tracking-[0.5em] italic">Daily Readiness</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black italic uppercase tracking-tighter leading-[0.9]">
          GÜNE <br/><span className="text-[#7c3aed]">HAZIRLIK</span>
        </h1>
        <p className="text-gray-600 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] italic max-w-sm">
          Performans optimizasyonu için sabah verilerini sisteme işle.
        </p>
        <p className="text-gray-500 text-[10px] sm:text-[11px] font-bold tracking-wide mt-1 border-l-2 border-[#7c3aed]/40 pl-2 sm:pl-3">
          Rapor tarihi: <span className="text-white">{todayDisplay}</span> (bugün)
        </p>
      </header>

      {orgResolveError && (
        <Notification message={orgResolveError} variant="error" />
      )}

      {/* RHR (RESTING HEART RATE) CARD */}
      <div className="bg-[#121215] border border-[#7c3aed]/20 p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-[1.75rem] md:rounded-[2rem] shadow-xl relative overflow-hidden group">
        <div className="flex justify-between items-center gap-3 mb-4 sm:mb-5 relative z-10">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2.5 sm:p-3 bg-[#7c3aed]/10 rounded-xl sm:rounded-2xl text-[#7c3aed] shrink-0">
              <Heart size={20} className="sm:w-6 sm:h-6 animate-pulse" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-wider sm:tracking-widest italic">Sabah Nabzı</span>
              <span className="text-[8px] sm:text-[9px] font-bold text-[#7c3aed] uppercase truncate">Resting Heart Rate</span>
            </div>
          </div>
          <div className="text-xl sm:text-2xl md:text-3xl font-black italic text-white tracking-tighter shrink-0 tabular-nums">
            {form.resting_heart_rate} <span className="text-[10px] sm:text-[11px] text-gray-700 not-italic uppercase">bpm</span>
          </div>
        </div>
        
        <input 
          type="number" 
          inputMode="numeric"
          placeholder="--" 
          className="w-full min-w-0 bg-black border border-white/5 py-3 px-3 sm:py-3.5 sm:px-4 rounded-xl sm:rounded-2xl text-2xl sm:text-3xl md:text-[2rem] font-black text-center text-[#7c3aed] outline-none focus:border-[#7c3aed] focus:ring-2 sm:focus:ring-4 focus:ring-[#7c3aed]/10 transition-all max-h-[4.5rem] sm:max-h-none touch-manipulation"
          value={form.resting_heart_rate || ""}
          onChange={(e) => setForm({...form, resting_heart_rate: parseInt(e.target.value, 10) || 0})}
        />
        
        <p className="text-[8px] sm:text-[9px] text-gray-600 font-bold uppercase mt-3 sm:mt-4 text-center italic tracking-wide sm:tracking-widest opacity-60 leading-relaxed px-1">
          * Ölçümü yataktan kalkmadan, dinlenik halde yapınız.
        </p>

        <div className="absolute -right-6 -bottom-6 sm:-right-10 sm:-bottom-10 text-[#7c3aed] opacity-[0.03] rotate-12 -z-0 pointer-events-none">
          <Heart className="w-28 h-28 sm:w-40 sm:h-40 md:w-[200px] md:h-[200px]" />
        </div>
      </div>

      {/* WELLNESS SLIDERS */}
      <div className="grid gap-3 sm:gap-4">
        <WellnessSlider 
          label="YORGUNLUK" icon={<Battery/>} value={form.fatigue} 
          onChange={(val: number) => setForm({...form, fatigue: val})} 
          low="TÜKENMİŞ" high="ZİNDE" 
        />
        <WellnessSlider 
          label="UYKU KALİTESİ" icon={<Moon/>} value={form.sleep_quality} 
          onChange={(val: number) => setForm({...form, sleep_quality: val})} 
          low="YETERSİZ" high="DERİN" 
        />
        <WellnessSlider 
          label="KAS AĞRISI" icon={<Activity/>} value={form.muscle_soreness} 
          onChange={(val: number) => setForm({...form, muscle_soreness: val})} 
          low="DOMS+" high="TEMİZ" 
        />
        <WellnessSlider 
          label="STRES SEVİYESİ" icon={<Brain/>} value={form.stress_level} 
          onChange={(val: number) => setForm({...form, stress_level: val})} 
          low="YOĞUN" high="RAHAT" 
        />
        <WellnessSlider 
          label="ENERJİ MODU" icon={<Zap/>} value={form.energy_level} 
          onChange={(val: number) => setForm({...form, energy_level: val})} 
          low="DÜŞÜK" high="ZİRVE" 
        />
      </div>

      <button 
        type="button"
        onClick={handleSave} 
        disabled={loading || !organizationId}
        className="min-h-12 w-full touch-manipulation bg-[#7c3aed] py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-black italic uppercase tracking-[0.12em] sm:tracking-[0.18em] text-sm sm:text-base text-white shadow-[0_12px_36px_rgba(124,58,237,0.28)] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 sm:gap-3 group"
      >
        {loading ? (
          <Loader2 className="animate-spin w-5 h-5 sm:w-6 sm:h-6" />
        ) : (
          <>
            <span>RAPORU KAYDET</span>
            <Zap size={18} className="sm:w-5 sm:h-5 sm:group-hover:fill-white transition-all shrink-0" aria-hidden />
          </>
        )}
      </button>
      {submitError && (
        <Notification message={submitError} variant="error" />
      )}
    </div>
  );
}

function WellnessSlider({
  label,
  icon,
  value,
  onChange,
  low,
  high,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  onChange: (value: number) => void;
  low: string;
  high: string;
}) {
  // Değerlere göre renk değişimi
  const getColor = (val: number) => {
    if (val <= 2) return "text-red-500";
    if (val <= 3) return "text-[#7c3aed]";
    return "text-green-500";
  };

  return (
    <div className="bg-[#121215] border border-white/5 p-4 sm:p-5 rounded-xl sm:rounded-2xl space-y-3 sm:space-y-4 transition-all sm:hover:border-white/10 group">
      <div className="flex justify-between items-center gap-2">
        <span className="flex items-center gap-2 sm:gap-3 text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-wide sm:tracking-widest italic min-w-0">
          <span className="text-[#7c3aed] sm:group-hover:scale-110 transition-transform shrink-0 [&>svg]:w-4 [&>svg]:h-4 sm:[&>svg]:w-[18px] sm:[&>svg]:h-[18px]">{icon}</span> <span className="break-words text-left">{label}</span>
        </span>
        <div className="flex items-baseline gap-1 shrink-0">
          <span className={`text-lg sm:text-xl md:text-2xl font-black italic transition-colors ${getColor(value)}`}>{value}</span>
          <span className="text-[9px] sm:text-[10px] text-gray-800 font-black">/ 5</span>
        </div>
      </div>
      
      <div className="relative flex items-center">
        <input 
          type="range" min="1" max="5" step="1"
          value={value} 
          onChange={(e) => onChange(parseInt(e.target.value))} 
          className="w-full h-2.5 sm:h-2 bg-black rounded-full appearance-none cursor-pointer accent-[#7c3aed] border border-white/5 touch-manipulation py-1" 
        />
      </div>

      <div className="flex justify-between text-[8px] sm:text-[9px] font-black text-gray-700 uppercase italic tracking-tight sm:tracking-tighter gap-2">
        <span className={value <= 2 ? "text-red-900" : ""}>{low}</span>
        <span className={value >= 4 ? "text-green-900" : ""}>{high}</span>
      </div>
    </div>
  );
}