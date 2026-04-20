"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, PlusCircle, UserRound, Package, CircleDollarSign, ChevronDown, Check } from "lucide-react";
import Notification from "@/components/Notification";
import { createPrivateLessonPackage, listPrivateLessonFormOptions, listPrivateLessonPackagesForManagement } from "@/lib/actions/privateLessonPackageActions";
import type { PrivateLessonPackage } from "@/lib/types";
import { PackageCard } from "./_components/PackageCard";

const FORM_INPUT =
  "min-h-[3rem] w-full rounded-2xl border border-white/10 bg-[#0d0d11] px-4 py-3 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition placeholder:text-gray-600 focus:border-[#7c3aed]/60 focus:ring-2 focus:ring-[#7c3aed]/20 sm:text-base";

export default function PrivateLessonPackagesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [packages, setPackages] = useState<PrivateLessonPackage[]>([]);
  const [athletes, setAthletes] = useState<Array<{ id: string; full_name: string }>>([]);
  const [coaches, setCoaches] = useState<Array<{ id: string; full_name: string }>>([]);
  const [athleteSearch, setAthleteSearch] = useState("");
  const [form, setForm] = useState({
    athleteId: "",
    coachId: "",
    packageType: "private",
    packageName: "",
    totalLessons: "8",
    totalPrice: "0",
    amountPaid: "0",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitAttempted, setFormSubmitAttempted] = useState(false);

  const activePackages = useMemo(() => packages.filter((p) => p.isActive), [packages]);
  const finishedPackages = useMemo(() => packages.filter((p) => !p.isActive), [packages]);
  const filteredAthletes = useMemo(() => {
    const q = athleteSearch.trim().toLowerCase();
    if (!q) return athletes;
    return athletes.filter((athlete) => athlete.full_name.toLowerCase().includes(q));
  }, [athletes, athleteSearch]);
  const parsedTotalLessons = Number(form.totalLessons);
  const parsedTotalPrice = Number(form.totalPrice);
  const parsedAmountPaid = Number(form.amountPaid);
  const isFormValid =
    Boolean(form.athleteId) &&
    Boolean(form.packageType.trim()) &&
    Boolean(form.packageName.trim()) &&
    Number.isFinite(parsedTotalLessons) &&
    parsedTotalLessons > 0 &&
    Number.isFinite(parsedTotalPrice) &&
    parsedTotalPrice >= 0 &&
    Number.isFinite(parsedAmountPaid) &&
    parsedAmountPaid >= 0 &&
    parsedAmountPaid <= parsedTotalPrice;

  const step1Done = Boolean(form.athleteId);
  const step2Done =
    Boolean(form.packageName.trim()) &&
    Number.isFinite(parsedTotalLessons) &&
    parsedTotalLessons > 0 &&
    Boolean(form.packageType.trim());
  const step3Done =
    Number.isFinite(parsedTotalPrice) &&
    parsedTotalPrice >= 0 &&
    Number.isFinite(parsedAmountPaid) &&
    parsedAmountPaid >= 0 &&
    parsedAmountPaid <= parsedTotalPrice;

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [listRes, optionsRes] = await Promise.all([
      listPrivateLessonPackagesForManagement(),
      listPrivateLessonFormOptions(),
    ]);
    if ("error" in listRes) {
      setError(listRes.error);
      setLoading(false);
      return;
    }
    if ("error" in optionsRes) {
      setError(optionsRes.error);
      setLoading(false);
      return;
    }
    setPackages(listRes.packages);
    setAthletes(optionsRes.athletes);
    setCoaches(optionsRes.coaches);
    setForm((prev) => ({
      ...prev,
      athleteId: prev.athleteId || optionsRes.athletes[0]?.id || "",
      coachId: prev.coachId || "",
    }));
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void loadAll();
    }, 0);
    return () => clearTimeout(id);
  }, [loadAll]);

  async function onCreatePackage(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid) {
      setFormSubmitAttempted(true);
      setFormError(
        "Formu tamamlayın: sporcu seçili olmalı, paket adı ve ders sayısı dolu olmalı, ödenen tutar toplam ücreti aşmamalıdır."
      );
      return;
    }
    setFormSubmitAttempted(false);
    setSaving(true);
    setMessage(null);
    setFormError(null);
    const fd = new FormData();
    fd.append("athleteId", form.athleteId);
    fd.append("coachId", form.coachId);
    fd.append("packageType", form.packageType);
    fd.append("packageName", form.packageName);
    fd.append("totalLessons", form.totalLessons);
    fd.append("totalPrice", form.totalPrice);
    fd.append("amountPaid", form.amountPaid);
    const res = await createPrivateLessonPackage(fd);
    if ("success" in res && res.success) {
      setMessage("Paket oluşturuldu.");
      setForm((prev) => ({ ...prev, packageName: "", totalPrice: "0", amountPaid: "0" }));
      await loadAll();
    } else {
      setMessage(res.error || "Paket oluşturulamadı.");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-[50dvh] px-4 flex flex-col items-center justify-center gap-4 min-w-0 overflow-x-hidden pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] text-center">
        <Loader2 className="animate-spin text-[#7c3aed]" size={44} aria-hidden />
        <p className="text-gray-500 font-black italic uppercase text-[10px] tracking-wide sm:tracking-widest break-words max-w-md">
          Özel paketler yükleniyor...
        </p>
      </div>
    );
  }

  return (
    <div className="ui-page min-w-0 overflow-x-hidden pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      <header className="border-b border-white/5 pb-5 sm:pb-6 min-w-0">
        <h1 className="ui-h1 break-words">
          ÖZEL DERS <span className="text-[#7c3aed]">PAKETLERİ</span>
        </h1>
        <p className="ui-lead mt-2 break-words text-[9px] sm:text-[10px] tracking-[0.2em] sm:tracking-[0.3em]">
          Grup derslerinden tamamen bağımsız paket yönetimi
        </p>
      </header>

      {error && (
        <div className="min-w-0 break-words">
          <Notification message={error} variant="error" />
        </div>
      )}
      {message && (
        <div className="min-w-0 break-words">
          <Notification
            message={message}
            variant={
              message.toLowerCase().includes("güncellendi") ||
              message.toLowerCase().includes("guncellendi") ||
              message.toLowerCase().includes("oluşturuldu") ||
              message.toLowerCase().includes("olusturuldu")
                ? "success"
                : "info"
            }
          />
        </div>
      )}
      {formError && (
        <div className="min-w-0 break-words">
          <Notification message={formError} variant="error" />
        </div>
      )}

      <section
        id="paket-formu"
        className="relative mx-auto min-w-0 max-w-3xl overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-gradient-to-b from-[#16161c] via-[#131318] to-[#101014] px-4 py-8 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.85)] sm:rounded-[2rem] sm:px-8 sm:py-10"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7c3aed]/40 to-transparent" aria-hidden />

        <header className="mb-8 text-center sm:mb-10 sm:text-left">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.35em] text-[#c4b5fd]">Yeni paket</p>
          <h2 className="text-2xl font-black italic uppercase tracking-tight text-white sm:text-3xl">Paket oluştur</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm font-bold leading-relaxed text-gray-400 sm:mx-0">
            Sporcu için yeni özel ders paketi oluşturun. Önce sporcuyu seçin, ardından paket ve ödeme bilgilerini tamamlayın.
          </p>
        </header>

        <FormStepRail step1Done={step1Done} step2Done={step2Done} step3Done={step3Done} />

        <form onSubmit={onCreatePackage} className="mt-8 space-y-8 sm:mt-10 sm:space-y-10">
          <fieldset className="space-y-5 rounded-2xl border border-white/10 bg-black/30 p-5 sm:p-6">
            <legend className="sr-only">Sporcu ve koç</legend>
            <div className="flex flex-col gap-4 border-b border-white/5 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#7c3aed]/20 text-[#c4b5fd] ring-1 ring-[#7c3aed]/30">
                  <UserRound size={22} aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">1 · Sporcu ve koç</h3>
                  <p className="mt-1 text-[11px] font-bold text-gray-500">Paket kimin için; isteğe bağlı sorumlu koç.</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-rose-200">
                Zorunlu: sporcu <span aria-hidden>*</span>
              </span>
            </div>

            <div className="rounded-2xl border border-[#7c3aed]/30 bg-[#7c3aed]/10 p-4 ring-1 ring-[#7c3aed]/15 sm:p-5">
              <Field label="Sporcu seçimi" required hint="Listeyi daraltmak için arayın; paket bu sporcuya bağlanır.">
                <input
                  type="search"
                  value={athleteSearch}
                  onChange={(e) => setAthleteSearch(e.target.value)}
                  placeholder="Örn. ad veya soyad ile ara…"
                  className={FORM_INPUT}
                  autoComplete="off"
                />
                <div className="mt-3">
                  <SelectPremium
                    value={form.athleteId}
                    onChange={(e) => setForm((prev) => ({ ...prev, athleteId: e.target.value }))}
                    required
                  >
                    {filteredAthletes.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.full_name}
                      </option>
                    ))}
                  </SelectPremium>
                </div>
                {filteredAthletes.length === 0 ? (
                  <p className="mt-3 text-[11px] font-bold text-amber-300/90">
                    Aramaya uygun sporcu yok. Farklı bir arama deneyin veya kadroya sporcu ekleyin.
                  </p>
                ) : null}
              </Field>
            </div>

            <Field label="Koç (isteğe bağlı)" hint="Boş bırakılabilir; raporlama ve takip için atanmış koçu seçin.">
              <SelectPremium
                value={form.coachId}
                onChange={(e) => setForm((prev) => ({ ...prev, coachId: e.target.value }))}
              >
                <option value="">Koç seçilmedi</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </SelectPremium>
            </Field>
          </fieldset>

          <fieldset className="space-y-5 rounded-2xl border border-white/10 bg-black/30 p-5 sm:p-6">
            <legend className="sr-only">Paket bilgisi</legend>
            <div className="flex items-center gap-3 border-b border-white/5 pb-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-[#c4b5fd] ring-1 ring-white/10">
                <Package size={22} aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">2 · Paket bilgisi</h3>
                <p className="mt-1 text-[11px] font-bold text-gray-500">Paket adı, tür ve toplam ders sayısı.</p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Paket türü" required hint="Özel ders formatını seçin (kayıt değeri değişmez).">
                <SelectPremium
                  value={form.packageType}
                  onChange={(e) => setForm((prev) => ({ ...prev, packageType: e.target.value }))}
                  required
                >
                  <option value="private">Özel (1:1)</option>
                  <option value="duet">Düet (2 kişi)</option>
                  <option value="elite">Elite 1:1</option>
                </SelectPremium>
              </Field>

              <Field label="Paket adı" required hint="Kadroda ve listede görünecek kısa başlık.">
                <input
                  value={form.packageName}
                  onChange={(e) => setForm((prev) => ({ ...prev, packageName: e.target.value }))}
                  placeholder="Örn. Nisan 2026 · 8 ders paketi"
                  className={FORM_INPUT}
                  required
                />
              </Field>
            </div>

            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 sm:p-5">
              <Field
                label="Toplam ders sayısı"
                required
                hint="Pakete dahil edilen ders adedi. Sonradan kullanım kayıtlarıyla düşer."
              >
                <input
                  type="number"
                  min={1}
                  value={form.totalLessons}
                  onChange={(e) => setForm((prev) => ({ ...prev, totalLessons: e.target.value }))}
                  placeholder="Örn. 8"
                  className={`${FORM_INPUT} text-lg font-black tracking-tight`}
                  required
                />
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-5 rounded-2xl border border-white/10 bg-black/30 p-5 sm:p-6">
            <legend className="sr-only">Ödeme bilgisi</legend>
            <div className="flex items-center gap-3 border-b border-white/5 pb-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25">
                <CircleDollarSign size={22} aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">3 · Ödeme bilgisi</h3>
                <p className="mt-1 text-[11px] font-bold text-gray-500">Toplam ücret ve şu ana kadar tahsil edilen tutar.</p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Toplam ücret" required hint="Paket için belirlenen toplam tutar (₺).">
                <div className="relative">
                  <span
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-gray-500"
                    aria-hidden
                  >
                    ₺
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.totalPrice}
                    onChange={(e) => setForm((prev) => ({ ...prev, totalPrice: e.target.value }))}
                    placeholder="0,00"
                    className={`${FORM_INPUT} pl-10 text-lg font-black tracking-tight`}
                    required
                  />
                </div>
              </Field>

              <Field label="Ödenen tutar" required hint="Toplam ücreti aşmamalıdır; kısmi ödemede bakiye otomatik hesaplanır.">
                <div className="relative">
                  <span
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-gray-500"
                    aria-hidden
                  >
                    ₺
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.amountPaid}
                    onChange={(e) => setForm((prev) => ({ ...prev, amountPaid: e.target.value }))}
                    placeholder="0,00"
                    className={`${FORM_INPUT} pl-10 text-lg font-black tracking-tight`}
                    required
                  />
                </div>
              </Field>
            </div>
          </fieldset>

          <div className="min-h-12 px-0.5" aria-live="polite">
            {formSubmitAttempted && !isFormValid ? (
              <p className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-[11px] font-bold leading-snug text-rose-100">
                Lütfen formu kontrol edin: sporcu seçili olmalı, paket adı ve ders sayısı dolu olmalı, ödenen tutar toplam
                ücreti aşmamalıdır.
              </p>
            ) : (
              <p className="text-[11px] font-bold leading-relaxed text-gray-600">
                <span className="text-rose-400">*</span> ile işaretli alanlar zorunludur. Göndermeden önce tutarları ve
                ders sayısını doğrulayın.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-[#7c3aed]/35 bg-gradient-to-br from-[#7c3aed]/20 to-[#4c1d95]/10 p-4 sm:p-5">
            <button
              type="submit"
              disabled={saving || !isFormValid}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#7c3aed] px-6 py-4 text-sm font-black uppercase tracking-[0.15em] text-white shadow-lg shadow-[#7c3aed]/25 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4b5fd] enabled:sm:hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {saving ? (
                <>
                  <Loader2 size={22} className="animate-spin shrink-0" aria-hidden />
                  Oluşturuluyor…
                </>
              ) : (
                <>
                  <PlusCircle size={22} className="shrink-0" aria-hidden />
                  Paketi oluştur
                </>
              )}
            </button>
            <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Gönder ile paket kaydı oluşturulur; mevcut paket listesi otomatik yenilenir.
            </p>
          </div>
        </form>
      </section>

      <PackageList title="Aktif paketler" items={activePackages} />
      <PackageList title="Tamamlanan / pasif paketler" items={finishedPackages} />
    </div>
  );
}

function PackageList({ title, items }: { title: string; items: PrivateLessonPackage[] }) {
  return (
    <section className="min-w-0 rounded-[1.5rem] border border-white/5 bg-[#121215] p-4 sm:rounded-[2rem] sm:p-6">
      <h2 className="mb-4 break-words text-sm font-black italic uppercase tracking-tight text-white sm:mb-5 sm:text-base">
        {title}
      </h2>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center sm:py-10">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Bu listede henüz paket yok.</p>
          <a
            href="#paket-formu"
            className="mt-4 inline-flex min-h-11 items-center justify-center text-[10px] font-black uppercase text-[#c4b5fd] touch-manipulation sm:hover:text-[#e9d5ff]"
          >
            Yeni paket oluştur →
          </a>
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-5">
          {items.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      )}
    </section>
  );
}

function FormStepRail({
  step1Done,
  step2Done,
  step3Done,
}: {
  step1Done: boolean;
  step2Done: boolean;
  step3Done: boolean;
}) {
  const items = [
    { k: 1, t: "Sporcu seç", d: step1Done },
    { k: 2, t: "Paket bilgisi", d: step2Done },
    { k: 3, t: "Ödeme", d: step3Done },
  ] as const;

  return (
    <nav aria-label="Form adımları" className="min-w-0 border-b border-white/5 pb-6">
      <ol className="flex flex-row items-start justify-between gap-0 sm:items-center sm:gap-2">
        {items.map((s, idx) => (
          <Fragment key={s.k}>
            <li className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-xs font-black transition sm:h-11 sm:w-11 ${
                  s.d
                    ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                    : "border-white/20 bg-black/50 text-gray-500"
                }`}
              >
                {s.d ? <Check size={18} strokeWidth={3} aria-hidden /> : s.k}
              </span>
              <span
                className={`max-w-[5.5rem] text-[8px] font-black uppercase leading-tight tracking-wider sm:max-w-none sm:text-[9px] ${s.d ? "text-gray-300" : "text-gray-600"}`}
              >
                {s.t}
              </span>
            </li>
            {idx < items.length - 1 ? (
              <li
                className="mx-0.5 mt-5 hidden h-0.5 w-8 shrink-0 rounded-full bg-white/10 sm:mt-6 sm:block sm:w-12"
                aria-hidden
              />
            ) : null}
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

function SelectPremium({
  value,
  onChange,
  required,
  children,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        required={required}
        className="peer min-h-[3rem] w-full cursor-pointer appearance-none rounded-2xl border border-white/10 bg-[#0d0d11] py-3 pl-4 pr-12 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition focus:border-[#7c3aed]/60 focus:ring-2 focus:ring-[#7c3aed]/20 sm:text-base"
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 peer-focus:text-[#c4b5fd]"
        aria-hidden
      />
    </div>
  );
}

function Field({
  label,
  children,
  required,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</span>
        {required ? (
          <span className="text-[10px] font-black text-rose-400" aria-hidden>
            *
          </span>
        ) : null}
      </div>
      {children}
      {hint ? <p className="text-[10px] font-bold leading-relaxed text-gray-600">{hint}</p> : null}
    </div>
  );
}

