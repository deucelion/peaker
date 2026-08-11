"use client";
import { useState, useEffect, useCallback } from "react";
import { Calendar as CalendarIcon, Clock, MapPin, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import type { TrainingScheduleRow } from "@/types/domain";
import Notification from "@/components/Notification";
import { AthletePageHeader, AthleteEmptyState } from "@/components/athlete";
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
      <Loader2 className="mb-6 animate-spin text-[color:var(--peaker-ui-PRIMARY)]" size={48} aria-hidden />
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
    <div className="min-w-0 space-y-5 overflow-x-hidden pb-[max(3rem,env(safe-area-inset-bottom,0px))] animate-in fade-in duration-700">
      <AthletePageHeader
        backHref="/sporcu"
        title={
          <>
            Antrenman <span className="text-[color:var(--peaker-ui-PRIMARY)]">takvimi</span>
          </>
        }
        subtitle="Kişisel antrenman takvimi ve etkinlikler"
        action={
          <div className="flex min-w-0 shrink-0 items-center gap-2 rounded-xl ui-card px-4 py-2.5">
            <CalendarIcon className="shrink-0 text-[color:var(--peaker-ui-PRIMARY)]" size={18} aria-hidden />
            <span className="break-words text-[11px] font-black uppercase italic tracking-wide text-white">
              {new Date().toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}
            </span>
          </div>
        }
      />

      <div className="grid min-w-0 gap-3 sm:gap-4">
        {trainings.length > 0 ? trainings.map((item, index: number) => {
          const schedule = item.training_schedule;
          const t = Array.isArray(schedule) ? schedule[0] : schedule;
          if (!t) return null;
          const date = new Date(t.start_time);
          
          return (
            <div
              key={t.id || index}
              className="group relative min-w-0 overflow-hidden rounded-2xl ui-card p-4 transition-colors sm:hover:border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_30%,transparent)]"
            >
              <div className="relative z-10 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3 sm:gap-4">
                  <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_20%,transparent)] ui-card-inner">
                    <span className="text-[9px] font-black uppercase text-[color:var(--peaker-ui-PRIMARY)]">
                      {date.toLocaleString("tr-TR", { month: "short" })}
                    </span>
                    <span className="text-xl font-black italic leading-none text-white">{date.getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="break-words text-base font-black uppercase italic text-white sm:group-hover:text-[color:var(--peaker-ui-PRIMARY)]">
                      {t.title}
                    </h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold uppercase text-gray-500">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Clock size={14} className="shrink-0 text-[color:var(--peaker-ui-PRIMARY)]" aria-hidden />
                        {date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="flex min-w-0 items-center gap-1.5">
                        <MapPin size={14} className="shrink-0 text-[color:var(--peaker-ui-PRIMARY)]" aria-hidden />
                        <span className="break-words">{t.location || "Ana salon"}</span>
                      </span>
                    </div>
                    <p className="text-[10px] font-medium text-gray-400 sm:text-[11px]">
                      {t.description || (
                        <span className="italic text-amber-200/80">
                          Antrenman detayları koç tarafından henüz girilmedi.
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <Link
                  href="/ozel-ders-paketlerim"
                  className="inline-flex min-h-10 shrink-0 touch-manipulation items-center justify-center self-end rounded-xl ui-kpi-band px-3 py-2 text-[10px] font-black uppercase ui-kpi-card__trend sm:self-center"
                  aria-label="Özel ders paketlerime git"
                >
                  Detay <ChevronRight size={14} className="ml-1" aria-hidden />
                </Link>
              </div>
            </div>
          );
        }).filter(Boolean) : (
          <AthleteEmptyState
            icon={CalendarIcon}
            title="Takvim boş"
            description="Henüz size atanmış antrenman görünmüyor."
            hint="Koçunuz ders planladığında burada listelenecek."
            action={{ label: "Gelişim profilime dön", href: "/sporcu" }}
            compact
          />
        )}
      </div>
    </div>
  );
}