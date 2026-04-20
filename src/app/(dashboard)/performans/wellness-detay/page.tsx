"use client";
import Image from "next/image";
import React, { useState, useEffect, useCallback } from "react";
import { 
  ChevronLeft, Calendar, Heart, Battery, Moon, 
  Activity, Brain, Zap, Search, Loader2, MessageSquare
} from "lucide-react";
import Link from "next/link";
import type { WellnessReportRow } from "@/types/performance";
import type { ReactNode, SVGProps } from "react";
import { listWellnessArchiveForManagement } from "@/lib/actions/wellnessFormActions";
import Notification from "@/components/Notification";

export default function WellnessDetay() {
  const [reports, setReports] = useState<WellnessReportRow[]>([]);
  const [totalAthletes, setTotalAthletes] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await listWellnessArchiveForManagement();
      if ("error" in res) {
        setLoadError(res.error);
        setReports([]);
        setTotalAthletes(0);
        return;
      }
      setReports(res.reports);
      setTotalAthletes(res.totalAthletes);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  // Skorlara göre renk belirleme (1-5 skalası için)
  const getScoreColor = (value: number, type: 'positive' | 'negative') => {
    if (!value) return "text-gray-600";
    if (type === 'positive') { // Enerji, Uyku gibi (Yüksek iyidir)
      if (value >= 4) return "text-green-400";
      if (value === 3) return "text-yellow-400";
      return "text-red-500";
    } else { // Stres, Yorgunluk, Ağrı gibi (Düşük iyidir)
      if (value <= 2) return "text-green-400";
      if (value === 3) return "text-yellow-400";
      return "text-red-500";
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[50dvh] gap-4 bg-black px-4 min-w-0 overflow-x-hidden pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] text-center">
      <Loader2 className="animate-spin text-[#7c3aed]" size={40} aria-hidden />
      <p className="text-gray-500 font-black italic uppercase tracking-wide sm:tracking-widest text-[10px] break-words max-w-md">
        Veri Arşivi Taranıyor...
      </p>
    </div>
  );

  if (loadError) {
    return (
      <div className="min-h-0 bg-black text-white p-4 sm:p-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] min-w-0 overflow-x-hidden">
        <Link
          href="/performans"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/5 bg-[#121215] px-4 py-2 text-[#7c3aed] text-[10px] font-black uppercase touch-manipulation sm:hover:border-[#7c3aed]/30 sm:hover:bg-[#7c3aed]/10 transition-colors"
        >
          <ChevronLeft size={18} className="shrink-0" aria-hidden />
          Performans
        </Link>
        <div className="mt-6 min-w-0 break-words">
          <Notification message={loadError} variant="error" />
        </div>
      </div>
    );
  }

  const filteredReports = reports.filter((r) => 
    (() => {
      const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      const fullName = (profile?.full_name || "").toLowerCase();
      const term = searchTerm.toLowerCase().trim();
      if (!term) return true;
      return fullName.includes(term);
    })()
  );

  const avgHeartRate =
    reports.length > 0
      ? Math.round(
          reports.reduce((sum, report) => sum + (Number(report.resting_heart_rate) || 0), 0) / reports.length
        ).toString()
      : "-";

  const criticalCount = reports.filter(
    (report) =>
      (report.stress_level ?? 0) >= 4 ||
      (report.fatigue ?? 0) >= 4 ||
      (report.muscle_soreness ?? 0) >= 4
  ).length;

  const today = new Date().toISOString().slice(0, 10);
  const todayParticipants = new Set(
    reports
      .filter((report) => String(report.report_date).slice(0, 10) === today)
      .map((report) => report.profile_id)
  ).size;
  const activeParticipation = totalAthletes > 0 ? Math.round((todayParticipants / totalAthletes) * 100) : 0;

  return (
    <div className="min-h-0 bg-black text-white p-4 md:p-10 space-y-6 sm:space-y-8 pb-[max(5rem,env(safe-area-inset-bottom,0px))] min-w-0 overflow-x-hidden">
      {/* ÜST PANEL */}
      <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between min-w-0">
        <div className="flex items-start gap-4 sm:gap-6 min-w-0 flex-1">
          <Link href="/performans" className="p-3 sm:p-4 shrink-0 min-h-11 min-w-11 inline-flex items-center justify-center bg-[#121215] rounded-2xl sm:hover:bg-[#7c3aed] transition-all border border-white/5 group shadow-lg touch-manipulation" aria-label="Performansa dön">
            <ChevronLeft size={24} className="sm:group-hover:-translate-x-1 transition-transform" aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight break-words">
              WELLNESS <span className="text-[#7c3aed]">ARŞİVİ</span>
            </h1>
            <p className="text-gray-500 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.4em] mt-2 sm:mt-3 italic border-l-2 border-[#7c3aed] pl-3 sm:pl-4 break-words">
              Organizasyonel Sağlık Takibi
            </p>
          </div>
        </div>

        <div className="relative group w-full lg:max-w-md min-w-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#7c3aed] transition-colors pointer-events-none" size={18} aria-hidden />
          <input 
            type="search" 
            placeholder="SPORCU ARA..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoComplete="off"
            className="w-full min-h-11 bg-[#121215] border border-white/5 py-3 pl-12 pr-4 rounded-2xl outline-none focus:border-[#7c3aed]/50 transition-all font-black italic text-base sm:text-[11px] uppercase tracking-wide sm:tracking-widest text-white touch-manipulation"
          />
        </div>
      </header>

      {/* ÖZET KARTLARI (Quick View) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 min-w-0">
        <StatsCard label="TOPLAM RAPOR" value={reports.length} icon={<Activity size={16}/>} />
        <StatsCard label="ORT. NABIZ" value={avgHeartRate} unit="BPM" icon={<Heart size={16}/>} color="text-red-500" />
        <StatsCard label="KRİTİK DURUM" value={criticalCount} unit="SPORCU" icon={<AlertCircle size={16}/>} color="text-orange-500" />
        <StatsCard label="AKTİF KATILIM" value={`%${activeParticipation}`} icon={<Zap size={16}/>} color="text-yellow-400" />
      </div>

      {/* RAPOR LİSTESİ */}
      <div className="space-y-4">
        {filteredReports.length === 0 ? (
          <div className="text-center py-16 sm:py-32 bg-[#121215] rounded-[3rem] border-2 border-dashed border-white/5 px-4 min-w-0">
            <p className="text-gray-600 font-black italic uppercase tracking-[0.3em] text-sm">Kayıt Bulunamadı</p>
          </div>
        ) : (
          filteredReports.map((report) => (
            <div key={report.id} className="group bg-[#121215] border border-white/5 p-5 sm:p-6 md:p-8 rounded-[1.75rem] sm:rounded-[2.5rem] flex flex-col xl:flex-row xl:items-center justify-between gap-6 sm:gap-8 sm:hover:border-[#7c3aed]/30 transition-all shadow-xl relative overflow-hidden min-w-0">
              
              {/* Profil & Tarih */}
              <div className="flex items-center gap-4 sm:gap-6 min-w-0 w-full xl:w-auto xl:max-w-md shrink-0">
                <div className="relative shrink-0">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#1c1c21] rounded-2xl border border-white/10 flex items-center justify-center font-black text-xl sm:text-2xl italic text-[#7c3aed] sm:group-hover:scale-110 transition-transform">
                    {(Array.isArray(report.profiles) ? report.profiles[0]?.avatar_url : report.profiles?.avatar_url) ? (
                      <Image
                        src={(Array.isArray(report.profiles) ? report.profiles[0]?.avatar_url : report.profiles?.avatar_url) || ""}
                        className="h-full w-full object-cover rounded-2xl"
                        alt=""
                        width={64}
                        height={64}
                      />
                    ) : (
                      (Array.isArray(report.profiles) ? report.profiles[0]?.full_name : report.profiles?.full_name)?.[0] || "?"
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-4 border-[#121215] rounded-full"></div>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg sm:text-2xl font-black italic uppercase text-white tracking-tighter sm:group-hover:text-[#7c3aed] transition-colors leading-tight break-words">
                    {(() => {
                      const profile = Array.isArray(report.profiles) ? report.profiles[0] : report.profiles;
                      return profile?.full_name || "Sporcu";
                    })()}
                  </h3>
                  <div className="flex items-start gap-2 mt-2 opacity-60 min-w-0">
                    <Calendar size={12} className="text-[#7c3aed] shrink-0 mt-0.5" aria-hidden />
                    <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-wide sm:tracking-widest italic text-gray-400 break-words">
                      {new Date(report.report_date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', weekday: 'long' })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Metrik Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6 flex-1 min-w-0 bg-black/20 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-white/5">
                <MetricBox icon={<Heart size={14}/>} label="NABIZ" value={report.resting_heart_rate} unit="BPM" color="text-red-500" />
                <MetricBox icon={<Battery size={14}/>} label="YORGUNLUK" value={report.fatigue} unit="/5" color={getScoreColor(report.fatigue ?? 0, 'negative')} />
                <MetricBox icon={<Moon size={14}/>} label="UYKU" value={report.sleep_quality} unit="/5" color={getScoreColor(report.sleep_quality ?? 0, 'positive')} />
                <MetricBox icon={<Activity size={14}/>} label="AĞRI" value={report.muscle_soreness} unit="/5" color={getScoreColor(report.muscle_soreness ?? 0, 'negative')} />
                <MetricBox icon={<Brain size={14}/>} label="STRES" value={report.stress_level} unit="/5" color={getScoreColor(report.stress_level ?? 0, 'negative')} />
                <MetricBox icon={<Zap size={14}/>} label="ENERJİ" value={report.energy_level} unit="/5" color={getScoreColor(report.energy_level ?? 0, 'positive')} />
              </div>

              {/* Sporcu Notu */}
              <div className="w-full min-w-0 xl:w-72 shrink-0">
                {report.notes ? (
                  <div className="h-full p-4 sm:p-5 bg-[#1c1c21] rounded-2xl border border-white/5 relative group/note min-w-0">
                    <MessageSquare size={14} className="absolute top-4 right-4 text-[#7c3aed] opacity-40" aria-hidden />
                    <p className="text-[8px] text-gray-600 font-black uppercase mb-2 tracking-widest italic">SPORCU NOTU</p>
                    <p className="text-[11px] text-gray-400 italic font-medium leading-relaxed break-words">
                      <span className="text-gray-500">&ldquo;</span>
                      {report.notes}
                      <span className="text-gray-500">&rdquo;</span>
                    </p>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center p-5 border border-dashed border-white/5 rounded-2xl opacity-30">
                    <p className="text-[9px] font-black italic uppercase tracking-widest">Not Girilmedi</p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// YARDIMCI BİLEŞENLER
function StatsCard({
  label,
  value,
  unit,
  icon,
  color = "text-[#7c3aed]",
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  color?: string;
}) {
  return (
    <div className="bg-[#121215] border border-white/5 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] shadow-lg min-w-0">
      <div className="flex items-center gap-2 mb-2 opacity-50 min-w-0">
        <span className={color} aria-hidden>{icon}</span>
        <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-wide sm:tracking-widest italic min-w-0 break-words">{label}</span>
      </div>
      <div className="flex items-baseline gap-1 flex-wrap">
        <span className={`text-xl sm:text-2xl font-black italic tracking-tighter break-all ${color}`}>{value}</span>
        {unit && <span className="text-[10px] font-bold text-gray-700 italic">{unit}</span>}
      </div>
    </div>
  );
}

function MetricBox({
  icon,
  label,
  value,
  unit,
  color,
}: {
  icon: ReactNode;
  label: string;
  value: string | number | null;
  unit: string;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 opacity-60">
        <span className={color} aria-hidden>{icon}</span>
        <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest italic min-w-0 break-words">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-xl font-black italic leading-none ${color}`}>{value || '-'}</span>
        <span className="text-[9px] font-bold text-gray-700 italic uppercase">{unit}</span>
      </div>
    </div>
  );
}

function AlertCircle({ size = 24, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}