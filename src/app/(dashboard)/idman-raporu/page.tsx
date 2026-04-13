"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Clock, Users, Zap, AlertCircle, TrendingDown, CalendarDays, Search, Loader2 } from "lucide-react";
import { listDailyTrainingLoadReports, listManagementDirectory } from "@/lib/actions/managementDirectoryActions";
import type { ReactNode } from "react";
import type { ProfileBasic } from "@/types/domain";

interface TrainingLoadReport {
  id: string;
  rpe_score: number;
  duration_minutes: number;
  total_load: number;
  measurement_date: string;
  profiles?: (Pick<ProfileBasic, "full_name" | "position" | "number"> & { organization_id?: string | null }) | null;
}

export default function GunlukIdmanRaporu() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [reports, setReports] = useState<TrainingLoadReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const checkUserRole = useCallback(async () => {
    const directory = await listManagementDirectory();
    if ("error" in directory) {
      setUserRole("sporcu");
      return;
    }
    setUserRole(directory.role);
  }, []);

  const fetchDailyReports = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const result = await listDailyTrainingLoadReports();
    if ("error" in result) {
      setReports([]);
      setLoadError(result.error ?? "Raporlar alinamadi.");
    } else {
      setReports((result.reports || []) as TrainingLoadReport[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchDailyReports();
      void checkUserRole();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchDailyReports, checkUserRole]);

  // İSTATİSTİK HESAPLAMALARI (Dinamik)
  const stats = useMemo(() => {
    if (reports.length === 0) return { avgRpe: 0, totalDuration: 0, riskyCount: 0 };
    
    const avgRpe = reports.reduce((acc, curr) => acc + curr.rpe_score, 0) / reports.length;
    const totalDuration = reports.reduce((acc, curr) => acc + curr.duration_minutes, 0) / reports.length;
    const riskyCount = reports.filter(r => r.rpe_score >= 8).length;

    return {
      avgRpe: avgRpe.toFixed(1),
      totalDuration: Math.round(totalDuration),
      riskyCount
    };
  }, [reports]);

  if (loading) return (
    <div className="min-h-[40dvh] px-4 py-10 flex flex-col sm:flex-row items-center justify-center gap-3 text-[#7c3aed] font-black italic animate-pulse tracking-wide sm:tracking-widest uppercase text-center text-sm min-w-0 overflow-x-hidden pb-[max(env(safe-area-inset-bottom,0px),0.5rem)]">
      <Loader2 className="animate-spin shrink-0" aria-hidden />
      <span className="break-words max-w-md">Raporlar Analiz Ediliyor...</span>
    </div>
  );

  // GÜVENLİK: Sporcular bu sayfayı göremez
  if (userRole === 'sporcu') return (
    <div className="p-6 sm:p-10 text-red-500 font-black italic break-words text-sm sm:text-base">
      BU ANALİZ SAYFASINA ERİŞİM YETKİNİZ YOK.
    </div>
  );

  return (
    <div className="space-y-6 sm:space-y-8 pb-[max(4rem,env(safe-area-inset-bottom,0px))] min-w-0 overflow-x-hidden">
      {/* ÜST BİLGİ VE FİLTRE */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 sm:gap-6 min-w-0">
        <div className="min-w-0">
          <h1 className="text-3xl sm:text-4xl font-black italic text-white uppercase tracking-tighter leading-tight break-words">
            GÜNLÜK <span className="text-[#7c3aed]">RAPOR</span>
          </h1>
          <div className="flex items-start gap-3 mt-3 sm:mt-4 text-gray-500 font-bold text-[9px] sm:text-[10px] uppercase tracking-wide sm:tracking-widest italic border-l-2 border-[#7c3aed] pl-3 sm:pl-4 min-w-0">
            <CalendarDays size={14} className="text-[#7c3aed] shrink-0 mt-0.5" aria-hidden />
            <span className="break-words">{new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }).toUpperCase()}</span>
          </div>
        </div>

        <div className="flex gap-2 sm:gap-3 w-full lg:w-auto min-w-0">
          <div className="relative flex-1 min-w-0 lg:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" size={16} aria-hidden />
            <input 
              type="search" 
              placeholder="SPORCU ARA..." 
              autoComplete="off"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-h-11 bg-[#121215] border border-white/5 rounded-2xl py-3 sm:py-4 pl-11 sm:pl-12 pr-4 text-base sm:text-xs font-black italic uppercase text-white outline-none focus:border-[#7c3aed] transition-all touch-manipulation"
            />
          </div>
          <button type="button" onClick={fetchDailyReports} className="shrink-0 min-h-11 min-w-11 sm:min-w-[3.25rem] flex items-center justify-center bg-white/5 p-3 sm:p-4 rounded-2xl border border-white/5 text-gray-400 sm:hover:bg-white/10 touch-manipulation" aria-label="Yenile">
            <Zap size={20} className={loading ? "animate-pulse" : ""} aria-hidden />
          </button>
        </div>
      </header>

      {/* ÖZET KARTLARI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5 min-w-0">
        <SummaryCard label="KATILIM" value={`${reports.length}`} sub="Rapor Gönderildi" icon={<Users className="text-blue-500" />} />
        <SummaryCard label="ORT. RPE" value={stats.avgRpe} sub="Yoğunluk Seviyesi" icon={<Zap className="text-yellow-500" />} />
        <SummaryCard label="ORT. SÜRE" value={stats.totalDuration} sub="Dakika" icon={<Clock className="text-[#7c3aed]" />} />
        <SummaryCard label="RİSKLİ" value={stats.riskyCount} sub="Yüksek Yüklenme" icon={<AlertCircle className="text-red-500" />} />
      </div>

      {/* RAPOR LİSTESİ */}
      <div className="bg-[#121215] border border-white/5 rounded-[1.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-xl min-w-0">
        <div className="p-4 sm:p-6 border-b border-white/5 flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center min-w-0">
          <h3 className="text-xs sm:text-sm font-black italic text-white uppercase tracking-wide sm:tracking-widest break-words">SPORCU GERİ BİLDİRİMLERİ</h3>
          <span className="bg-[#7c3aed]/10 text-[#7c3aed] text-[10px] font-black px-4 py-1 rounded-full uppercase italic shrink-0 self-start sm:self-auto">Canlı Akış</span>
        </div>

        <div className="divide-y divide-white/5">
          {loadError && (
            <div className="p-6 sm:p-8 text-center text-red-400 font-black italic uppercase tracking-wide sm:tracking-widest text-xs break-words px-4">
              {loadError}
            </div>
          )}
          {!loadError && reports
            .filter((r) => r.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()))
            .map((report) => (
            <div key={report.id} className="p-4 sm:p-5 sm:hover:bg-white/[0.01] transition-all group flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between min-w-0">
              {/* Sporcu Kimlik */}
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 w-full sm:w-auto sm:max-w-[min(100%,280px)]">
                <div className="w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-2xl bg-[#1c1c21] border border-white/5 flex items-center justify-center font-black italic text-[#7c3aed] sm:group-hover:bg-[#7c3aed] sm:group-hover:text-white transition-all uppercase">
                  {report.profiles?.full_name?.[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-black italic text-white uppercase tracking-tight break-words">{report.profiles?.full_name}</h4>
                  <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wide sm:tracking-widest italic break-words">
                    #{report.profiles?.number || "00"} • {report.profiles?.position || "Sporcu"}
                  </p>
                </div>
              </div>

              {/* RPE SKORU */}
              <div className="flex-1 min-w-0 w-full sm:min-w-[150px]">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-[10px] font-black text-gray-500 uppercase italic">Zorluk Derecesi (RPE)</span>
                  <span className={`text-lg font-black italic ${getRpeColor(report.rpe_score)}`}>{report.rpe_score}/10</span>
                </div>
                <div className="h-1.5 w-full bg-[#1c1c21] rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${getRpeBg(report.rpe_score)}`} 
                    style={{ width: `${report.rpe_score * 10}%` }}
                  />
                </div>
              </div>

              {/* ANTRENMAN YÜKÜ */}
              <div className="text-left sm:text-center min-w-0 w-full sm:w-auto shrink-0">
                <p className="text-[10px] font-black text-gray-500 uppercase mb-1 italic tracking-wide sm:tracking-widest">İş Yükü</p>
                <div className="text-lg sm:text-xl font-black italic text-white tabular-nums">{report.total_load} <span className="text-[10px] not-italic text-gray-600">AU</span></div>
              </div>

              {/* DURUM / AKSİYON */}
              <div className="w-full sm:w-auto sm:min-w-[120px] flex justify-start sm:justify-end shrink-0">
                {report.rpe_score >= 8 ? (
                  <div className="flex items-center gap-2 bg-red-500/10 text-red-500 px-4 py-2 rounded-xl border border-red-500/20 animate-pulse">
                    <TrendingDown size={14} className="rotate-180 shrink-0" aria-hidden />
                    <span className="text-[10px] font-black uppercase italic">DİNLENDİR!</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-green-500/10 text-green-500 px-4 py-2 rounded-xl border border-green-500/20">
                    <ClipboardCheck size={14} className="shrink-0" aria-hidden />
                    <span className="text-[10px] font-black uppercase italic">NORMAL</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {!loadError && reports.filter((r) => r.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
            <div className="p-12 sm:p-20 text-center text-gray-600 font-black italic uppercase tracking-wide sm:tracking-widest text-xs sm:text-sm px-4 break-words">
              {searchTerm ? "Arama kriterine uygun rapor bulunamadı." : "Bugün için henüz rapor girişi yapılmadı."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: ReactNode;
}) {
  return (
    <div className="bg-[#121215] border border-white/5 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] sm:hover:border-[#7c3aed]/30 transition-all group min-w-0">
      <div className="flex justify-between items-start mb-3 sm:mb-4 gap-2 min-w-0">
        <div className="p-2.5 sm:p-3 bg-white/5 rounded-xl sm:group-hover:scale-110 transition-transform shrink-0" aria-hidden>{icon}</div>
        <p className="text-[9px] sm:text-[10px] font-black text-gray-600 uppercase tracking-wide sm:tracking-widest italic text-right break-words">{label}</p>
      </div>
      <h3 className="text-2xl sm:text-3xl font-black italic text-white uppercase leading-none mb-1 tabular-nums">{value}</h3>
      <p className="text-[10px] font-bold text-gray-500 uppercase italic tracking-tighter break-words">{sub}</p>
    </div>
  );
}

function getRpeColor(val: number) {
  if (val <= 3) return "text-blue-400";
  if (val <= 6) return "text-green-500";
  if (val <= 8) return "text-orange-500";
  return "text-red-500";
}

function getRpeBg(val: number) {
  if (val <= 3) return "bg-blue-400";
  if (val <= 6) return "bg-green-500";
  if (val <= 8) return "bg-orange-500";
  return "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]";
}