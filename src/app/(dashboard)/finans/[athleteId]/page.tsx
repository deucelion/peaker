"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import Notification from "@/components/Notification";
import {
  createOrgPayment,
  getAthleteFinanceDetailForManagement,
  markPlannedAidatAsPaidForManagement,
  updateAthleteNextAidatPlanForManagement,
  updateOrgPaymentStatus,
} from "@/lib/actions/financeActions";
import type { AthleteFinanceDetail } from "@/lib/types";

type FinanceTab = "aidat" | "ozelDers" | "plan";

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatCurrency(value: number | null | undefined) {
  return currencyFormatter.format(Number(value) || 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const dt = new Date(`${value}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return "-";
  return dateFormatter.format(dt);
}

function summaryToneClasses(tone: AthleteFinanceDetail["summary"]["tone"]) {
  if (tone === "overdue") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (tone === "approaching") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

function summaryActionMessage(summary: AthleteFinanceDetail["summary"]) {
  const dateLabel = formatDate(summary.nextDueDate);
  if (summary.tone === "overdue") {
    return "Bu ay ödeme yapılmamış görünüyor. Ödeme işlemini tamamlayın.";
  }
  if (summary.tone === "approaching") {
    return `Ödeme tarihi yaklaşıyor. Son ödeme: ${dateLabel}`;
  }
  return `Bu ay ödeme tamamlandı. Sonraki ödeme: ${dateLabel}`;
}

export default function FinanceAthleteDetailPage() {
  const params = useParams();
  const athleteId = typeof params.athleteId === "string" ? params.athleteId : params.athleteId?.[0] || "";

  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<AthleteFinanceDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [planSaving, setPlanSaving] = useState(false);
  const [markingPlannedPaid, setMarkingPlannedPaid] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({ dueDate: "", amount: "" });
  const [paymentForm, setPaymentForm] = useState({ amount: "", dueDate: "", description: "" });
  const [activeTab, setActiveTab] = useState<FinanceTab>("aidat");

  const load = useCallback(async () => {
    if (!athleteId) return;
    setLoading(true);
    const res = await getAthleteFinanceDetailForManagement(athleteId);
    if ("error" in res) {
      setMessage(res.error);
      setSnapshot(null);
      setLoading(false);
      return;
    }
    setSnapshot(res);
    setPlanForm({
      dueDate: res.nextAidatPlan.dueDate || "",
      amount: res.nextAidatPlan.amount != null ? String(res.nextAidatPlan.amount) : "",
    });
    setLoading(false);
  }, [athleteId]);

  useEffect(() => {
    const id = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(id);
  }, [load]);

  const combinedPrivatePaid = useMemo(
    () => (snapshot?.privateLessonPayments || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [snapshot]
  );

  async function handlePlanSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!snapshot) return;
    setPlanSaving(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("athlete_id", snapshot.athlete.id);
    fd.append("next_due_date", planForm.dueDate);
    fd.append("next_amount", planForm.amount);
    const res = await updateAthleteNextAidatPlanForManagement(fd);
    if ("error" in res) {
      setMessage(res.error || "Aidat plani guncellenemedi.");
    } else {
      setMessage("Sonraki aidat plani guncellendi.");
      await load();
    }
    setPlanSaving(false);
  }

  async function handleCreateAidat(e: React.FormEvent) {
    e.preventDefault();
    if (!snapshot) return;
    setPaymentSaving(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("profile_id", snapshot.athlete.id);
    fd.append("payment_type", "aylik");
    fd.append("amount", paymentForm.amount);
    fd.append("due_date", paymentForm.dueDate);
    fd.append("desc", paymentForm.description);
    const res = await createOrgPayment(fd);
    if ("error" in res) {
      setMessage(res.error || "Aidat kaydi olusturulamadi.");
    } else {
      setMessage("Aidat kaydi olusturuldu.");
      setPaymentForm({ amount: "", dueDate: "", description: "" });
      await load();
    }
    setPaymentSaving(false);
  }

  async function handleMarkPlannedPaid() {
    if (!snapshot) return;
    setMarkingPlannedPaid(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("athlete_id", snapshot.athlete.id);
    const res = await markPlannedAidatAsPaidForManagement(fd);
    if ("error" in res) {
      setMessage(res.error || "Planlanan aidat odendiye alinamadi.");
    } else {
      setMessage("Planlanan aidat odendi olarak isaretlendi.");
      await load();
    }
    setMarkingPlannedPaid(false);
  }

  async function handleStatusUpdate(paymentId: string, status: "odendi" | "bekliyor") {
    setStatusSavingId(paymentId);
    setMessage(null);
    const res = await updateOrgPaymentStatus(paymentId, status);
    if ("error" in res) setMessage(res.error || "Odeme durumu guncellenemedi.");
    else {
      setMessage("Odeme durumu guncellendi.");
      await load();
    }
    setStatusSavingId(null);
  }

  if (loading) {
    return (
      <div className="flex min-h-[45dvh] items-center justify-center text-white">
        <Loader2 className="size-10 animate-spin text-green-500" aria-hidden />
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="space-y-4">
        <Link href="/finans" className="text-[10px] font-black uppercase text-green-400">← Aidat Takibi</Link>
        <Notification message={message || "Finans detayi alinamadi."} variant="error" />
      </div>
    );
  }

  const dueDateLabel = formatDate(snapshot.summary.nextDueDate);
  const dueAmountLabel = formatCurrency(snapshot.summary.nextAmount);
  const aidatHistoryCount = snapshot.aidatPayments.length;
  const ozelDersPaymentCount = snapshot.privateLessonPayments.length;
  const showPrimaryAction = snapshot.summary.tone !== "paid";
  const primaryActionLabel = snapshot.summary.tone === "overdue" ? "Ödemeyi Tamamla" : "Erken Ödeme Yap";

  return (
    <div className="space-y-6 pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/finans" className="text-[10px] font-black uppercase text-green-400">← Aidat Takibi</Link>
        <h1 className="text-2xl font-black uppercase italic text-white">
          {snapshot.athlete.fullName} · Finans Detayı
        </h1>
      </div>

      {message ? (
        <Notification
          message={message}
          variant={message.toLowerCase().includes("guncellendi") || message.toLowerCase().includes("olusturuldu") ? "success" : "error"}
        />
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        <div className={`rounded-2xl border p-5 md:col-span-2 ${summaryToneClasses(snapshot.summary.tone)}`}>
          <p className="text-[9px] font-black uppercase tracking-widest">Aidat Durumu</p>
          <p className="mt-2 text-lg font-black uppercase italic">{snapshot.summary.label}</p>
          <p className="mt-2 text-[11px] font-semibold text-white/90">
            {snapshot.summary.tone === "overdue"
              ? "Bu ayın ödemesi henüz tamamlanmadı."
              : snapshot.summary.tone === "approaching"
                ? "Son ödeme tarihi yaklaşıyor."
                : "Bu ayın ödemesi tamamlandı."}
          </p>
          <div className="mt-3 grid gap-2 rounded-xl border border-white/20 bg-black/20 px-3 py-3 text-[11px] font-semibold leading-relaxed text-white/90 sm:grid-cols-2">
            <p>Sonraki ödeme tarihi: <span className="font-black">{dueDateLabel}</span></p>
            <p>Sonraki ödeme tutarı: <span className="font-black">{dueAmountLabel}</span></p>
          </div>
          <div className="mt-3 rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-[11px] font-semibold leading-relaxed text-white/90">
            {summaryActionMessage(snapshot.summary)}
          </div>
          {showPrimaryAction ? (
            <button
              type="button"
              disabled={markingPlannedPaid}
              onClick={() => void handleMarkPlannedPaid()}
              className="mt-4 min-h-11 w-full rounded-xl bg-white px-4 text-[11px] font-black uppercase tracking-wide text-black transition-opacity disabled:opacity-60 md:w-auto md:min-w-[220px]"
            >
              {markingPlannedPaid ? "İşleniyor..." : primaryActionLabel}
            </button>
          ) : null}
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#121215] p-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Özet</p>
          <p className="mt-2 text-lg font-black text-emerald-400">{formatCurrency(snapshot.totals.aidatPaidTotal)}</p>
          <p className="text-xs font-semibold text-red-300">Bekleyen aidat: {formatCurrency(snapshot.totals.aidatPendingTotal)}</p>
          <p className="mt-2 text-xs font-semibold text-[#c4b5fd]">Özel ders ödemeleri: {formatCurrency(combinedPrivatePaid)}</p>
          <p className="text-xs font-semibold text-gray-400">{snapshot.privateLessonPackages.length} paket • {ozelDersPaymentCount} ödeme</p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#121215] p-2 sm:p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setActiveTab("aidat")}
            className={`min-h-11 rounded-xl px-3 text-[10px] font-black uppercase tracking-wider ${
              activeTab === "aidat" ? "bg-green-600 text-white" : "bg-black/30 text-gray-300"
            }`}
          >
            Aidat Geçmişi
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ozelDers")}
            className={`min-h-11 rounded-xl px-3 text-[10px] font-black uppercase tracking-wider ${
              activeTab === "ozelDers" ? "bg-green-600 text-white" : "bg-black/30 text-gray-300"
            }`}
          >
            Özel Ders Ödemeleri
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("plan")}
            className={`min-h-11 rounded-xl px-3 text-[10px] font-black uppercase tracking-wider ${
              activeTab === "plan" ? "bg-green-600 text-white" : "bg-black/30 text-gray-300"
            }`}
          >
            Sonraki Ödeme
          </button>
        </div>
      </section>

      {activeTab === "aidat" ? (
        <section className="rounded-2xl border border-white/10 bg-[#121215] p-5 space-y-4">
          <h2 className="text-sm font-black uppercase text-white">Aidat Geçmişi</h2>
          <p className="text-[10px] font-semibold text-gray-500">Geçmiş ödemeleriniz ({aidatHistoryCount})</p>
          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {snapshot.aidatPayments.length === 0 ? (
              <p className="text-xs font-semibold text-gray-500">Henüz aidat kaydı yok. “Sonraki Ödeme” sekmesinden planı belirleyebilir veya planlanan ödemeyi tamamlayabilirsiniz.</p>
            ) : (
              snapshot.aidatPayments.map((row) => (
                <div key={row.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-white">{row.description || "Aylik aidat"}</p>
                      <p className="text-[10px] font-bold text-gray-500">Vade: {row.due_date || "-"}</p>
                    </div>
                    <span className="text-sm font-black text-white">{formatCurrency(row.amount)}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {row.status === "odendi" ? (
                      <button
                        type="button"
                        onClick={() => void handleStatusUpdate(row.id, "bekliyor")}
                        disabled={statusSavingId === row.id}
                        className="min-h-10 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 text-[10px] font-black uppercase text-amber-300"
                      >
                        {statusSavingId === row.id ? "..." : "Bekliyor Olarak İşaretle"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleStatusUpdate(row.id, "odendi")}
                        disabled={statusSavingId === row.id}
                        className="min-h-10 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 text-[10px] font-black uppercase text-emerald-300"
                      >
                        {statusSavingId === row.id ? "..." : "Ödendi Olarak İşaretle"}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "ozelDers" ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#121215] p-5">
            <h2 className="text-sm font-black uppercase text-white">Özel Ders Paketleri</h2>
            <p className="mt-1 text-[10px] font-semibold text-gray-500">Özel ders paket ve ödemeleri</p>
            <div className="mt-3 space-y-2">
              {snapshot.privateLessonPackages.length === 0 ? (
                <p className="text-xs font-bold text-gray-500">Henüz özel ders paketi bulunmuyor.</p>
              ) : (
                snapshot.privateLessonPackages.map((pkg) => (
                  <div key={pkg.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="text-xs font-black text-white">{pkg.packageName}</p>
                    <p className="text-[10px] font-bold text-gray-500">
                      {pkg.paymentStatus.toUpperCase()} · {pkg.usedLessons}/{pkg.totalLessons} ders · ₺{pkg.amountPaid.toLocaleString("tr-TR")} / ₺{pkg.totalPrice.toLocaleString("tr-TR")}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#121215] p-5">
            <h2 className="text-sm font-black uppercase text-white">Özel Ders Ödemeleri</h2>
            <p className="mt-1 text-[10px] font-semibold text-gray-500">Ödeme kayıtları ({ozelDersPaymentCount})</p>
            <div className="mt-3 space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {snapshot.privateLessonPayments.length === 0 ? (
                <p className="text-xs font-bold text-gray-500">Henüz özel ders ödeme geçmişi yok.</p>
              ) : (
                snapshot.privateLessonPayments.map((pay) => (
                  <div key={pay.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-white">{formatCurrency(pay.amount)}</p>
                      <p className="text-[10px] font-bold text-gray-500">{new Date(pay.paidAt).toLocaleDateString("tr-TR")}</p>
                    </div>
                    {pay.note ? <p className="mt-1 text-[10px] font-bold text-gray-400">{pay.note}</p> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "plan" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={handlePlanSubmit} className="rounded-2xl border border-white/10 bg-[#121215] p-5 space-y-3">
            <h2 className="text-sm font-black uppercase text-white">Sonraki Ödeme</h2>
            <p className="text-[10px] font-semibold text-gray-500">Bir sonraki planlanan aidat</p>
            <input
              type="date"
              value={planForm.dueDate}
              onChange={(e) => setPlanForm((p) => ({ ...p, dueDate: e.target.value }))}
              className="w-full min-h-11 rounded-xl border border-white/10 bg-black px-3 text-sm font-bold text-white"
            />
            <input
              type="number"
              value={planForm.amount}
              onChange={(e) => setPlanForm((p) => ({ ...p, amount: e.target.value }))}
              placeholder="Bir sonraki ödeme tutarı (₺)"
              className="w-full min-h-11 rounded-xl border border-white/10 bg-black px-3 text-sm font-bold text-white"
            />
            <button disabled={planSaving} className="min-h-11 rounded-xl bg-green-600 px-4 text-[10px] font-black uppercase text-white">
              {planSaving ? "Kaydediliyor..." : "Planı Kaydet"}
            </button>
            <button
              type="button"
              disabled={markingPlannedPaid}
              onClick={() => void handleMarkPlannedPaid()}
              className="min-h-11 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 text-[10px] font-black uppercase text-emerald-300"
            >
              {markingPlannedPaid ? "İşleniyor..." : "Aidatı Ödendi Olarak Tamamla"}
            </button>
          </form>
          <form onSubmit={handleCreateAidat} className="rounded-2xl border border-white/10 bg-[#121215] p-5 space-y-3">
            <h2 className="text-sm font-black uppercase text-white">Geçmiş Ödeme Ekle</h2>
            <p className="text-[10px] font-semibold text-gray-500">Plan dışı ödeme/düzeltme kaydı</p>
            <input
              type="number"
              required
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))}
              placeholder="Tutar (₺)"
              className="w-full min-h-11 rounded-xl border border-white/10 bg-black px-3 text-sm font-bold text-white"
            />
            <input
              type="date"
              required
              value={paymentForm.dueDate}
              onChange={(e) => setPaymentForm((p) => ({ ...p, dueDate: e.target.value }))}
              className="w-full min-h-11 rounded-xl border border-white/10 bg-black px-3 text-sm font-bold text-white"
            />
            <input
              value={paymentForm.description}
              onChange={(e) => setPaymentForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Açıklama"
              className="w-full min-h-11 rounded-xl border border-white/10 bg-black px-3 text-sm font-bold text-white"
            />
            <button disabled={paymentSaving} className="min-h-11 rounded-xl bg-emerald-600 px-4 text-[10px] font-black uppercase text-white">
              {paymentSaving ? "İşleniyor..." : "Aidat Ekle"}
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
