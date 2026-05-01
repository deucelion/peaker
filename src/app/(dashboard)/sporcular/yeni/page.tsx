"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import Notification from "@/components/Notification";
import { createAthleteWithPackageAndPayment } from "@/lib/actions/athleteOnboardingActions";
import { createTeamAction, listTeamsForActor } from "@/lib/actions/teamActions";
import { useUnsavedChangesGuard } from "@/lib/hooks/useUnsavedChangesGuard";

type OnboardingMode = "none" | "private_lesson" | "monthly_subscription";

const STEPS = [
  "Temel Bilgiler",
  "Sporcu Profili",
  "Paket Tipi",
  "Paket Detayı",
  "Ödeme",
  "Onay",
];

export default function NewAthleteOnboardingPage() {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [successState, setSuccessState] = useState<{ athleteId: string | null } | null>(null);
  const [mode, setMode] = useState<OnboardingMode>("none");
  const [teamOptions, setTeamOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [teamBusy, setTeamBusy] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    teamId: "",
    position: "",
    height: "",
    weight: "",
    totalLessons: "",
    packageTotalPrice: "",
    packageStartDate: "",
    monthlyAmount: "",
    monthlyStartDate: "",
    paymentPaid: "",
    paymentDate: new Date().toISOString().slice(0, 10),
  });

  const derivedTotalAmount = useMemo(() => {
    if (mode === "private_lesson") return Number(form.packageTotalPrice || "0");
    if (mode === "monthly_subscription") return Number(form.monthlyAmount || "0");
    return 0;
  }, [mode, form.packageTotalPrice, form.monthlyAmount]);

  const paymentRemaining = useMemo(() => {
    const total = derivedTotalAmount;
    const paid = Number(form.paymentPaid || "0");
    const rem = Number.isFinite(total) && Number.isFinite(paid) ? total - paid : 0;
    return Math.max(rem, 0);
  }, [form.paymentPaid, derivedTotalAmount]);

  const hasDraftChanges = useMemo(() => {
    if (successState) return false;
    if (step > 0 || mode !== "none") return true;
    return Object.entries(form).some(([key, value]) => {
      if (key === "paymentDate") return false;
      return String(value || "").trim().length > 0;
    });
  }, [form, mode, step, successState]);

  useUnsavedChangesGuard({ enabled: hasDraftChanges && !saving });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await listTeamsForActor();
      if (cancelled || "error" in res) return;
      const next = (res.teams || []).map((team) => ({ id: team.id as string, name: team.name as string }));
      setTeamOptions(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function nextStep() {
    setStep((p) => Math.min(STEPS.length - 1, p + 1));
  }
  function prevStep() {
    setStep((p) => Math.max(0, p - 1));
  }

  function validateStep(): string | null {
    if (step === 0) {
      if (!form.fullName.trim()) return "Ad soyad zorunludur.";
      if (!form.email.trim()) return "E-posta zorunludur.";
      if ((form.password || "").trim().length < 6) return "Şifre en az 6 karakter olmalıdır.";
    }
    if (step === 3 && mode === "private_lesson") {
      if (!form.totalLessons) return "Toplam ders sayısı zorunludur.";
      if (!form.packageTotalPrice) return "Toplam ücret zorunludur.";
      if (!form.packageStartDate) return "Başlangıç tarihi zorunludur.";
    }
    if (step === 3 && mode === "monthly_subscription") {
      if (!form.monthlyAmount) return "Aylık ücret zorunludur.";
      if (!form.monthlyStartDate) return "Başlangıç tarihi zorunludur.";
    }
    if (step === 4) {
      if (!form.paymentDate) return "Ödeme tarihi zorunludur.";
      if (Number(form.paymentPaid || "0") > derivedTotalAmount) return "Ödenen tutar toplam ücreti aşamaz.";
    }
    return null;
  }

  async function handleSubmit() {
    const issue = validateStep();
    if (issue) {
      setMessage(issue);
      return;
    }
    setSaving(true);
    setMessage(null);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append("paymentTotal", String(Number.isFinite(derivedTotalAmount) ? derivedTotalAmount : 0));
    fd.append("onboardingMode", mode);
    const res = await createAthleteWithPackageAndPayment(fd);
    if ("success" in res && res.success) {
      setMessage("Yeni sporcu kaydı başarıyla tamamlandı.");
      setSuccessState({ athleteId: ("athleteId" in res && res.athleteId) || null });
    } else {
      setMessage(("error" in res && res.error) || "Yeni sporcu kaydı tamamlanamadı.");
    }
    setSaving(false);
  }

  async function handleCreateTeam() {
    const name = newTeamName.trim();
    if (!name) {
      setMessage("Takım adı zorunludur.");
      return;
    }
    setTeamBusy(true);
    const fd = new FormData();
    fd.append("name", name);
    const res = await createTeamAction(fd);
    if ("error" in res) {
      setMessage(res.error || "Takım oluşturulamadı.");
      setTeamBusy(false);
      return;
    }
    const listRes = await listTeamsForActor();
    if (!("error" in listRes)) {
      const next = (listRes.teams || []).map((team) => ({ id: team.id as string, name: team.name as string }));
      setTeamOptions(next);
      const created = next.find((team) => team.name.toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"));
      setForm((p) => ({ ...p, teamId: created?.id || p.teamId }));
    }
    setNewTeamName("");
    setMessage("Takım oluşturuldu.");
    setTeamBusy(false);
  }

  function resetForNewRecord() {
    setSuccessState(null);
    setMessage(null);
    setStep(0);
    setForm({
      fullName: "",
      email: "",
      password: "",
      phone: "",
      teamId: "",
      position: "",
      height: "",
      weight: "",
      totalLessons: "",
      packageTotalPrice: "",
      packageStartDate: "",
      monthlyAmount: "",
      monthlyStartDate: "",
      paymentPaid: "",
      paymentDate: new Date().toISOString().slice(0, 10),
    });
    setMode("none");
  }

  return (
    <div className="ui-page min-w-0 overflow-x-hidden pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      <header className="border-b border-white/5 pb-5">
        <Link href="/oyuncular" className="mb-3 inline-flex min-h-11 items-center gap-2 text-xs font-black uppercase text-gray-400 sm:hover:text-white">
          <ArrowLeft size={16} aria-hidden /> Kadroya dön
        </Link>
        <h1 className="ui-h1">
          Yeni sporcu <span className="text-[#7c3aed]">kaydı</span>
        </h1>
        <p className="ui-lead max-w-3xl break-words normal-case tracking-normal">
          Bu akış sporcu oluşturma, paket bağlama ve ilk ödeme başlatmayı tek süreçte yönetir.
        </p>
      </header>

      {message ? (
        <Notification
          message={message}
          variant={message.toLowerCase().includes("başarı") || message.toLowerCase().includes("tamamlandı") ? "success" : "error"}
        />
      ) : null}

      {successState ? (
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <h2 className="text-sm font-black uppercase tracking-wide text-emerald-100">Kayıt tamamlandı</h2>
          <p className="mt-2 text-sm font-bold text-emerald-50/90">
            Yeni sporcu kaydı başarıyla oluşturuldu. Devam etmek için bir sonraki adımı seçin.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {successState.athleteId ? (
              <Link href={`/sporcu/${successState.athleteId}`} className="ui-btn-primary min-h-11 px-4">
                Sporcu detayına git
              </Link>
            ) : null}
            <Link href="/oyuncular" className="ui-btn-ghost min-h-11 px-4">
              Listeye dön
            </Link>
            <button type="button" onClick={resetForNewRecord} className="ui-btn-ghost min-h-11 px-4">
              Yeni sporcu kaydı başlat
            </button>
          </div>
        </section>
      ) : (
      <section className="rounded-2xl border border-white/10 bg-[#121217] p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wider ${
                i === step
                  ? "border-[#7c3aed]/50 bg-[#7c3aed]/15 text-[#e8ddff]"
                  : i < step
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    : "border-white/10 bg-black/20 text-gray-500"
              }`}
            >
              {i + 1}. {label}
            </div>
          ))}
        </div>
      </section>
      )}

      {!successState ? (
      <section className="rounded-2xl border border-white/10 bg-[#121215] p-5 sm:p-6">
        {step === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="ui-field sm:col-span-2">
              <span className="ui-label">Ad soyad</span>
              <input className="ui-input" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
            </label>
            <label className="ui-field">
              <span className="ui-label">E-posta</span>
              <input className="ui-input" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            </label>
            <label className="ui-field">
              <span className="ui-label">Şifre</span>
              <input className="ui-input" type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
            </label>
            <label className="ui-field sm:col-span-2">
              <span className="ui-label">Telefon (opsiyonel)</span>
              <input className="ui-input" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            </label>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="ui-field">
              <span className="ui-label">Takım</span>
              <select className="ui-select" value={form.teamId} onChange={(e) => setForm((p) => ({ ...p, teamId: e.target.value }))}>
                <option value="">Takım seçin</option>
                {teamOptions.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="ui-field"><span className="ui-label">Pozisyon</span><input className="ui-input" value={form.position} onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))} /></label>
            <label className="ui-field"><span className="ui-label">Boy (cm)</span><input className="ui-input" type="number" value={form.height} onChange={(e) => setForm((p) => ({ ...p, height: e.target.value }))} /></label>
            <label className="ui-field"><span className="ui-label">Kilo (kg)</span><input className="ui-input" type="number" value={form.weight} onChange={(e) => setForm((p) => ({ ...p, weight: e.target.value }))} /></label>
            <div className="ui-field sm:col-span-2">
              <span className="ui-label">Yeni takım oluştur</span>
              <div className="flex gap-2">
                <input className="ui-input" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="Takım adı" />
                <button type="button" onClick={() => void handleCreateTeam()} disabled={teamBusy} className="ui-btn-ghost min-h-11 shrink-0 px-4">
                  {teamBusy ? "Oluşturuluyor..." : "Takım ekle"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-3">
            <button type="button" onClick={() => setMode("none")} className={`rounded-xl border px-4 py-3 text-left ${mode === "none" ? "border-[#7c3aed]/40 bg-[#7c3aed]/10" : "border-white/10 bg-black/20"}`}>
              <p className="text-sm font-black text-white">Paket yok</p>
              <p className="mt-1 text-xs font-bold text-gray-400">Yalnızca sporcu profili oluşturur.</p>
            </button>
            <button type="button" onClick={() => setMode("private_lesson")} className={`rounded-xl border px-4 py-3 text-left ${mode === "private_lesson" ? "border-[#7c3aed]/40 bg-[#7c3aed]/10" : "border-white/10 bg-black/20"}`}>
              <p className="text-sm font-black text-white">Özel ders paketi</p>
              <p className="mt-1 text-xs font-bold text-gray-400">Ders sayısı ve toplam ücret tanımlanır.</p>
            </button>
            <button type="button" onClick={() => setMode("monthly_subscription")} className={`rounded-xl border px-4 py-3 text-left ${mode === "monthly_subscription" ? "border-[#7c3aed]/40 bg-[#7c3aed]/10" : "border-white/10 bg-black/20"}`}>
              <p className="text-sm font-black text-white">Aylık abonelik</p>
              <p className="mt-1 text-xs font-bold text-gray-400">Aylık ücret ve ödeme akışı tanımlanır.</p>
            </button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {mode === "private_lesson" ? (
              <>
                <label className="ui-field"><span className="ui-label">Toplam ders sayısı</span><input className="ui-input" type="number" value={form.totalLessons} onChange={(e) => setForm((p) => ({ ...p, totalLessons: e.target.value }))} /></label>
                <label className="ui-field"><span className="ui-label">Toplam ücret</span><input className="ui-input" type="number" step="0.01" value={form.packageTotalPrice} onChange={(e) => setForm((p) => ({ ...p, packageTotalPrice: e.target.value }))} /></label>
                <label className="ui-field sm:col-span-2"><span className="ui-label">Başlangıç tarihi</span><input className="ui-input" type="date" value={form.packageStartDate} onChange={(e) => setForm((p) => ({ ...p, packageStartDate: e.target.value }))} /></label>
              </>
            ) : null}
            {mode === "monthly_subscription" ? (
              <>
                <label className="ui-field"><span className="ui-label">Aylık ücret</span><input className="ui-input" type="number" step="0.01" value={form.monthlyAmount} onChange={(e) => setForm((p) => ({ ...p, monthlyAmount: e.target.value }))} /></label>
                <label className="ui-field"><span className="ui-label">Yenileme tipi</span><input className="ui-input" value="Aylık (v1)" readOnly /></label>
                <label className="ui-field sm:col-span-2"><span className="ui-label">Başlangıç tarihi</span><input className="ui-input" type="date" value={form.monthlyStartDate} onChange={(e) => setForm((p) => ({ ...p, monthlyStartDate: e.target.value }))} /></label>
              </>
            ) : null}
            {mode === "none" ? <p className="text-sm font-bold text-gray-400 sm:col-span-2">Paket seçilmedi; bu adımda ek alan gerekmiyor.</p> : null}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="ui-field"><span className="ui-label">Toplam ücret (salt okunur)</span><input className="ui-input opacity-70" readOnly value={Number.isFinite(derivedTotalAmount) ? derivedTotalAmount.toFixed(2) : "0.00"} /></label>
            <label className="ui-field"><span className="ui-label">Ödenen tutar</span><input className="ui-input" type="number" step="0.01" value={form.paymentPaid} onChange={(e) => setForm((p) => ({ ...p, paymentPaid: e.target.value }))} /></label>
            <label className="ui-field"><span className="ui-label">Kalan (otomatik)</span><input className="ui-input opacity-70" readOnly value={paymentRemaining.toFixed(2)} /></label>
            <label className="ui-field"><span className="ui-label">Ödeme tarihi</span><input className="ui-input" type="date" value={form.paymentDate} onChange={(e) => setForm((p) => ({ ...p, paymentDate: e.target.value }))} /></label>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/25 p-4">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-[#c4b5fd]">Sporcu</h3>
              <p className="mt-2 text-sm font-bold text-white">{form.fullName || "—"}</p>
              <p className="text-xs font-bold text-gray-400">{form.email || "—"}</p>
              <p className="text-xs font-bold text-gray-500">{form.phone || "Telefon yok"}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/25 p-4">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-[#c4b5fd]">Profil</h3>
              <p className="mt-2 text-xs font-bold text-gray-300">Takım: {teamOptions.find((team) => team.id === form.teamId)?.name || "—"}</p>
              <p className="text-xs font-bold text-gray-300">Pozisyon: {form.position || "—"}</p>
              <p className="text-xs font-bold text-gray-300">Boy/Kilo: {form.height || "—"} / {form.weight || "—"}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/25 p-4">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-[#c4b5fd]">Paket</h3>
              <p className="mt-2 text-sm font-bold text-white">
                {mode === "none" ? "Paket yok" : mode === "private_lesson" ? "Özel ders paketi" : "Aylık abonelik"}
              </p>
              {mode === "private_lesson" ? (
                <p className="text-xs font-bold text-gray-400">
                  {form.totalLessons || "0"} ders · başlangıç {form.packageStartDate || "—"}
                </p>
              ) : null}
              {mode === "monthly_subscription" ? (
                <p className="text-xs font-bold text-gray-400">Başlangıç {form.monthlyStartDate || "—"}</p>
              ) : null}
            </div>
            <div className="rounded-xl border border-white/10 bg-black/25 p-4">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-[#c4b5fd]">Ödeme</h3>
              <p className="mt-2 text-sm font-bold text-white">
                ₺{Number(form.paymentPaid || "0").toFixed(2)} / ₺{Number.isFinite(derivedTotalAmount) ? derivedTotalAmount.toFixed(2) : "0.00"}
              </p>
              <p className="text-xs font-bold text-gray-400">Kalan: ₺{paymentRemaining.toFixed(2)}</p>
              <p className="text-xs font-bold text-gray-500">Tarih: {form.paymentDate || "—"}</p>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
          <button type="button" disabled={step === 0} onClick={prevStep} className="ui-btn-ghost min-h-11 px-4 disabled:opacity-50">
            <ChevronLeft size={16} aria-hidden /> Geri
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => {
                const issue = validateStep();
                if (issue) {
                  setMessage(issue);
                  return;
                }
                setMessage(null);
                nextStep();
              }}
              className="ui-btn-primary min-h-11 px-4"
            >
              İleri <ChevronRight size={16} aria-hidden />
            </button>
          ) : (
            <button type="button" disabled={saving} onClick={() => void handleSubmit()} className="ui-btn-primary min-h-11 px-5">
              {saving ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <CheckCircle2 size={16} aria-hidden />} Kaydı tamamla
            </button>
          )}
        </div>
      </section>
      ) : null}
    </div>
  );
}
