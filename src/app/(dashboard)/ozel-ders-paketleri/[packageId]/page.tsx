"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Loader2,
  ChevronLeft,
  AlertTriangle,
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  History,
  PlusCircle,
  Wallet,
  X,
} from "lucide-react";
import Notification from "@/components/Notification";
import {
  addPrivateLessonUsage,
  getPrivateLessonPackageDetail,
  listPrivateLessonFormOptions,
  updatePrivateLessonPayment,
} from "@/lib/actions/privateLessonPackageActions";
import {
  cancelPrivateLessonSession,
  completePrivateLessonSession,
  createPrivateLessonSession,
  listPrivateLessonSessionsForPackage,
} from "@/lib/actions/privateLessonSessionActions";
import type {
  PrivateLessonPackage,
  PrivateLessonPackageDetailSnapshot,
  PrivateLessonSessionListItem,
} from "@/lib/types";
import { formatLessonDateTimeTr } from "@/lib/forms/datetimeLocal";

const INPUT =
  "min-h-[3rem] w-full rounded-2xl border border-white/10 bg-[#0d0d11] px-4 py-3 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition placeholder:text-gray-600 focus:border-[#7c3aed]/60 focus:ring-2 focus:ring-[#7c3aed]/20";

function formatTry(n: number): string {
  const v = Math.round(n * 100) / 100;
  return `₺${v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function paymentLabel(status: PrivateLessonPackage["paymentStatus"]): string {
  if (status === "paid") return "Ödendi";
  if (status === "partial") return "Kısmi ödeme";
  return "Ödenmedi";
}

function paymentTone(status: PrivateLessonPackage["paymentStatus"]): string {
  if (status === "paid") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  if (status === "partial") return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  return "border-rose-500/40 bg-rose-500/10 text-rose-200";
}

function packageTypeLabel(t: string): string {
  if (t === "private") return "Özel (1:1)";
  if (t === "duet") return "Düet";
  if (t === "elite") return "Elite 1:1";
  return t;
}

type TabId = "overview" | "plan" | "usage" | "payments";

export default function PrivateLessonPackageDetailPage() {
  const params = useParams();
  const packageId = typeof params.packageId === "string" ? params.packageId : params.packageId?.[0] || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PrivateLessonPackageDetailSnapshot | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [tab, setTab] = useState<TabId>("overview");

  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [usageNote, setUsageNote] = useState("");
  const [usageSaving, setUsageSaving] = useState(false);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);

  const [sessions, setSessions] = useState<PrivateLessonSessionListItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [sessionActionId, setSessionActionId] = useState<string | null>(null);
  const [coachOptions, setCoachOptions] = useState<Array<{ id: string; full_name: string }>>([]);
  const [planForm, setPlanForm] = useState({
    lessonDate: "",
    startClock: "",
    durationMinutes: "60",
    coachId: "",
    location: "",
    note: "",
  });

  const loadDetail = useCallback(async () => {
    if (!packageId) return;
    setLoading(true);
    setError(null);
    const res = await getPrivateLessonPackageDetail(packageId);
    if ("error" in res) {
      setError(res.error);
      setSnapshot(null);
      setLoading(false);
      return;
    }
    setSnapshot(res);
    setPlanForm((p) => ({
      ...p,
      coachId: res.package.coachId || p.coachId,
    }));
    setLoading(false);
  }, [packageId]);

  useEffect(() => {
    const id = setTimeout(() => {
      void loadDetail();
    }, 0);
    return () => clearTimeout(id);
  }, [loadDetail]);

  const loadSessions = useCallback(async () => {
    if (!packageId) return;
    setSessionsLoading(true);
    const res = await listPrivateLessonSessionsForPackage(packageId);
    if ("error" in res) {
      setMessage(res.error);
      setSessions([]);
    } else {
      setSessions(res.sessions);
    }
    setSessionsLoading(false);
  }, [packageId]);

  useEffect(() => {
    if (tab !== "plan" || !packageId) return;
    const id = setTimeout(() => {
      void loadSessions();
    }, 0);
    return () => clearTimeout(id);
  }, [tab, packageId, loadSessions]);

  useEffect(() => {
    if (tab !== "plan" || !snapshot || snapshot.viewerRole !== "admin") return;
    void (async () => {
      const res = await listPrivateLessonFormOptions();
      if ("error" in res) return;
      setCoachOptions(res.coaches);
    })();
  }, [tab, snapshot]);

  useEffect(() => {
    if (!usageModalOpen && !paymentModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setUsageModalOpen(false);
        setPaymentModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [usageModalOpen, paymentModalOpen]);

  const pkg = snapshot?.package;
  const remainingBalance = useMemo(
    () => (pkg ? Math.max(pkg.totalPrice - pkg.amountPaid, 0) : 0),
    [pkg]
  );

  const lastUsage = snapshot?.usageRows[0];
  const lastPayment = snapshot?.paymentRows[0];

  const usageBlocked = pkg ? !pkg.isActive || pkg.remainingLessons <= 0 : true;
  const plannedPrivateSessionCount = snapshot?.plannedPrivateSessionCount ?? 0;
  const manualBlockedByOpenPlan = plannedPrivateSessionCount > 0;
  const manualUnplannedUsageBlocked = usageBlocked || manualBlockedByOpenPlan;
  const manualUsageDisabledTitle = manualBlockedByOpenPlan
    ? "Açık özel ders planı varken plansız/geçmiş kayıt eklenemez; önce “Ders yapıldı” veya iptal kullanın."
    : usageBlocked
      ? "Pasif paket veya kalan ders hakkı yok."
      : undefined;

  const parsedPaymentAdd = Number(String(paymentAmount).replace(",", "."));
  const paymentPreviewNewPaid = pkg && Number.isFinite(parsedPaymentAdd) ? pkg.amountPaid + Math.max(parsedPaymentAdd, 0) : null;
  const paymentPreviewRemaining =
    pkg && paymentPreviewNewPaid != null ? Math.max(pkg.totalPrice - paymentPreviewNewPaid, 0) : null;
  const paymentOverTotal =
    pkg && paymentPreviewNewPaid != null ? paymentPreviewNewPaid > pkg.totalPrice + 0.0001 : false;
  const paymentAmountValid = Number.isFinite(parsedPaymentAdd) && parsedPaymentAdd > 0 && !paymentOverTotal;

  const nextActionText = useMemo(() => {
    if (!pkg) return "";
    if (plannedPrivateSessionCount > 0 && pkg.isActive && pkg.remainingLessons > 0) {
      if (remainingBalance > 0) {
        return "Açık özel ders planı var: “Ders yapıldı” ile kullanım otomatik düşer; tahsilatı ödeme kaydıyla güncel tutun. Plansız ders yalnızca açık plan kalmayınca manuel kayıtla eklenir.";
      }
      return "Açık özel ders planı var: tamamlandığında kullanım otomatik düşer. Plansız veya önceden yapılmış dersler için manuel kayıt, açık plan kalmayınca kullanılır.";
    }
    if (usageBlocked && remainingBalance > 0) return "Paket dersleri tamamlanmış veya pasif; kalan bakiye için ödeme kaydı ekleyebilirsiniz.";
    if (usageBlocked && remainingBalance <= 0) return "Paket tamamlanmış görünüyor. Gerekirse yeni paket oluşturun.";
    if (remainingBalance > 0 && pkg.remainingLessons > 0) return "Ders kullanımını işleyin ve tahsilatı güncel tutun.";
    if (remainingBalance > 0) return "Ödeme bakiyesini kapatmak için ödeme kaydı ekleyin.";
    if (pkg.remainingLessons > 0)
      return "Kalan plansız dersler için “Plansız / geçmiş ders kaydı” ekleyin veya önce özel ders planı oluşturun.";
    return "Paket dengede. Gerekirse geçmişi sekmelerden kontrol edin.";
  }, [pkg, usageBlocked, remainingBalance, plannedPrivateSessionCount]);

  async function submitUsage() {
    if (!packageId || manualUnplannedUsageBlocked) return;
    setUsageSaving(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("packageId", packageId);
    fd.append("usedAt", new Date().toISOString());
    const n = usageNote.trim();
    if (n) fd.append("note", n);
    const res = await addPrivateLessonUsage(fd);
    if ("success" in res && res.success) {
      setMessage("Plansız / geçmiş ders kaydı eklendi.");
      setUsageModalOpen(false);
      setUsageNote("");
      await loadDetail();
    } else {
      setMessage(("error" in res && res.error) || "Plansız / geçmiş ders kaydı eklenemedi.");
    }
    setUsageSaving(false);
  }

  async function submitPayment() {
    if (!packageId || !paymentAmountValid) return;
    setPaymentSaving(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("packageId", packageId);
    fd.append("paymentAmount", String(parsedPaymentAdd));
    const n = paymentNote.trim();
    if (n) fd.append("note", n);
    const res = await updatePrivateLessonPayment(fd);
    if ("success" in res && res.success) {
      setMessage("Ödeme kaydı eklendi.");
      setPaymentModalOpen(false);
      setPaymentAmount("");
      setPaymentNote("");
      await loadDetail();
    } else {
      setMessage(("error" in res && res.error) || "Ödeme kaydı eklenemedi.");
    }
    setPaymentSaving(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[50dvh] min-w-0 flex-col items-center justify-center gap-4 overflow-x-hidden px-4 pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] text-center">
        <Loader2 className="animate-spin text-[#7c3aed]" size={44} aria-hidden />
        <p className="max-w-md break-words text-[10px] font-black uppercase italic tracking-wide text-gray-500 sm:tracking-widest">
          Paket yükleniyor…
        </p>
      </div>
    );
  }

  if (error || !snapshot || !pkg) {
    return (
      <div className="min-w-0 space-y-4">
        <Link
          href="/ozel-ders-paketleri"
          className="inline-flex min-h-11 items-center gap-2 text-[10px] font-black uppercase tracking-wide text-[#c4b5fd] touch-manipulation sm:hover:text-[#e9d5ff]"
        >
          <ChevronLeft size={16} aria-hidden />
          Özel ders paketleri
        </Link>
        <Notification message={error || "Paket bulunamadı."} variant="error" />
      </div>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Genel durum" },
    { id: "plan", label: "Özel ders planı" },
    { id: "usage", label: "Kullanım geçmişi" },
    { id: "payments", label: "Ödeme geçmişi" },
  ];

  const planBlocked =
    !pkg ||
    !pkg.isActive ||
    pkg.remainingLessons <= 0 ||
    snapshot?.viewerRole === "sporcu";

  function sessionStatusLabel(s: PrivateLessonSessionListItem): string {
    if (s.status === "completed") return "Tamamlandı";
    if (s.status === "cancelled") return "İptal edildi";
    return "Planlandı";
  }

  async function submitPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!packageId || planBlocked) return;
    setPlanSaving(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("packageId", packageId);
    fd.append("lessonDate", planForm.lessonDate);
    fd.append("startClock", planForm.startClock);
    fd.append("durationMinutes", planForm.durationMinutes);
    if (snapshot?.viewerRole === "admin" && planForm.coachId) fd.append("coachId", planForm.coachId);
    const loc = planForm.location.trim();
    if (loc) fd.append("location", loc);
    const n = planForm.note.trim();
    if (n) fd.append("note", n);
    const res = await createPrivateLessonSession(fd);
    if ("success" in res && res.success) {
      setMessage("Özel ders planı oluşturuldu.");
      setPlanForm((p) => ({ ...p, note: "", location: "" }));
      await loadSessions();
      await loadDetail();
    } else {
      setMessage(("error" in res && res.error) || "Plan oluşturulamadı.");
    }
    setPlanSaving(false);
  }

  async function onCompleteSession(id: string) {
    setSessionActionId(id);
    setMessage(null);
    const res = await completePrivateLessonSession(id);
    if ("success" in res && res.success) {
      setMessage("Ders tamamlandı; paketten 1 ders düşüldü.");
      await loadSessions();
      await loadDetail();
    } else {
      setMessage(("error" in res && res.error) || "Tamamlanamadı.");
    }
    setSessionActionId(null);
  }

  async function onCancelSession(id: string) {
    setSessionActionId(id);
    setMessage(null);
    const res = await cancelPrivateLessonSession(id);
    if ("success" in res && res.success) {
      setMessage("Plan iptal edildi.");
      await loadSessions();
    } else {
      setMessage(("error" in res && res.error) || "İptal edilemedi.");
    }
    setSessionActionId(null);
  }

  return (
    <div className="ui-page min-w-0 space-y-6 overflow-x-hidden pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/ozel-ders-paketleri"
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-gray-300 touch-manipulation sm:hover:border-[#7c3aed]/30 sm:hover:text-white"
        >
          <ChevronLeft size={16} aria-hidden />
          Listeye dön
        </Link>
      </div>

      {message ? (
        <Notification
          message={message}
          variant={
            message.toLowerCase().includes("eklendi") ||
            message.toLowerCase().includes("güncellendi") ||
            message.toLowerCase().includes("oluşturuldu") ||
            message.toLowerCase().includes("tamamlandı") ||
            message.toLowerCase().includes("iptal edildi")
              ? "success"
              : "info"
          }
        />
      ) : null}

      <header className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-[#18181f] via-[#131318] to-[#101014] p-6 shadow-xl sm:rounded-[2rem] sm:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7c3aed]/40 to-transparent" aria-hidden />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#c4b5fd]">Paket özeti</p>
            <h1 className="break-words text-2xl font-black italic uppercase tracking-tight text-white sm:text-3xl lg:text-4xl">
              {pkg.packageName}
            </h1>
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
              {pkg.athleteName}
              <span className="mx-2 text-white/20">·</span>
              {packageTypeLabel(pkg.packageType)}
              <span className="mx-2 text-white/20">·</span>
              Koç: {pkg.coachName || "—"}
            </p>
            <p className="max-w-2xl text-sm font-bold leading-relaxed text-gray-400">{nextActionText}</p>
          </div>
          <div
            className={`shrink-0 rounded-2xl border px-4 py-3 text-center text-[10px] font-black uppercase tracking-wider ${paymentTone(pkg.paymentStatus)}`}
          >
            Ödeme durumu
            <span className="mt-1 block text-sm tracking-normal text-white">{paymentLabel(pkg.paymentStatus)}</span>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[#7c3aed]/25 bg-[#7c3aed]/10 px-4 py-4">
            <p className="text-[9px] font-black uppercase tracking-wider text-[#c4b5fd]">Kalan ders</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-white">{pkg.remainingLessons}</p>
            <p className="mt-1 text-[10px] font-bold text-gray-500">
              Toplam {pkg.totalLessons} · Yapılan {pkg.usedLessons}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
            <p className="text-[9px] font-black uppercase tracking-wider text-gray-500">Toplam ücret</p>
            <p className="mt-1 text-xl font-black tabular-nums text-white">{formatTry(pkg.totalPrice)}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4">
            <p className="text-[9px] font-black uppercase tracking-wider text-emerald-200/80">Ödenen</p>
            <p className="mt-1 text-xl font-black tabular-nums text-emerald-100">{formatTry(pkg.amountPaid)}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 px-4 py-4">
            <p className="text-[9px] font-black uppercase tracking-wider text-rose-200/80">Kalan ödeme</p>
            <p className="mt-1 text-xl font-black tabular-nums text-rose-100">{formatTry(remainingBalance)}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 border-t border-white/5 pt-6 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-black/20 px-4 py-3">
            <CalendarClock className="mt-0.5 shrink-0 text-gray-500" size={18} aria-hidden />
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-gray-500">Son kullanım</p>
              <p className="mt-1 text-xs font-bold text-white">
                {lastUsage ? new Date(lastUsage.usedAt).toLocaleString("tr-TR") : "—"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-black/20 px-4 py-3">
            <Wallet className="mt-0.5 shrink-0 text-gray-500" size={18} aria-hidden />
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-gray-500">Son ödeme</p>
              <p className="mt-1 text-xs font-bold text-white">
                {lastPayment
                  ? `${new Date(lastPayment.paidAt).toLocaleString("tr-TR")} · ${formatTry(lastPayment.amount)}`
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        {snapshot.viewerRole !== "sporcu" ? (
          <div className="mt-6 flex flex-col gap-3">
            {manualBlockedByOpenPlan ? (
              <div
                className="flex gap-3 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-[11px] font-bold leading-relaxed text-amber-100"
                role="status"
              >
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-300" aria-hidden />
                <p>
                  <span className="font-black uppercase tracking-wide text-amber-200/95">Plansız / geçmiş kayıt şu an kapalı.</span>{" "}
                  Bu pakette açık özel ders planı var; ders yapıldığında kullanım otomatik düşer. Plansız veya geçmişte
                  kalan dersleri kaydetmek için önce bu planı “Ders yapıldı” ile kapatın veya iptal edin.
                </p>
              </div>
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                title={manualUsageDisabledTitle}
                disabled={manualUnplannedUsageBlocked}
                onClick={() => {
                  setUsageNote("");
                  setUsageModalOpen(true);
                }}
                className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border px-4 text-[11px] font-black uppercase tracking-wide transition disabled:cursor-not-allowed ${
                  manualUnplannedUsageBlocked
                    ? manualBlockedByOpenPlan && !usageBlocked
                      ? "border-amber-500/30 bg-amber-500/5 text-amber-200/75 opacity-80"
                      : "border-emerald-500/35 bg-emerald-500/10 text-emerald-200 opacity-40"
                    : "border-emerald-500/35 bg-emerald-500/10 text-emerald-200 enabled:sm:hover:bg-emerald-500/20"
                }`}
              >
                <PlusCircle size={18} aria-hidden />
                Plansız / geçmiş ders kaydı ekle
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentAmount("");
                  setPaymentNote("");
                  setPaymentModalOpen(true);
                }}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-[#7c3aed]/35 bg-[#7c3aed]/15 px-4 text-[11px] font-black uppercase tracking-wide text-[#c4b5fd] transition sm:hover:bg-[#7c3aed]/25"
              >
                <CircleDollarSign size={18} aria-hidden />
                Ödeme kaydı ekle
              </button>
            </div>
          </div>
        ) : null}
        {snapshot.viewerRole !== "sporcu" ? (
          <p className="mt-3 text-[11px] font-bold leading-relaxed text-gray-500">
            Planlı özel derslerde <span className="text-gray-300">“Ders yapıldı”</span> dediğinizde paketten kullanım{" "}
            <span className="text-gray-300">otomatik düşer</span>. Takvime bağlı olmayan veya geçmişte yapılmış dersler
            için yalnızca <span className="text-emerald-200/90">plansız / geçmiş ders kaydı</span> kullanın; açık plan
            varken bu kayıt kapalıdır.
          </p>
        ) : null}
      </header>

      <div className="flex flex-wrap gap-2 border-b border-white/5 pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`min-h-11 touch-manipulation rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-wider transition ${
              tab === t.id
                ? "bg-[#7c3aed] text-white shadow-lg shadow-[#7c3aed]/20"
                : "text-gray-500 sm:hover:bg-white/5 sm:hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <section className="rounded-2xl border border-white/5 bg-[#121215] p-5 sm:p-7">
          <h2 className="text-sm font-black italic uppercase text-white">Hızlı bilgi</h2>
          <ul className="mt-4 space-y-3 text-sm font-bold text-gray-400">
            <li className="flex flex-wrap gap-2">
              <span className="text-gray-600">Durum:</span>
              <span className="text-white">{pkg.isActive ? "Aktif" : "Pasif"}</span>
            </li>
            <li className="flex flex-wrap gap-2">
              <span className="text-gray-600">Ödeme:</span>
              <span className="text-white">{paymentLabel(pkg.paymentStatus)}</span>
            </li>
            <li className="flex flex-wrap gap-2">
              <span className="text-gray-600">Ders hakkı:</span>
              <span className="text-white">
                {pkg.remainingLessons} kalan · {pkg.usedLessons} kullanıldı · {pkg.totalLessons} toplam
              </span>
            </li>
          </ul>
          <p className="mt-6 text-[11px] font-bold text-gray-600">
            Ayrıntılı listeler için <span className="text-[#c4b5fd]">Kullanım geçmişi</span> ve{" "}
            <span className="text-[#c4b5fd]">Ödeme geçmişi</span> sekmelerini kullanın. Planlı derslerde düşüm “Özel ders
            planı” sekmesinden tamamlanır.
          </p>
        </section>
      )}

      {tab === "plan" && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-white/5 bg-[#121215] p-5 sm:p-7">
            <h2 className="text-sm font-black italic uppercase text-white">Özel ders planlama</h2>
            <p className="mt-2 text-[11px] font-bold text-gray-500">
              Grup derslerinden bağımsızdır. Tamamlanan plan paketten 1 ders düşürür; iptal düşürmez. Bu sekmede “Ders
              yapıldı” dediğinizde kullanım otomatik düşer — aynı dersi tekrar{" "}
              <span className="text-gray-400">plansız / geçmiş ders kaydı</span> ile düşürmeyin.
            </p>
            {planBlocked && snapshot.viewerRole === "sporcu" ? (
              <p className="mt-4 text-xs font-bold text-gray-400">
                Planları görüntüleyebilirsiniz; oluşturma ve güncelleme yalnızca yönetici veya koç içindir.
              </p>
            ) : null}
            {planBlocked && snapshot.viewerRole !== "sporcu" ? (
              <p className="mt-4 text-xs font-bold text-amber-200/90">
                Aktif paket ve kalan ders hakkı olmadan yeni plan eklenemez.
              </p>
            ) : null}

            {!planBlocked ? (
              <form onSubmit={(e) => void submitPlan(e)} className="mt-6 grid gap-4 border-t border-white/5 pt-6 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#c4b5fd]">Bir sonraki dersi planla</p>
                </div>
                <label className="block space-y-1">
                  <span className="text-[9px] font-black uppercase text-gray-500">Tarih</span>
                  <input
                    type="date"
                    required
                    value={planForm.lessonDate}
                    onChange={(e) => setPlanForm((p) => ({ ...p, lessonDate: e.target.value }))}
                    className={INPUT}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[9px] font-black uppercase text-gray-500">Başlangıç saati</span>
                  <input
                    type="time"
                    required
                    value={planForm.startClock}
                    onChange={(e) => setPlanForm((p) => ({ ...p, startClock: e.target.value }))}
                    className={INPUT}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[9px] font-black uppercase text-gray-500">Süre (dk)</span>
                  <input
                    type="number"
                    min={15}
                    max={480}
                    step={5}
                    required
                    value={planForm.durationMinutes}
                    onChange={(e) => setPlanForm((p) => ({ ...p, durationMinutes: e.target.value }))}
                    className={INPUT}
                  />
                </label>
                {snapshot.viewerRole === "admin" ? (
                  <label className="block space-y-1 sm:col-span-2">
                    <span className="text-[9px] font-black uppercase text-gray-500">Koç</span>
                    <select
                      required
                      value={planForm.coachId}
                      onChange={(e) => setPlanForm((p) => ({ ...p, coachId: e.target.value }))}
                      className={INPUT}
                    >
                      <option value="">Seçin</option>
                      {coachOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="text-[11px] font-bold text-gray-400 sm:col-span-2">
                    Koç: siz (oturum açan koç)
                  </p>
                )}
                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-[9px] font-black uppercase text-gray-500">Lokasyon (isteğe bağlı)</span>
                  <input
                    value={planForm.location}
                    onChange={(e) => setPlanForm((p) => ({ ...p, location: e.target.value }))}
                    placeholder="Salon / saha"
                    className={INPUT}
                  />
                </label>
                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-[9px] font-black uppercase text-gray-500">Not (isteğe bağlı)</span>
                  <input
                    value={planForm.note}
                    onChange={(e) => setPlanForm((p) => ({ ...p, note: e.target.value }))}
                    placeholder="Örn. odak: şut"
                    className={INPUT}
                  />
                </label>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={planSaving}
                    className="min-h-12 w-full rounded-2xl bg-[#7c3aed] px-4 text-[11px] font-black uppercase text-white shadow-lg disabled:opacity-50 sm:w-auto sm:min-w-[12rem] touch-manipulation sm:hover:bg-[#6d28d9]"
                  >
                    {planSaving ? "Kaydediliyor…" : "Dersi planla"}
                  </button>
                </div>
              </form>
            ) : null}
          </section>

          <section className="rounded-2xl border border-white/5 bg-[#121215] p-5 sm:p-7">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-xs font-black uppercase tracking-wide text-white">Planlı oturumlar</h3>
              {sessionsLoading ? <Loader2 className="size-5 animate-spin text-[#7c3aed]" aria-hidden /> : null}
            </div>
            {sessions.filter((s) => s.status === "planned").length === 0 ? (
              <p className="text-[11px] font-bold text-gray-500">Açık plan yok.</p>
            ) : (
              <ul className="space-y-3">
                {sessions
                  .filter((s) => s.status === "planned")
                  .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
                  .map((s) => {
                    const canRow =
                      snapshot.viewerRole === "admin" ||
                      (snapshot.viewerRole === "coach" && s.coachId === snapshot.viewerId);
                    return (
                      <li
                        key={s.id}
                        className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-[11px] font-bold text-gray-300"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase text-amber-200">
                            {sessionStatusLabel(s)}
                          </span>
                          <span className="text-white">{formatLessonDateTimeTr(s.startsAt)}</span>
                          <span className="text-gray-500">→ {formatLessonDateTimeTr(s.endsAt)}</span>
                        </div>
                        <p className="mt-1 text-[10px] text-gray-500">
                          Koç: {s.coachName || "—"}
                          {s.location ? ` · ${s.location}` : ""}
                        </p>
                        {s.note ? <p className="mt-1 text-[10px] text-gray-600">{s.note}</p> : null}
                        {canRow ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={sessionActionId === s.id}
                              onClick={() => void onCompleteSession(s.id)}
                              className="min-h-10 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-3 text-[10px] font-black uppercase text-emerald-200 touch-manipulation disabled:opacity-50 sm:hover:bg-emerald-500/25"
                            >
                              {sessionActionId === s.id ? "…" : "Ders yapıldı"}
                            </button>
                            <button
                              type="button"
                              disabled={sessionActionId === s.id}
                              onClick={() => void onCancelSession(s.id)}
                              className="min-h-10 rounded-xl border border-white/15 bg-white/5 px-3 text-[10px] font-black uppercase text-gray-300 touch-manipulation disabled:opacity-50 sm:hover:border-red-500/30 sm:hover:text-red-300"
                            >
                              İptal et
                            </button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-white/5 bg-[#121215] p-5 sm:p-7">
            <h3 className="mb-4 text-xs font-black uppercase tracking-wide text-white">Geçmiş planlar</h3>
            {sessions.filter((s) => s.status !== "planned").length === 0 ? (
              <p className="text-[11px] font-bold text-gray-500">Tamamlanan veya iptal edilen plan yok.</p>
            ) : (
              <ul className="space-y-2">
                {sessions
                  .filter((s) => s.status !== "planned")
                  .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
                  .map((s) => (
                    <li
                      key={s.id}
                      className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-[11px] text-gray-400"
                    >
                      <span
                        className={
                          s.status === "completed"
                            ? "text-emerald-300"
                            : s.status === "cancelled"
                              ? "text-gray-500"
                              : ""
                        }
                      >
                        {sessionStatusLabel(s)}
                      </span>
                      <span className="mx-2 text-gray-600">·</span>
                      <span className="text-gray-200">{formatLessonDateTimeTr(s.startsAt)}</span>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {tab === "usage" && (
        <section className="rounded-2xl border border-white/5 bg-[#121215] p-5 sm:p-7">
          <div className="mb-4 flex items-center gap-2">
            <History className="text-[#7c3aed]" size={20} aria-hidden />
            <h2 className="text-sm font-black italic uppercase text-white">Kullanım geçmişi</h2>
          </div>
          {snapshot.usageRows.length === 0 ? (
            <p className="text-[11px] font-bold text-gray-500">Henüz plansız veya geçmiş ders kaydı yok.</p>
          ) : (
            <ul className="space-y-2">
              {snapshot.usageRows.map((row) => (
                <li
                  key={row.id}
                  className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-[11px] font-bold text-gray-300"
                >
                  <span className="text-white">{new Date(row.usedAt).toLocaleString("tr-TR")}</span>
                  {row.note ? <span className="mt-1 block text-gray-500">{row.note}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "payments" && (
        <section className="rounded-2xl border border-white/5 bg-[#121215] p-5 sm:p-7">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList className="text-[#7c3aed]" size={20} aria-hidden />
            <h2 className="text-sm font-black italic uppercase text-white">Ödeme geçmişi</h2>
          </div>
          {snapshot.paymentRows.length === 0 ? (
            <p className="text-[11px] font-bold text-gray-500">Henüz ödeme kaydı yok.</p>
          ) : (
            <ul className="space-y-2">
              {snapshot.paymentRows.map((row) => (
                <li
                  key={row.id}
                  className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-[11px] font-bold text-gray-300"
                >
                  <span className="text-emerald-200">{formatTry(row.amount)}</span>
                  <span className="mx-2 text-gray-600">·</span>
                  <span className="text-white">{new Date(row.paidAt).toLocaleString("tr-TR")}</span>
                  {row.note ? <span className="mt-1 block text-gray-500">{row.note}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {usageModalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center"
          role="presentation"
          onClick={() => !usageSaving && setUsageModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="usage-dialog-title"
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#16161c] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id="usage-dialog-title" className="text-lg font-black italic uppercase text-white">
                Plansız / geçmiş ders kaydı
              </h3>
              <button
                type="button"
                disabled={usageSaving}
                onClick={() => setUsageModalOpen(false)}
                className="rounded-lg border border-white/10 p-2 text-gray-400 touch-manipulation sm:hover:bg-white/5"
                aria-label="Kapat"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            <p className="mt-3 text-sm font-bold leading-relaxed text-gray-400">
              Takvime bağlı olmayan veya geçmişte yapılmış bir dersi işaretlemek içindir; paketten{" "}
              <span className="text-white">1 ders düşer</span>. Planlı özel derslerde önce{" "}
              <span className="text-white">Özel ders planı</span> sekmesinden “Ders yapıldı” kullanın — kullanım orada
              otomatik düşer; aynı dersi buradan tekrar düşürmeyin.
            </p>
            <p className="mt-3 text-sm font-bold leading-relaxed text-gray-400">
              Önizleme: kullanılan{" "}
              <span className="tabular-nums text-white">{pkg.usedLessons}</span> →{" "}
              <span className="tabular-nums text-white">{pkg.usedLessons + 1}</span>, kalan{" "}
              <span className="tabular-nums text-white">{pkg.remainingLessons}</span> →{" "}
              <span className="tabular-nums text-white">{Math.max(pkg.remainingLessons - 1, 0)}</span>.
            </p>
            <label className="mt-5 block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-500">
                Not (isteğe bağlı)
              </span>
              <textarea
                value={usageNote}
                onChange={(e) => setUsageNote(e.target.value)}
                rows={3}
                placeholder="Örn. plansız seans, takvim dışı ders"
                className={`${INPUT} min-h-[5.5rem] resize-y`}
              />
            </label>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={usageSaving}
                onClick={() => setUsageModalOpen(false)}
                className="min-h-12 rounded-2xl border border-white/15 px-5 text-[11px] font-black uppercase text-gray-300 touch-manipulation sm:hover:bg-white/5"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={usageSaving || manualUnplannedUsageBlocked}
                onClick={() => void submitUsage()}
                className="min-h-12 rounded-2xl bg-emerald-600 px-5 text-[11px] font-black uppercase text-white shadow-lg disabled:opacity-50 sm:hover:bg-emerald-500"
              >
                {usageSaving ? "Kaydediliyor…" : "Kaydı ekle"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {paymentModalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center"
          role="presentation"
          onClick={() => !paymentSaving && setPaymentModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-dialog-title"
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#16161c] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id="payment-dialog-title" className="text-lg font-black italic uppercase text-white">
                Ödeme kaydı
              </h3>
              <button
                type="button"
                disabled={paymentSaving}
                onClick={() => setPaymentModalOpen(false)}
                className="rounded-lg border border-white/10 p-2 text-gray-400 touch-manipulation sm:hover:bg-white/5"
                aria-label="Kapat"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <div className="mt-4 grid gap-2 rounded-xl border border-white/10 bg-black/30 p-4 text-[11px] font-bold">
              <div className="flex justify-between gap-4 text-gray-500">
                <span>Toplam ücret</span>
                <span className="tabular-nums text-white">{formatTry(pkg.totalPrice)}</span>
              </div>
              <div className="flex justify-between gap-4 text-gray-500">
                <span>Şu ana kadar ödenen</span>
                <span className="tabular-nums text-white">{formatTry(pkg.amountPaid)}</span>
              </div>
              <div className="flex justify-between gap-4 border-t border-white/5 pt-2 text-gray-500">
                <span>Bu ödeme sonrası ödenen</span>
                <span className={`tabular-nums ${paymentPreviewNewPaid != null ? "text-white" : "text-gray-600"}`}>
                  {paymentPreviewNewPaid != null ? formatTry(paymentPreviewNewPaid) : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-4 text-gray-500">
                <span>Kalan bakiye</span>
                <span className={`tabular-nums ${paymentPreviewRemaining != null ? "text-rose-100" : "text-gray-600"}`}>
                  {paymentPreviewRemaining != null ? formatTry(paymentPreviewRemaining) : "—"}
                </span>
              </div>
            </div>

            {paymentOverTotal ? (
              <p className="mt-3 text-[11px] font-bold text-rose-300">Tutar, toplam ücreti aşamaz.</p>
            ) : null}

            <label className="mt-5 block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-500">
                Ödeme tutarı (₺) <span className="text-rose-400">*</span>
              </span>
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0,00"
                className={`${INPUT} pl-4`}
              />
            </label>
            <label className="mt-4 block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-500">
                Açıklama (isteğe bağlı)
              </span>
              <input
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="Örn. havale — referans no"
                className={INPUT}
              />
            </label>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={paymentSaving}
                onClick={() => setPaymentModalOpen(false)}
                className="min-h-12 rounded-2xl border border-white/15 px-5 text-[11px] font-black uppercase text-gray-300 touch-manipulation sm:hover:bg-white/5"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={paymentSaving || !paymentAmountValid}
                onClick={() => void submitPayment()}
                className="min-h-12 rounded-2xl bg-[#7c3aed] px-5 text-[11px] font-black uppercase text-white shadow-lg disabled:opacity-45 sm:hover:bg-[#6d28d9]"
              >
                {paymentSaving ? "Kaydediliyor…" : "Ödeme ekle"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
