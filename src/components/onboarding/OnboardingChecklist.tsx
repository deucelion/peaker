"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Sparkles, X } from "lucide-react";

/**
 * Faz 5.3 — Admin Onboarding Checklist.
 *
 * Yeni admin sisteme girdiğinde "şimdi ne yapacağım?" sorusunu yaşamasın diye
 * dashboard üstüne sade bir adım listesi koyar. Her adımın kendi kontrol
 * sinyali var (totalPlayers > 0, lessons > 0, vs.) ve tamamlanan adım
 * otomatik tikli görünür.
 *
 * Kapsam içi özellikler:
 *   - Adımlar tek bakışta okunsun (compact, max 6).
 *   - Tüm adımlar tamamsa component otomatik gizlenir.
 *   - Kullanıcı dismiss ederse localStorage'a kaydedilir; org bazlı.
 *   - Tek tıkla ilgili sayfaya yönlendirir.
 *
 * Kapsam dışı (Faz 6 backlog):
 *   - Persisted onboarding flag DB tarafında.
 *   - Org-bazlı progress paylaşımı.
 *   - Yönetilen "ilk hafta" kart akışı.
 */

export type OnboardingStepKey =
  | "org_profile"
  | "first_athlete"
  | "first_team"
  | "first_lesson"
  | "first_field_test_metric"
  | "first_payment";

export type OnboardingProgress = {
  organizationId: string | null;
  /** Org adı varsayılan "PEAKER LAB" değilse organizasyon ayarı yapılmış sayılır. */
  hasCustomOrgName: boolean;
  totalAthletes: number;
  totalTeams: number;
  /** Toplam ders sayısı (haftalık planda görünenler dahil). 0 ise henüz ders yok. */
  totalLessons: number;
  /** Saha testi metrik tanımı sayısı. 0 ise henüz metrik yok. */
  totalFieldTestMetrics: number;
  /** Tahsilat sayısı (paid + pending). 0 ise henüz hiç ödeme kaydı yok. */
  totalPayments: number;
};

const STORAGE_KEY = "peaker.onboarding.dismissed.v1";

function isDismissed(orgId: string | null): boolean {
  if (typeof window === "undefined" || !orgId) return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return Boolean(parsed?.[orgId]);
  } catch {
    return false;
  }
}

function persistDismiss(orgId: string | null) {
  if (typeof window === "undefined" || !orgId) return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    parsed[orgId] = true;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // localStorage erişimi engelli olabilir; sessizce yut.
  }
}

type StepDef = {
  key: OnboardingStepKey;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  isComplete: (p: OnboardingProgress) => boolean;
};

const STEPS: ReadonlyArray<StepDef> = [
  {
    key: "org_profile",
    title: "Organizasyon ayarlarını tamamla",
    description: "Kulüp adını ve saat dilimini güncelle.",
    ctaLabel: "Org ayarlarına git",
    ctaHref: "/",
    isComplete: (p) => p.hasCustomOrgName,
  },
  {
    key: "first_athlete",
    title: "İlk sporcunu ekle",
    description: "Performans, finans ve programlar için en az bir sporcu gerekli.",
    ctaLabel: "Sporcu ekle",
    ctaHref: "/sporcular/yeni",
    isComplete: (p) => p.totalAthletes > 0,
  },
  {
    key: "first_team",
    title: "İlk takımı oluştur",
    description: "Sporcuları takımlara böl, raporlamada gruplandırma kolaylaşır.",
    ctaLabel: "Takım yönetimi",
    ctaHref: "/oyuncular?workspace=teams",
    isComplete: (p) => p.totalTeams > 0,
  },
  {
    key: "first_lesson",
    title: "İlk ders programını oluştur",
    description: "Haftalık ders planı oluşturarak akışı başlat.",
    ctaLabel: "Ders oluştur",
    ctaHref: "/dersler",
    isComplete: (p) => p.totalLessons > 0,
  },
  {
    key: "first_field_test_metric",
    title: "İlk saha testi metriğini tanımla",
    description: "Hız, dayanıklılık veya çeviklik gibi metrikleri açarak performans takibini başlat.",
    ctaLabel: "Saha testleri",
    ctaHref: "/saha-testleri",
    isComplete: (p) => p.totalFieldTestMetrics > 0,
  },
  {
    key: "first_payment",
    title: "İlk tahsilatı kaydet",
    description: "Aylık aidat veya özel ders ödemesi ekleyerek finansı çalıştır.",
    ctaLabel: "Tahsilat ekle",
    ctaHref: "/tahsilat-merkezi",
    isComplete: (p) => p.totalPayments > 0,
  },
];

export function OnboardingChecklist({
  progress,
  className = "",
}: {
  progress: OnboardingProgress;
  className?: string;
}) {
  const [dismissed, setDismissed] = useState(false);

  // Hydration sonrası localStorage okuma. SSR'de localStorage yok, bu nedenle
  // ilk render `dismissed=false` döner; mount'tan sonra gerçek değer set edilir.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(isDismissed(progress.organizationId));
  }, [progress.organizationId]);

  const completed = STEPS.filter((s) => s.isComplete(progress));
  const remaining = STEPS.filter((s) => !s.isComplete(progress));
  const allDone = remaining.length === 0;

  if (dismissed || allDone) return null;

  const totalCount = STEPS.length;
  const completedCount = completed.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  return (
    <section
      className={`rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.04] p-4 sm:p-5 ${className}`}
      aria-label="İlk kullanım rehberi"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="shrink-0 rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-2 text-emerald-300">
            <Sparkles size={18} aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-black uppercase tracking-tight text-emerald-100">
              İlk kullanım rehberi
            </h2>
            <p className="mt-1 text-[11px] font-semibold text-emerald-200/80">
              {completedCount}/{totalCount} adım tamamlandı · %{progressPct}
            </p>
            <div
              className="mt-2 h-1.5 w-full max-w-[280px] overflow-hidden rounded-full bg-emerald-900/40"
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-emerald-400 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            persistDismiss(progress.organizationId);
            setDismissed(true);
          }}
          aria-label="İlk kullanım rehberini kapat"
          className="inline-flex size-9 items-center justify-center rounded-xl border border-emerald-500/20 text-emerald-200/80 hover:border-emerald-500/40 hover:text-white"
        >
          <X size={14} aria-hidden />
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        {STEPS.map((step) => {
          const done = step.isComplete(progress);
          return (
            <li
              key={step.key}
              className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border px-3 py-2.5 ${
                done
                  ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-100"
                  : "border-white/10 bg-black/25 text-gray-200"
              }`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border ${
                    done
                      ? "border-emerald-400 bg-emerald-400/20 text-emerald-200"
                      : "border-white/20 bg-black/40 text-gray-400"
                  }`}
                  aria-hidden
                >
                  {done ? <Check size={12} /> : null}
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-xs font-black uppercase tracking-tight ${
                      done ? "text-emerald-100 line-through opacity-80" : "text-white"
                    }`}
                  >
                    {step.title}
                  </p>
                  <p className="mt-0.5 break-words text-[11px] font-semibold text-gray-400">
                    {step.description}
                  </p>
                </div>
              </div>
              {!done ? (
                <Link
                  href={step.ctaHref}
                  className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 text-[10px] font-black uppercase tracking-wide text-emerald-100 hover:border-emerald-400/60 hover:text-white"
                >
                  {step.ctaLabel}
                  <ChevronRight size={12} aria-hidden />
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default OnboardingChecklist;
