"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, Search, Users, ChevronRight } from "lucide-react";
import Notification from "@/components/Notification";
import { mapCoach } from "@/lib/mappers";
import type { CoachProfile } from "@/lib/types";
import { loadCoachesPageData } from "@/lib/actions/coachActions";

function CoachesPageContent() {
  const searchParams = useSearchParams();
  const orgFromQuery = searchParams.get("org")?.trim() || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coaches, setCoaches] = useState<CoachProfile[]>([]);
  const [upcomingCountByCoach, setUpcomingCountByCoach] = useState<Record<string, number>>({});
  const [resolvedOrgId, setResolvedOrgId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const bundle = await loadCoachesPageData(orgFromQuery || null);
        if ("error" in bundle) {
          setError(bundle.error ?? "Koç listesi yüklenemedi.");
          return;
        }
        setResolvedOrgId(bundle.organizationId);
        setCoaches((bundle.coaches || []).map((row) => mapCoach(row)));
        setUpcomingCountByCoach(bundle.upcomingCountByCoach);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Bilinmeyen hata";
        setError(`Koçlar yüklenemedi: ${message}`);
      } finally {
        setLoading(false);
      }
    }

    void fetchData();
  }, [orgFromQuery]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base =
      !q
        ? coaches
        : coaches.filter(
            (coach) =>
              coach.fullName.toLowerCase().includes(q) ||
              coach.email.toLowerCase().includes(q) ||
              coach.expertise.toLowerCase().includes(q)
          );
    return [...base].sort((a, b) => Number(b.isActive) - Number(a.isActive));
  }, [coaches, search]);

  const detailQuery = resolvedOrgId ? `?org=${encodeURIComponent(resolvedOrgId)}` : "";

  if (loading) {
    return (
      <div className="flex min-h-[50dvh] min-w-0 flex-col items-center justify-center gap-4 overflow-x-hidden px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        <Loader2 className="animate-spin text-[#7c3aed]" size={44} aria-hidden />
        <p className="text-center text-[10px] font-black uppercase italic tracking-widest text-gray-500">Koçlar Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="ui-page min-w-0 overflow-x-hidden pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex min-w-0 flex-col gap-4 border-b border-white/5 pb-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="ui-h1">
            KOÇ <span className="text-[#7c3aed]">YÖNETİMİ</span>
          </h1>
          <p className="ui-lead break-words">
            Organizasyondaki tüm koçlar
          </p>
        </div>
        <div className="relative w-full min-w-0 shrink-0 md:w-80">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16} aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="KOÇ ARA..."
            className="ui-input min-h-11 bg-[#121215] border-white/5 pl-10 italic uppercase text-base sm:text-xs touch-manipulation"
          />
        </div>
      </header>

      {error ? (
        <div className="min-w-0 break-words">
          <Notification message={error} variant="error" />
        </div>
      ) : null}

      {!error && filtered.length === 0 && (
        <div className="rounded-[2rem] border border-white/5 bg-[#121215] p-8 text-center sm:p-16">
          <Users size={40} className="mx-auto mb-4 text-gray-700" aria-hidden />
          <p className="text-gray-500 font-black italic uppercase tracking-widest text-xs">
            {coaches.length === 0 ? "Bu organizasyonda koç bulunmuyor." : "Aramaya uygun koç bulunamadı."}
          </p>
        </div>
      )}

      {!error && filtered.length > 0 && (
        <div className="grid gap-3 min-w-0">
          {filtered.map((coach) => (
            <Link
              key={coach.id}
              href={`/koclar/${coach.id}${detailQuery}`}
              className="group block min-w-0 touch-manipulation rounded-[1.75rem] border border-white/5 bg-[#121215] p-4 transition-all sm:p-5 sm:hover:border-[#7c3aed]/30"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0">
                <div className="min-w-0 flex-1">
                  <p className="text-base sm:text-lg font-black italic text-white uppercase break-words">{coach.fullName}</p>
                  <p className="text-[10px] font-bold text-gray-500 italic break-all">{coach.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] font-black uppercase min-w-0">
                  <span className="ui-badge-neutral break-all max-w-full">{coach.phone}</span>
                  <span className="ui-badge-neutral break-words max-w-full">{coach.expertise}</span>
                  <span
                    className={coach.isActive ? "ui-badge-success" : "ui-badge-danger"}
                  >
                    {coach.isActive ? "AKTIF" : "PASIF"}
                  </span>
                  <span className="ui-badge-neutral text-[#c4b5fd] border-[#7c3aed]/20 bg-[#7c3aed]/10 shrink-0">
                    YAKLASAN {upcomingCountByCoach[coach.id] || 0}
                  </span>
                  <ChevronRight size={16} className="ml-auto shrink-0 text-gray-600 sm:ml-0 sm:group-hover:text-[#7c3aed]" aria-hidden />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CoachesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50dvh] min-w-0 flex-col items-center justify-center gap-4 overflow-x-hidden px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
          <Loader2 className="animate-spin text-[#7c3aed]" size={44} aria-hidden />
          <p className="text-center text-[10px] font-black uppercase italic tracking-widest text-gray-500">Koçlar Yükleniyor...</p>
        </div>
      }
    >
      <CoachesPageContent />
    </Suspense>
  );
}
