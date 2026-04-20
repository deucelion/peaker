"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Users, Activity, ChevronLeft, BarChart3, TrendingUp, Loader2, Trophy, Target
} from "lucide-react";
import Link from "next/link";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell 
} from "recharts";
import type { ReactNode } from "react";
import Notification from "@/components/Notification";
import { loadFieldTestTeamReportForActor, type FieldTestTeamChartRow } from "@/lib/actions/athleticFieldActions";

export default function GenelTakimRaporu() {
  const [stats, setStats] = useState<FieldTestTeamChartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [selectedTest, setSelectedTest] = useState<string>("");

  const fetchTeamData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await loadFieldTestTeamReportForActor();
      if ("error" in res) {
        setLoadError(res.error ?? "Rapor yüklenemedi.");
        setTotalPlayers(0);
        setStats([]);
        return;
      }
      setTotalPlayers(res.totalPlayers);
      setStats(res.chartRows);
      if (res.chartRows.length > 0) {
        const firstTest = res.chartRows[0].test;
        setSelectedTest((prev) => prev || firstTest);
      }
    } catch (error) {
      console.error("Dashboard veri hatası:", error);
      setLoadError("Rapor yüklenemedi.");
      setStats([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTeamData();
  }, [fetchTeamData]);

  const availableTests = useMemo(() => Array.from(new Set(stats.map(s => s.test))), [stats]);
  const currentTestData = useMemo(() => stats.filter(s => s.test === selectedTest), [stats, selectedTest]);
  const currentUnit = currentTestData[0]?.unit || "";

  const isTimeBased = useMemo(() => {
    const unit = currentUnit.toLowerCase();
    return unit.includes('sn') || unit.includes('sec') || unit.includes('saniye');
  }, [currentUnit]);

  const bestValue = useMemo(() => {
    if (currentTestData.length === 0) return 0;
    const values = currentTestData.map(d => d.deger);
    return isTimeBased ? Math.min(...values) : Math.max(...values);
  }, [currentTestData, isTimeBased]);

  if (loading && stats.length === 0 && !loadError) return (
    <div className="min-h-[50dvh] px-4 flex flex-col items-center justify-center bg-black gap-6 min-w-0 overflow-x-hidden pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] text-center">
      <Loader2 className="w-12 h-12 text-[#7c3aed] animate-spin" aria-hidden />
      <p className="text-[10px] font-black uppercase italic tracking-wide sm:tracking-[0.4em] text-gray-500 animate-pulse break-words max-w-md">
        TAKIM VERİLERİ ANALİZ EDİLİYOR...
      </p>
    </div>
  );

  return (
    <div className="space-y-6 sm:space-y-8 text-white pb-[max(5rem,env(safe-area-inset-bottom,0px))] min-w-0 overflow-x-hidden">
      {loadError && (
        <div className="min-w-0 break-words">
          <Notification message={loadError} variant="error" />
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center min-w-0">
        <Link href="/saha-testleri" className="flex items-center gap-3 sm:gap-4 text-gray-500 sm:hover:text-[#7c3aed] transition-all group self-start min-h-11 touch-manipulation">
          <div className="p-3 bg-[#121215] border border-white/5 rounded-2xl sm:group-hover:border-[#7c3aed]/50 transition-all shadow-xl shrink-0">
            <ChevronLeft size={20} aria-hidden />
          </div>
          <span className="text-[10px] font-black uppercase italic tracking-[0.15em] sm:tracking-[0.2em]">Veri girişi ekranına dön</span>
        </Link>
        
        <div className="text-center min-w-0 flex-1 order-first lg:order-none">
          <h1 className="text-3xl sm:text-4xl font-black italic uppercase tracking-tighter leading-tight break-words">
            TAKIM <span className="text-[#7c3aed]">ANALİZİ</span>
          </h1>
          <div className="flex items-center justify-center gap-2 sm:gap-3 mt-3 sm:mt-4 flex-wrap px-2">
             <div className="h-[1px] w-6 sm:w-8 bg-[#7c3aed]/30 shrink-0" />
             <p className="text-[8px] sm:text-[9px] text-gray-600 font-bold uppercase tracking-[0.2em] sm:tracking-[0.4em] italic break-words">Takım saha test raporu</p>
             <div className="h-[1px] w-6 sm:w-8 bg-[#7c3aed]/30 shrink-0" />
          </div>
        </div>
        <div className="hidden lg:block w-32 shrink-0" /> 
      </div>

      {/* ÖZET KARTLARI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 min-w-0">
        <SummaryCard title="Kadro Genişliği" val={totalPlayers.toString()} icon={<Users size={20} />} color="text-blue-500" />
        <SummaryCard title="Toplam Veri Girişi" val={stats.length.toString()} icon={<Activity size={20} />} color="text-[#7c3aed]" />
        <SummaryCard title="Aktif Test Sayısı" val={availableTests.length.toString()} icon={<BarChart3 size={20} />} color="text-emerald-500" />
      </div>

      {/* TEST SEÇİCİ */}
      <div className="flex flex-wrap gap-2 p-2 bg-[#121215] border border-white/10 rounded-xl w-full min-w-0">
        {availableTests.map((testName) => (
          <button
            type="button"
            key={testName}
            onClick={() => setSelectedTest(testName)}
            className={`min-h-10 flex-1 sm:flex-none px-4 py-2.5 rounded-lg font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2 touch-manipulation min-w-0 ${
              selectedTest === testName 
              ? "bg-[#7c3aed] text-white shadow-2xl shadow-[#7c3aed]/20" 
              : "text-gray-500 sm:hover:text-white sm:hover:bg-white/5"
            }`}
          >
            <Target size={14} className={`shrink-0 ${selectedTest === testName ? "animate-pulse" : "opacity-30"}`} aria-hidden />
            <span className="text-center break-words leading-tight max-w-[min(100%,11rem)] sm:max-w-none">{testName}</span>
          </button>
        ))}
      </div>

      {/* GRAFİK PANELİ */}
      <div className="bg-[#121215] border border-white/10 rounded-2xl p-4 sm:p-5 md:p-6 shadow-xl relative overflow-hidden group min-w-0">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-5 sm:mb-6 relative z-10 gap-4 sm:gap-5 min-w-0">
          <div className="space-y-3 sm:space-y-4 min-w-0 flex-1">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 shrink-0 bg-[#7c3aed]/10 rounded-xl flex items-center justify-center">
                <TrendingUp size={18} className="text-[#7c3aed]" aria-hidden />
              </div>
              <h3 className="text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] sm:tracking-[0.4em] italic break-words">
                Takım karşılaştırması
              </h3>
            </div>
            <h4 className="text-xl sm:text-2xl md:text-3xl font-black italic uppercase text-white tracking-tighter break-words">
              {selectedTest || "Test Bekleniyor"} 
              <span className="text-[#7c3aed] opacity-30 ml-2 sm:ml-4 text-base sm:text-xl block sm:inline mt-1 sm:mt-0">[{currentUnit}]</span>
            </h4>
          </div>
          
          <div className="bg-black/40 border border-white/10 p-4 sm:p-5 rounded-xl backdrop-blur-xl w-full sm:min-w-[220px] sm:w-auto sm:group-hover:border-[#7c3aed]/30 transition-all shrink-0 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <Trophy size={16} className="text-yellow-500 shrink-0" aria-hidden />
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-wide sm:tracking-widest italic">En iyi değer</span>
            </div>
            <span className="text-3xl sm:text-4xl font-black italic text-white tracking-tighter tabular-nums break-all">
              {bestValue > 0 ? bestValue.toFixed(2) : "--"}
              <small className="text-xs ml-2 text-gray-600 not-italic uppercase">{currentUnit}</small>
            </span>
          </div>
        </div>

        <div className="h-[min(50vh,340px)] sm:h-[min(50vh,380px)] w-full min-h-[230px] relative z-10">
          {currentTestData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={currentTestData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#4b5563', fontSize: 10, fontWeight: 700 }} 
                  dy={15}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#4b5563', fontSize: 10 }} 
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(124, 58, 237, 0.05)' }} 
                  contentStyle={{
                    backgroundColor: '#1c1c21', 
                    border: '1px solid rgba(124, 58, 237, 0.2)', 
                    borderRadius: '24px', 
                    padding: '20px',
                  }}
                  itemStyle={{ color: '#7c3aed', fontWeight: '900', textTransform: 'uppercase', fontSize: '12px' }}
                  labelStyle={{ color: '#fff', marginBottom: '8px', fontWeight: '900' }}
                />
                <Bar dataKey="deger" radius={[15, 15, 0, 0]} barSize={45}>
                  {currentTestData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.deger === bestValue ? '#7c3aed' : '#7c3aed20'}
                      className="transition-all duration-500 sm:hover:opacity-80"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl bg-black/20 p-6 text-center">
               <Activity className="text-gray-700 mb-3" size={40} aria-hidden />
               <p className="text-gray-400 font-black text-sm uppercase tracking-wide">Bu test için henüz veri yok</p>
               <p className="mt-1 text-[11px] font-bold text-gray-600">İlk veri girişini saha testleri ekranından yapabilirsiniz.</p>
               <Link href="/saha-testleri" className="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg border border-white/15 bg-white/5 px-3 text-[10px] font-black uppercase tracking-wide text-gray-300 transition sm:hover:border-[#7c3aed]/35 sm:hover:text-[#c4b5fd]">
                 Veri girişine git
               </Link>
            </div>
          )}
        </div>
        <div className="absolute -bottom-24 -left-24 w-[500px] h-[500px] bg-[#7c3aed]/5 blur-[120px] rounded-full -z-0"></div>
      </div>
    </div>
  );
}

function SummaryCard({ title, val, icon, color }: { title: string; val: string; icon: ReactNode; color: string }) {
  return (
    <div className="bg-[#121215] border border-white/10 p-4 sm:p-5 rounded-xl flex items-center justify-between gap-3 group sm:hover:border-[#7c3aed]/20 transition-all shadow-xl relative overflow-hidden min-w-0">
      <div className="relative z-10 min-w-0 flex-1">
        <p className="text-[9px] sm:text-[10px] font-black text-gray-600 uppercase tracking-[0.15em] sm:tracking-[0.2em] mb-1 italic break-words">{title}</p>
        <p className={`text-2xl sm:text-3xl font-black italic ${color} tracking-tighter leading-none tabular-nums`}>{val}</p>
      </div>
      <div className={`p-3 sm:p-4 shrink-0 bg-white/[0.02] rounded-lg ${color} sm:group-hover:scale-110 sm:group-hover:bg-[#7c3aed]/10 transition-all relative z-10`} aria-hidden>
        {icon}
      </div>
    </div>
  );
}