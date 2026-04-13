"use client";
import { useState, useEffect, useCallback } from "react";
import { Calendar as CalendarIcon, Clock, MapPin, ChevronRight, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { TrainingScheduleRow } from "@/types/domain";
import Notification from "@/components/Notification";
import { listAthleteCalendarTrainings } from "@/lib/actions/athleteCalendarActions";

interface TrainingParticipantWithSchedule {
  training_id: string;
  training_schedule:
    | (TrainingScheduleRow & { description?: string | null })
    | (TrainingScheduleRow & { description?: string | null })[]
    | null;
}

export default function TakvimPage() {
  const [trainings, setTrainings] = useState<TrainingParticipantWithSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchMyTrainings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await listAthleteCalendarTrainings();
      if ("error" in res) {
        setLoadError(res.error);
        setIsAllowed(null);
        setTrainings([]);
        return;
      }
      if (!res.allowed) {
        setIsAllowed(false);
        setTrainings([]);
        return;
      }
      setIsAllowed(true);
      setTrainings(res.trainings as unknown as TrainingParticipantWithSchedule[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMyTrainings();
  }, [fetchMyTrainings]);

  if (loading) return (
    <div className="flex min-h-[50dvh] min-w-0 flex-col items-center justify-center overflow-x-hidden px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] text-white">
      <Loader2 className="mb-6 animate-spin text-[#7c3aed]" size={48} aria-hidden />
      <p className="text-center text-xs font-black uppercase italic tracking-[0.2em] opacity-50 sm:tracking-[0.3em]">Program Hazırlanıyor...</p>
    </div>
  );
  if (loadError) {
    return (
      <div className="min-w-0 px-2 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
        <Notification message={loadError} variant="error" />
      </div>
    );
  }
  if (isAllowed === false) {
    return (
      <div className="min-w-0 px-2 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
        <Notification message="Takvim goruntuleme sizin icin kapali." variant="info" />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-10 pb-[max(4rem,env(safe-area-inset-bottom,0px))] animate-in fade-in duration-700 min-w-0 overflow-x-hidden">
      
      {/* ÜST BİLGİ */}
      <header className="flex flex-col gap-6 md:flex-row md:justify-between md:items-end border-b border-white/5 pb-6 sm:pb-10 min-w-0">
        <div className="space-y-4 min-w-0">
          <Link
            href="/sporcu"
            className="-ml-1 inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-xl px-1 text-[10px] font-black uppercase tracking-widest text-[#7c3aed] transition-transform sm:hover:translate-x-[-4px] sm:hover:bg-white/[0.03]"
          >
            <ArrowLeft size={14} className="shrink-0" aria-hidden /> <span className="break-words">Panele Dön</span>
          </Link>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black italic text-white uppercase tracking-tighter leading-none break-words">
            ANTRENMAN <br/><span className="text-[#7c3aed]">TAKVİMİ</span>
          </h1>
          <p className="text-gray-500 font-bold text-[9px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.4em] italic border-l-2 border-[#7c3aed] pl-3 sm:pl-4 break-words">
            Personal Training Schedule & Events
          </p>
        </div>

        <div className="flex max-w-full min-w-0 shrink-0 flex-wrap items-center gap-3 rounded-2xl border border-white/5 bg-[#121215] px-4 py-3 sm:px-6 sm:py-4">
           <CalendarIcon className="shrink-0 text-[#7c3aed]" size={20} aria-hidden />
           <span className="text-white font-black italic uppercase text-[11px] sm:text-xs tracking-wide sm:tracking-widest break-words">
             {new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
           </span>
        </div>
      </header>

      {/* ANTRENMAN LİSTESİ */}
      <div className="grid gap-4 sm:gap-5 min-w-0">
        {trainings.length > 0 ? trainings.map((item, index: number) => {
          const schedule = item.training_schedule;
          const t = Array.isArray(schedule) ? schedule[0] : schedule;
          if (!t) return null;
          const date = new Date(t.start_time);
          
          return (
            <div key={t.id || index} className="group relative min-w-0 overflow-hidden rounded-[1.75rem] border border-white/5 bg-[#121215] p-4 shadow-xl transition-all sm:rounded-[2.5rem] sm:p-6 sm:hover:border-[#7c3aed]/40">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-8 relative z-10 min-w-0">
                
                {/* Sol Kısım: Tarih ve Başlık */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 min-w-0">
                  <div className="flex h-[72px] min-w-[72px] shrink-0 flex-col items-center justify-center rounded-[1.25rem] border-2 border-[#7c3aed]/20 bg-black shadow-xl transition-colors sm:h-[88px] sm:min-w-[88px] sm:rounded-[1.5rem] sm:group-hover:border-[#7c3aed]">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#7c3aed]">
                      {date.toLocaleString('tr-TR', { month: 'short' })}
                    </span>
                    <span className="text-2xl sm:text-3xl font-black italic text-white leading-none">
                      {date.getDate()}
                    </span>
                  </div>
                  
                  <div className="space-y-2 sm:space-y-3 min-w-0 flex-1">
                    <h3 className="text-xl font-black uppercase italic leading-tight text-white transition-colors break-words sm:text-2xl sm:group-hover:text-[#7c3aed]">
                      {t.title}
                    </h3>
                    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-6 text-[10px] text-gray-500 font-black uppercase tracking-[0.15em] sm:tracking-[0.2em]">
                      <span className="flex min-w-0 items-center gap-2"><Clock size={16} className="shrink-0 text-[#7c3aed]" aria-hidden /> {date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="flex min-w-0 items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-[#7c3aed]" aria-hidden /> <span className="break-words">{t.location || "Ana Salon"}</span></span>
                    </div>
                  </div>
                </div>

                {/* Orta Kısım: Detay Metni */}
                <div className="flex-1 lg:max-w-md min-w-0">
                   <p className="border-l border-[#7c3aed]/20 pl-4 text-[10px] font-bold uppercase italic leading-relaxed tracking-wide text-gray-400 opacity-60 transition-opacity break-words sm:pl-6 sm:text-[11px] sm:tracking-wider sm:group-hover:opacity-100">
                     {t.description || "Antrenman detayları koç tarafından henüz girilmedi."}
                   </p>
                </div>

                {/* Sağ Kısım: Aksiyon */}
                <div className="flex items-center justify-end sm:justify-start gap-4 shrink-0">
                  <div className="hidden lg:block h-12 w-[1px] bg-white/5"></div>
                  <Link
                    href="/antrenman-yonetimi"
                    className="inline-flex min-h-12 min-w-12 touch-manipulation items-center justify-center rounded-[1.25rem] bg-[#7c3aed]/10 p-4 text-[#7c3aed] transition-all sm:rounded-[1.5rem] sm:p-5 sm:group-hover:bg-[#7c3aed] sm:group-hover:text-white"
                    aria-label="Antrenman detayina git"
                  >
                    <ChevronRight size={20} strokeWidth={3} aria-hidden />
                  </Link>
                </div>
              </div>
              
              {/* Dekoratif Arka Plan Yazısı */}
              <span className="absolute -bottom-4 -right-4 text-4xl sm:text-7xl font-black italic text-white/[0.02] uppercase pointer-events-none select-none max-w-[90%] truncate">
                {t.title}
              </span>
            </div>
          );
        }).filter(Boolean) : (
          <div className="rounded-[2rem] border-2 border-dashed border-white/5 bg-[#121215] py-20 text-center sm:rounded-[4rem] sm:py-40">
            <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-[#7c3aed]/5">
              <CalendarIcon size={40} className="text-gray-700" aria-hidden />
            </div>
            <h3 className="text-2xl font-black italic text-white uppercase mb-2">PROGRAM BOŞ</h3>
            <p className="text-gray-600 text-xs font-bold uppercase tracking-widest">Henüz atanmış bir antrenmanın bulunmuyor.</p>
          </div>
        )}
      </div>
    </div>
  );
}