"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, ChevronRight, Loader2, Plus } from "lucide-react";
import { FieldTestSessionSubNav } from "./FieldTestSessionSubNav";
import { PerformanceTabsNav } from "@/components/performance/PerformanceTabsNav";
import { PerformanceBreadcrumb } from "@/components/performance/PerformanceBreadcrumb";
import { PATHS } from "@/lib/navigation/routeRegistry";
import {
  listFieldTestSessionSummariesForActor,
  type FieldTestSessionSummary,
} from "@/lib/actions/athleticFieldActions";
import EmptyState from "@/components/ui/EmptyState";
import { InlineErrorState } from "@/components/ui/data-display/InlineErrorState";
import {
  hrefFieldTestSession,
  todayFieldTestSessionDate,
} from "@/lib/fieldTests/fieldTestSessionRoutes";

function formatSessionDateLabel(testDate: string): string {
  return new Date(`${testDate}T00:00:00`).toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function sessionSummaryLine(session: FieldTestSessionSummary): string {
  const parts: string[] = [];
  if (session.entryCount > 0) {
    parts.push(`${session.entryCount} metrik girişi`);
  }
  if (session.hasNotes) {
    parts.push("not var");
  }
  parts.push(`${session.athleteCount} sporcu`);
  return parts.join(" · ");
}

export function FieldTestSessionHub() {
  const router = useRouter();
  const today = useMemo(() => todayFieldTestSessionDate(), []);
  const [pickDate, setPickDate] = useState(today);
  const [sessions, setSessions] = useState<FieldTestSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await listFieldTestSessionSummariesForActor();
      if ("error" in res) {
        setSessions([]);
        setLoadError(res.error ?? "Oturum listesi yüklenemedi.");
        return;
      }
      setSessions(res.sessions);
    } catch {
      setSessions([]);
      setLoadError("Oturum listesi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  const todaySession = sessions.find((s) => s.testDate === today);

  return (
    <div className="ui-page min-w-0 overflow-x-hidden pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex flex-col gap-4 min-w-0">
        <div className="space-y-2 min-w-0">
          <h1 className="ui-h1 break-words">
            SAHA <span className="text-[color:var(--peaker-ui-PRIMARY)]">TESTLERİ</span>
          </h1>
          <p className="text-[11px] font-bold text-gray-500">
            Oturum seçin veya yeni bir test günü başlatın. Her oturum bir tarihe bağlıdır.
          </p>
        </div>

        <PerformanceBreadcrumb
          items={[
            { label: "Performans", href: PATHS.performans },
            { label: "Saha Testleri", href: PATHS.sahaTestleri },
            { label: "Oturum hub" },
          ]}
        />
        <PerformanceTabsNav activeKey="saha" />

        <FieldTestSessionSubNav />
      </header>

      {loadError ? (
        <div className="mt-4 min-w-0">
          <InlineErrorState
            errorKind="fetch_error"
            title="Oturum listesi yüklenemedi"
            description={loadError}
            onRetry={() => void fetchSessions()}
          />
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="ui-kpi-chip--brand rounded-2xl p-4 sm:p-5">
          <p className="ui-kpi-chip__refresh">Bugün</p>
          <p className="mt-2 text-lg font-black text-white">{formatSessionDateLabel(today)}</p>
          {todaySession ? (
            <p className="mt-2 text-[11px] font-bold text-gray-400">{sessionSummaryLine(todaySession)}</p>
          ) : (
            <p className="mt-2 text-[11px] font-bold text-gray-500">Henüz kayıt yok — yeni oturum başlatabilirsiniz.</p>
          )}
          <Link
            href={hrefFieldTestSession(today)}
            className="ui-btn-primary mt-4 inline-flex min-h-11 items-center justify-center gap-2"
          >
            <Plus size={14} aria-hidden />
            {todaySession ? "Bugünkü oturuma devam et" : "Bugünkü oturumu başlat"}
          </Link>
        </div>

        <div className="ui-card p-4 sm:p-5">
          <p className="text-[9px] font-black uppercase tracking-wider text-gray-500">Başka bir tarih</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Tarih seç</span>
              <div className="ui-card-inner flex min-h-11 items-center gap-2 px-3">
                <Calendar size={16} className="shrink-0 text-[color:var(--peaker-ui-PRIMARY)]" aria-hidden />
                <input
                  type="date"
                  value={pickDate}
                  onChange={(e) => setPickDate(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none"
                />
              </div>
            </label>
            <button
              type="button"
              onClick={() => router.push(hrefFieldTestSession(pickDate))}
              className="ui-btn-ghost min-h-11 px-4 text-[10px] font-black uppercase tracking-wide text-gray-200 sm:hover:border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_35%,transparent)] sm:hover:text-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_70%,white)]"
            >
              Oturuma git
            </button>
          </div>
        </div>
      </section>

      <section className="mt-8 min-w-0">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Geçmiş oturumlar</h2>
          {loading ? (
            <Loader2 className="size-4 animate-spin text-[color:var(--peaker-ui-PRIMARY)]" aria-label="Yükleniyor" />
          ) : null}
        </div>

        {!loading && sessions.length === 0 && !loadError ? (
          <EmptyState
            variant="no_data"
            title="Henüz oturum yok"
            description="İlk saha test oturumunuzu bugünkü tarihle başlatın."
          />
        ) : null}

        <ul className="space-y-2">
          {sessions.map((session) => (
            <li key={session.testDate}>
              <Link
                href={hrefFieldTestSession(session.testDate)}
                className="ui-kpi-band flex min-h-14 items-center justify-between gap-3 px-4 py-3 transition sm:hover:border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_35%,transparent)]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white">{formatSessionDateLabel(session.testDate)}</p>
                  <p className="mt-0.5 text-[10px] font-bold text-gray-500">{sessionSummaryLine(session)}</p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-gray-500" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
