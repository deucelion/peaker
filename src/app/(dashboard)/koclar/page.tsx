"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, Search, Users, ChevronRight, UserPlus2, X } from "lucide-react";
import Notification from "@/components/Notification";
import EmptyStateCard from "@/components/EmptyStateCard";
import { mapCoach } from "@/lib/mappers";
import type { CoachProfile } from "@/lib/types";
import { addCoach, loadCoachesPageData } from "@/lib/actions/coachActions";
import { normalizeEmailInput } from "@/lib/email/emailNormalize";

function CoachesPageContent() {
  const searchParams = useSearchParams();
  const orgFromQuery = searchParams.get("org")?.trim() || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coaches, setCoaches] = useState<CoachProfile[]>([]);
  const [upcomingCountByCoach, setUpcomingCountByCoach] = useState<Record<string, number>>({});
  const [lessonCountersByCoach, setLessonCountersByCoach] = useState<
    Record<string, { today: number; upcoming: number; past: number; total: number }>
  >({});
  const [resolvedOrgId, setResolvedOrgId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [coachForm, setCoachForm] = useState({ fullName: "", email: "", password: "" });
  const [coachSubmitting, setCoachSubmitting] = useState(false);
  const [coachFeedback, setCoachFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchData = useCallback(async () => {
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
      setLessonCountersByCoach(bundle.lessonCountersByCoach || {});
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Bilinmeyen hata";
      setError(`Koçlar yüklenemedi: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [orgFromQuery]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  async function handleCoachCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCoachSubmitting(true);
    setCoachFeedback(null);
    const fd = new FormData();
    fd.append("fullName", coachForm.fullName.trim());
    fd.append("email", normalizeEmailInput(coachForm.email));
    fd.append("password", coachForm.password);
    if (resolvedOrgId) {
      fd.append("organizationId", resolvedOrgId);
    }
    const result = await addCoach(fd);
    if (result && "success" in result && result.success) {
      setCoachFeedback({ type: "success", message: "Koç başarıyla oluşturuldu." });
      setCoachForm({ fullName: "", email: "", password: "" });
      await fetchData();
      setShowCreateModal(false);
    } else {
      setCoachFeedback({
        type: "error",
        message: (result && "error" in result && result.error) || "Koç oluşturulurken hata oluştu.",
      });
    }
    setCoachSubmitting(false);
  }

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
        <p className="text-center text-[10px] font-black uppercase italic tracking-widest text-gray-500">Koçlar yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="ui-page min-w-0 overflow-x-hidden pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex min-w-0 flex-col gap-4 border-b border-white/5 pb-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="ui-h1">
            Koç <span className="text-[#7c3aed]">Yönetimi</span>
          </h1>
          <p className="ui-lead break-words">
            Organizasyondaki tüm koçları görüntüleyin.
          </p>
        </div>
        <div className="flex w-full min-w-0 shrink-0 gap-2 md:w-auto">
          <div className="relative min-w-0 flex-1 md:w-80">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16} aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Koç ara..."
              className="ui-input min-h-11 bg-[#121215] border-white/5 pl-10 italic uppercase text-base sm:text-xs touch-manipulation"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#7c3aed]/35 bg-[#7c3aed]/15 px-3 text-[10px] font-black uppercase tracking-wide text-[#ddd6fe] transition sm:hover:bg-[#7c3aed]/25"
          >
            <UserPlus2 size={14} aria-hidden />
            Yeni Koç Ekle
          </button>
        </div>
      </header>

      {error ? (
        <div className="min-w-0 break-words">
          <Notification message={error} variant="error" />
        </div>
      ) : null}

      {!error && filtered.length === 0 && (
        <div className="rounded-[2rem] border border-white/5 bg-[#121215] p-8 sm:p-16">
          <Users size={40} className="mx-auto mb-4 text-gray-700" aria-hidden />
          <EmptyStateCard
            title="Kayıt bulunamadı"
            description={coaches.length === 0 ? "Bu organizasyonda henüz koç kaydı yok." : "Arama kriterine uygun koç bulunamadı."}
            reason={coaches.length === 0 ? "Koç profili oluşturulmamış olabilir." : "Arama metni mevcut koçlarla eşleşmiyor olabilir."}
            primaryAction={coaches.length === 0 ? { label: "Yeni koç ekle", onClick: () => setShowCreateModal(true) } : { label: "Aramayı temizle", onClick: () => setSearch("") }}
            secondaryAction={
              coaches.length === 0
                ? undefined
                : { label: "Yeni koç ekle", onClick: () => setShowCreateModal(true) }
            }
            compact
          />
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
                    {coach.isActive ? "Aktif" : "Pasif"}
                  </span>
                  <span className="ui-badge-neutral text-[#c4b5fd] border-[#7c3aed]/20 bg-[#7c3aed]/10 shrink-0">
                    Bugün {lessonCountersByCoach[coach.id]?.today || 0}
                  </span>
                  <span className="ui-badge-neutral text-[#c4b5fd] border-[#7c3aed]/20 bg-[#7c3aed]/10 shrink-0">
                    Yaklaşan {upcomingCountByCoach[coach.id] || 0}
                  </span>
                  <span className="ui-badge-neutral text-gray-300 border-white/10 bg-white/5 shrink-0">
                    Toplam {lessonCountersByCoach[coach.id]?.total || 0}
                  </span>
                  <ChevronRight size={16} className="ml-auto shrink-0 text-gray-600 sm:ml-0 sm:group-hover:text-[#7c3aed]" aria-hidden />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showCreateModal ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="relative w-full max-w-lg rounded-t-[2rem] border border-white/10 bg-[#121215] p-5 sm:rounded-[2rem] sm:p-6">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-400"
              aria-label="Kapat"
            >
              <X size={16} aria-hidden />
            </button>
            <h3 className="text-lg font-black uppercase text-white">Yeni Koç Ekle</h3>
            <p className="mt-1 text-[11px] font-semibold text-gray-500">Koç hesabını oluşturup listeye ekleyin.</p>

            <form onSubmit={handleCoachCreate} className="mt-5 space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase text-gray-500">Ad Soyad</label>
                <input
                  required
                  value={coachForm.fullName}
                  onChange={(e) => setCoachForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  className="ui-input min-h-11 w-full bg-black/40"
                  placeholder="Ad Soyad"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase text-gray-500">E-posta</label>
                <input
                  required
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  value={coachForm.email}
                  onChange={(e) => setCoachForm((prev) => ({ ...prev, email: normalizeEmailInput(e.target.value) }))}
                  className="ui-input min-h-11 w-full bg-black/40"
                  placeholder="E-posta"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase text-gray-500">Geçici Şifre</label>
                <input
                  required
                  type="text"
                  minLength={6}
                  autoComplete="new-password"
                  value={coachForm.password}
                  onChange={(e) => setCoachForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="ui-input min-h-11 w-full bg-black/40"
                  placeholder="Geçici Şifre"
                />
              </div>
              <button
                type="submit"
                disabled={coachSubmitting}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#7c3aed] px-4 text-[10px] font-black uppercase tracking-wide text-white disabled:opacity-60"
              >
                {coachSubmitting ? "Oluşturuluyor..." : "Koçu Oluştur"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {coachFeedback ? (
        <div className="min-w-0 break-words">
          <Notification message={coachFeedback.message} variant={coachFeedback.type} />
        </div>
      ) : null}
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
