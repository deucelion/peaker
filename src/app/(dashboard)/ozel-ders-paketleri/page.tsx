"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, PlusCircle, Wallet, CheckCircle2, History, AlertTriangle } from "lucide-react";
import Notification from "@/components/Notification";
import {
  addPrivateLessonUsage,
  createPrivateLessonPackage,
  listPrivateLessonFormOptions,
  listPrivateLessonPackagesForManagement,
  listPrivateLessonUsageForPackage,
  updatePrivateLessonPayment,
} from "@/lib/actions/privateLessonPackageActions";
import type { PrivateLessonPackage } from "@/lib/types";

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
  const [expandedPkgId, setExpandedPkgId] = useState<string | null>(null);
  const [usageByPkg, setUsageByPkg] = useState<Record<string, Array<{ id: string; usedAt: string; note: string | null }>>>({});
  const [usageLoadingId, setUsageLoadingId] = useState<string | null>(null);

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
      setFormError("Form gecersiz: toplam ders 1+ olmali ve odenen tutar toplam ucreti asmamali.");
      return;
    }
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
      setMessage("Paket olusturuldu.");
      setForm((prev) => ({ ...prev, packageName: "", totalPrice: "0", amountPaid: "0" }));
      await loadAll();
    } else {
      setMessage(res.error || "Paket olusturulamadi.");
    }
    setSaving(false);
  }

  async function onUseLesson(packageId: string) {
    const fd = new FormData();
    fd.append("packageId", packageId);
    fd.append("usedAt", new Date().toISOString());
    const res = await addPrivateLessonUsage(fd);
    if ("success" in res && res.success) {
      setMessage("Kullanim eklendi.");
      await loadAll();
    } else {
      setMessage(res.error || "Kullanim eklenemedi.");
    }
  }

  async function onSetPayment(packageId: string) {
    const value = window.prompt("Yeni tahsilat tutarini girin (bu tutar mevcut odenene eklenecek)", "");
    if (value === null) return;
    const noteValue = window.prompt("Odeme notu (opsiyonel)", "") ?? "";
    const fd = new FormData();
    fd.append("packageId", packageId);
    fd.append("paymentAmount", value);
    fd.append("note", noteValue);
    const res = await updatePrivateLessonPayment(fd);
    if ("success" in res && res.success) {
      setMessage("Tahsilat eklendi.");
      await loadAll();
    } else {
      setMessage(res.error || "Tahsilat eklenemedi.");
    }
  }

  async function toggleUsageHistory(packageId: string) {
    if (expandedPkgId === packageId) {
      setExpandedPkgId(null);
      return;
    }
    setExpandedPkgId(packageId);
    if (usageByPkg[packageId]) return;
    setUsageLoadingId(packageId);
    const res = await listPrivateLessonUsageForPackage(packageId);
    setUsageLoadingId(null);
    if ("error" in res) {
      setMessage(res.error);
      return;
    }
    setUsageByPkg((prev) => ({ ...prev, [packageId]: res.rows }));
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
          Grup derslerinden tamamen bagimsiz paket yonetimi
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
            variant={message.toLowerCase().includes("guncellendi") || message.toLowerCase().includes("olusturuldu") ? "success" : "info"}
          />
        </div>
      )}
      {formError && (
        <div className="min-w-0 break-words">
          <Notification message={formError} variant="error" />
        </div>
      )}

      <section id="paket-formu" className="ui-card !p-4 sm:!p-7 min-w-0">
        <h2 className="text-white font-black italic uppercase text-sm mb-1 break-words">Paket Oluştur</h2>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide sm:tracking-widest mb-4 sm:mb-6 break-words">
          Zorunlu alanlar <span className="text-rose-300">*</span> ile isaretlidir.
        </p>
        <form onSubmit={onCreatePackage} className="space-y-4 sm:space-y-5 min-w-0">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Sporcu Sec *">
              <div className="space-y-2">
                <input
                  type="search"
                  value={athleteSearch}
                  onChange={(e) => setAthleteSearch(e.target.value)}
                  placeholder="Sporcu ara..."
                  className="ui-input bg-black px-3"
                />
                <select
                  value={form.athleteId}
                  onChange={(e) => setForm((prev) => ({ ...prev, athleteId: e.target.value }))}
                  className="ui-select bg-black px-3"
                  required
                >
                  {filteredAthletes.map((a) => (
                    <option key={a.id} value={a.id}>{a.full_name}</option>
                  ))}
                </select>
                {filteredAthletes.length === 0 ? (
                  <p className="text-[10px] font-black uppercase text-gray-500">Aramaya uygun sporcu yok.</p>
                ) : null}
              </div>
            </Field>

            <Field label="Koç (opsiyonel)">
              <select
                value={form.coachId}
                onChange={(e) => setForm((prev) => ({ ...prev, coachId: e.target.value }))}
                className="ui-select bg-black px-3"
              >
                <option value="">Koç seçilmedi</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </Field>

            <Field label="Paket Turu *">
              <select
                value={form.packageType}
                onChange={(e) => setForm((prev) => ({ ...prev, packageType: e.target.value }))}
                className="ui-select bg-black px-3"
                required
              >
                <option value="private">Private</option>
                <option value="duet">Duet</option>
                <option value="elite">Elite 1:1</option>
              </select>
            </Field>

            <Field label="Paket Adi *">
              <input
                value={form.packageName}
                onChange={(e) => setForm((prev) => ({ ...prev, packageName: e.target.value }))}
                placeholder="Orn: Nisan 8 Ders Paketi"
                className="ui-input bg-black px-3 placeholder:text-gray-600"
                required
              />
            </Field>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Toplam Ders Sayisi *">
              <input
                type="number"
                min={1}
                value={form.totalLessons}
                onChange={(e) => setForm((prev) => ({ ...prev, totalLessons: e.target.value }))}
                className="ui-input bg-black px-3"
                required
              />
            </Field>
            <Field label="Toplam Ücret *">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-black" aria-hidden>
                  ₺
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.totalPrice}
                  onChange={(e) => setForm((prev) => ({ ...prev, totalPrice: e.target.value }))}
                  className="ui-input bg-black pl-8 pr-3"
                  required
                />
              </div>
            </Field>
            <Field label="Ödenen Tutar *">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-black" aria-hidden>
                  ₺
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.amountPaid}
                  onChange={(e) => setForm((prev) => ({ ...prev, amountPaid: e.target.value }))}
                  className="ui-input bg-black pl-8 pr-3"
                  required
                />
              </div>
            </Field>
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={saving || !isFormValid}
              className="ui-btn-primary w-full sm:w-auto px-5 gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <PlusCircle size={14} aria-hidden />}
              Paket Oluştur
            </button>
          </div>
        </form>
      </section>

      <PackageList
        title="Aktif Paketler"
        items={activePackages}
        onUseLesson={onUseLesson}
        onSetPayment={onSetPayment}
        expandedPkgId={expandedPkgId}
        usageByPkg={usageByPkg}
        usageLoadingId={usageLoadingId}
        onToggleUsage={toggleUsageHistory}
      />
      <PackageList
        title="Tamamlanan / Pasif Paketler"
        items={finishedPackages}
        onUseLesson={onUseLesson}
        onSetPayment={onSetPayment}
        expandedPkgId={expandedPkgId}
        usageByPkg={usageByPkg}
        usageLoadingId={usageLoadingId}
        onToggleUsage={toggleUsageHistory}
      />
    </div>
  );
}

function paymentLabel(s: PrivateLessonPackage["paymentStatus"]): string {
  if (s === "paid") return "Ödendi";
  if (s === "partial") return "Kısmi";
  return "Ödenmedi";
}

function PackageList({
  title,
  items,
  onUseLesson,
  onSetPayment,
  expandedPkgId,
  usageByPkg,
  usageLoadingId,
  onToggleUsage,
}: {
  title: string;
  items: PrivateLessonPackage[];
  onUseLesson: (packageId: string) => void;
  onSetPayment: (packageId: string) => void;
  expandedPkgId: string | null;
  usageByPkg: Record<string, Array<{ id: string; usedAt: string; note: string | null }>>;
  usageLoadingId: string | null;
  onToggleUsage: (packageId: string) => void;
}) {
  return (
    <section className="bg-[#121215] border border-white/5 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 min-w-0">
      <h2 className="text-white font-black italic uppercase text-sm mb-3 sm:mb-4 break-words">{title}</h2>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-6">
          <p className="text-[10px] text-gray-400 font-black uppercase">Henuz ozel ders paketi olusturulmamis.</p>
          <a
            href="#paket-formu"
            className="inline-flex min-h-11 items-center mt-3 text-[10px] font-black uppercase text-[#c4b5fd] touch-manipulation sm:hover:text-[#e9d5ff]"
          >
            Ilk paketi olustur
          </a>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((pkg) => {
            const low = pkg.isActive && pkg.remainingLessons > 0 && pkg.remainingLessons < 3;
            const blocked = !pkg.isActive || pkg.remainingLessons <= 0;
            return (
            <div key={pkg.id} className="border border-white/10 bg-black/20 rounded-xl p-3 sm:p-4 min-w-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between min-w-0">
                <div className="min-w-0 flex-1">
                  <Link href={`/ozel-ders-paketleri/${pkg.id}`} className="text-white font-black italic uppercase break-words underline-offset-2 sm:hover:underline">
                    {pkg.packageName}
                  </Link>
                  <p className="text-[10px] text-gray-500 font-bold uppercase mt-1 break-words">
                    {pkg.athleteName} • {pkg.packageType} • Koç: {pkg.coachName || "-"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-start sm:justify-end shrink-0">
                  {low && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-200 text-[9px] font-black uppercase">
                      <AlertTriangle size={12} aria-hidden /> Az ders ({pkg.remainingLessons})
                    </span>
                  )}
                  {blocked && pkg.usedLessons > 0 && (
                    <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-[9px] font-black uppercase">
                      Kullanım kapalı
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase">
                <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/10">Toplam {pkg.totalLessons}</span>
                <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/10">Kullanilan {pkg.usedLessons}</span>
                <span className="px-2 py-1 rounded-lg bg-[#7c3aed]/10 border border-[#7c3aed]/20 text-[#c4b5fd]">Kalan {pkg.remainingLessons}</span>
                <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/10">Ücret ₺{pkg.totalPrice}</span>
                <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/10">Ödenen ₺{pkg.amountPaid}</span>
                <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/10">{paymentLabel(pkg.paymentStatus)}</span>
              </div>
              <div className="mt-3 flex flex-col sm:flex-row flex-wrap gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => onUseLesson(pkg.id)}
                  disabled={blocked}
                  className="min-h-11 w-full sm:w-auto px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase disabled:opacity-40 inline-flex items-center justify-center gap-1 touch-manipulation sm:hover:bg-emerald-500/20"
                >
                  <CheckCircle2 size={12} aria-hidden /> Kullanım Ekle
                </button>
                <button
                  type="button"
                  onClick={() => onSetPayment(pkg.id)}
                  className="min-h-11 w-full sm:w-auto px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase inline-flex items-center justify-center gap-1 touch-manipulation sm:hover:bg-amber-500/20"
                >
                  <Wallet size={12} aria-hidden /> Tahsilat Ekle
                </button>
                <button
                  type="button"
                  onClick={() => onToggleUsage(pkg.id)}
                  className="min-h-11 w-full sm:w-auto px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-[10px] font-black uppercase inline-flex items-center justify-center gap-1 touch-manipulation sm:hover:bg-white/10"
                >
                  <History size={12} aria-hidden /> Kullanım geçmişi
                </button>
                {blocked && (
                  <a
                    href="#paket-formu"
                    className="min-h-11 w-full sm:w-auto px-3 py-2 rounded-lg bg-[#7c3aed]/15 border border-[#7c3aed]/30 text-[#c4b5fd] text-[10px] font-black uppercase inline-flex items-center justify-center touch-manipulation sm:hover:border-[#7c3aed]/50 sm:hover:text-[#e9d5ff]"
                  >
                    Paket yenile
                  </a>
                )}
              </div>
              {expandedPkgId === pkg.id && (
                <div className="mt-4 border-t border-white/10 pt-4">
                  {usageLoadingId === pkg.id ? (
                    <p className="text-[10px] text-gray-500 font-black uppercase">Yükleniyor...</p>
                  ) : (usageByPkg[pkg.id] || []).length === 0 ? (
                    <p className="text-[10px] text-gray-500 font-black uppercase">Kayıtlı kullanım yok.</p>
                  ) : (
                    <ul className="space-y-2 max-h-48 overflow-y-auto [-webkit-overflow-scrolling:touch] min-w-0">
                      {(usageByPkg[pkg.id] || []).map((u) => (
                        <li key={u.id} className="text-[10px] text-gray-400 font-bold border border-white/5 rounded-lg px-3 py-2 break-words">
                          {new Date(u.usedAt).toLocaleString("tr-TR")}
                          {u.note ? ` — ${u.note}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</span>
      {children}
    </label>
  );
}
