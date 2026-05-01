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
  softDeleteOrgPayment,
  updateAthleteNextAidatPlanForManagement,
  updateOrgPaymentStatus,
} from "@/lib/actions/financeActions";
import type { AthleteFinanceDetail } from "@/lib/types";
import { getFinanceStatusPresentation } from "@/lib/finance/statusPresentation";
import { fetchMeRoleClient } from "@/lib/auth/meRoleClient";

type FinanceTab = "timeline" | "hizmet" | "plan";

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

function summaryActionMessage(summary: AthleteFinanceDetail["summary"]) {
  return getFinanceStatusPresentation(summary).supportText;
}

function paymentDisplayTitle(row: AthleteFinanceDetail["aidatPayments"][number]) {
  if (row.display_name?.trim()) return row.display_name.trim();
  if (row.payment_scope === "extra_charge") {
    if (row.payment_kind === "license") return "Lisans Bedeli";
    if (row.payment_kind === "event") return "Etkinlik Ücreti";
    if (row.payment_kind === "equipment") return "Ekipman / Forma Ücreti";
    return "Ek Tahsilat";
  }
  if (row.payment_scope === "private_lesson" || row.payment_type === "paket") {
    return "Paket Ödemesi";
  }
  return row.description || "Ödeme";
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
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    dueDate: "",
    description: "",
    scope: "extra_charge",
    kind: "manual_other",
    displayName: "",
  });
  const [activeTab, setActiveTab] = useState<FinanceTab>("timeline");
  const [canOpenAccountingPanel, setCanOpenAccountingPanel] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(() => {
      void (async () => {
        const me = await fetchMeRoleClient();
        if (cancelled || !me.ok) return;
        setCanOpenAccountingPanel(me.role === "admin" || me.role === "super_admin");
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, []);

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
      setMessage(res.error || "Ödeme planı güncellenemedi.");
    } else {
      setMessage("Sonraki ödeme planı güncellendi.");
      await load();
    }
    setPlanSaving(false);
  }

  async function handleCreatePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!snapshot) return;
    setPaymentSaving(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("profile_id", snapshot.athlete.id);
    fd.append("payment_scope", paymentForm.scope);
    fd.append("payment_kind", paymentForm.kind);
    fd.append("display_name", paymentForm.displayName);
    if (paymentForm.scope === "membership") fd.append("payment_type", "aylik");
    if (paymentForm.scope === "private_lesson") fd.append("payment_type", "paket");
    fd.append("amount", paymentForm.amount);
    fd.append("due_date", paymentForm.dueDate);
    fd.append("desc", paymentForm.description);
    const res = await createOrgPayment(fd);
    if ("error" in res) {
      setMessage(res.error || "Tahsilat kaydi olusturulamadi.");
    } else {
      setMessage("Tahsilat kaydi olusturuldu.");
      setPaymentForm((prev) => ({ ...prev, amount: "", dueDate: "", description: "", displayName: "" }));
      await load();
    }
    setPaymentSaving(false);
  }

  async function handleDeletePayment(paymentId: string) {
    const fd = new FormData();
    fd.append("payment_id", paymentId);
    fd.append("delete_reason", "ui_manual_delete");
    const res = await softDeleteOrgPayment(fd);
    if ("error" in res) {
      setMessage(res.error || "Ödeme kaydı kaldırılamadı.");
      return;
    }
    setMessage("Ödeme kaydı kaldırıldı.");
    await load();
  }

  async function handleMarkPlannedPaid() {
    if (!snapshot) return;
    setMarkingPlannedPaid(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("athlete_id", snapshot.athlete.id);
    const res = await markPlannedAidatAsPaidForManagement(fd);
    if ("error" in res) {
      setMessage(res.error || "Planlanan ödeme tamamlanamadı.");
    } else {
      setMessage("Planlanan ödeme tamamlandı olarak işlendi.");
      await load();
    }
    setMarkingPlannedPaid(false);
  }

  async function handleStatusUpdate(paymentId: string, status: "odendi" | "bekliyor") {
    setStatusSavingId(paymentId);
    setMessage(null);
    const res = await updateOrgPaymentStatus(paymentId, status);
    if ("error" in res) setMessage(res.error || "Ödeme durumu güncellenemedi.");
    else {
      setMessage("Ödeme durumu güncellendi.");
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
        <Link href="/finans" className="text-[10px] font-black uppercase text-green-400">← Sporcu Ödemeleri</Link>
        <Notification message={message || "Finans detayi alinamadi."} variant="error" />
      </div>
    );
  }

  const dueDateLabel = formatDate(snapshot.summary.nextDueDate);
  const dueAmountLabel = formatCurrency(snapshot.summary.nextAmount);
  const summaryPresentation = getFinanceStatusPresentation(snapshot.summary);
  const aidatHistoryCount = snapshot.aidatPayments.length;
  const ozelDersPaymentCount = snapshot.privateLessonPayments.length;
  const showPrimaryAction = snapshot.summary.tone !== "paid";
  const primaryActionLabel = snapshot.summary.tone === "overdue" ? "Ödemeyi Tamamla" : "Erken Ödeme Yap";

  return (
    <div className="space-y-6 pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/finans" className="text-[10px] font-black uppercase text-green-400">← Sporcu Ödemeleri</Link>
          {canOpenAccountingPanel ? (
            <Link
              href="/muhasebe-finans"
              className="inline-flex min-h-10 items-center rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 text-[10px] font-black uppercase tracking-wide text-emerald-200 hover:bg-emerald-500/15"
            >
              Genel muhasebe paneline git
            </Link>
          ) : null}
        </div>
        <h1 className="text-2xl font-black uppercase italic text-white">
          {snapshot.athlete.fullName} · Finans Detayı
        </h1>
      </div>
      <p className="text-xs font-semibold text-gray-400">
        Sporcu bazlı borç, ödeme ve tahsilat durumlarını yönetin.
      </p>

      {message ? (
        <Notification
          message={message}
          variant={message.toLowerCase().includes("guncellendi") || message.toLowerCase().includes("olusturuldu") ? "success" : "error"}
        />
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        <div className={`rounded-2xl border p-5 md:col-span-2 ${summaryPresentation.cardClass}`}>
          <p className="text-[9px] font-black uppercase tracking-widest">Finans Durumu</p>
          <p className="mt-2 text-lg font-black uppercase italic">{summaryPresentation.label}</p>
          <p className="mt-2 text-[11px] font-semibold text-white/90">{summaryPresentation.supportText}</p>
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
          <p className="text-xs font-semibold text-red-300">Bekleyen ödeme: {formatCurrency(snapshot.totals.aidatPendingTotal)}</p>
          <p className="mt-2 text-xs font-semibold text-[#c4b5fd]">Özel ders ödemeleri: {formatCurrency(combinedPrivatePaid)}</p>
          <p className="text-xs font-semibold text-gray-400">{snapshot.privateLessonPackages.length} paket • {ozelDersPaymentCount} ödeme</p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#121215] p-2 sm:p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setActiveTab("timeline")}
            className={`min-h-11 rounded-xl px-3 text-[10px] font-black uppercase tracking-wider ${
              activeTab === "timeline" ? "bg-green-600 text-white" : "bg-black/30 text-gray-300"
            }`}
          >
            Tahsilat Geçmişi
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("hizmet")}
            className={`min-h-11 rounded-xl px-3 text-[10px] font-black uppercase tracking-wider ${
              activeTab === "hizmet" ? "bg-green-600 text-white" : "bg-black/30 text-gray-300"
            }`}
          >
            Paket ve Hizmetler
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("plan")}
            className={`min-h-11 rounded-xl px-3 text-[10px] font-black uppercase tracking-wider ${
              activeTab === "plan" ? "bg-green-600 text-white" : "bg-black/30 text-gray-300"
            }`}
          >
            Planlı Tahsilatlar
          </button>
        </div>
      </section>

      {activeTab === "timeline" ? (
        <section className="rounded-2xl border border-white/10 bg-[#121215] p-5 space-y-4">
          <h2 className="text-sm font-black uppercase text-white">Tahsilat Geçmişi</h2>
            <p className="text-[10px] font-semibold text-gray-500">Geçmiş ödeme kayıtları ({aidatHistoryCount})</p>
          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {snapshot.aidatPayments.length === 0 ? (
              <p className="text-xs font-semibold text-gray-500">Henüz ödeme kaydı yok. Planlı Tahsilatlar sekmesinden sonraki planı yönetebilirsiniz.</p>
            ) : (
              snapshot.aidatPayments.map((row) => (
                <div key={row.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-white">{paymentDisplayTitle(row)}</p>
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
                    <button
                      type="button"
                      onClick={() => void handleDeletePayment(row.id)}
                      className="min-h-10 rounded-lg border border-red-500/30 bg-red-500/10 px-3 text-[10px] font-black uppercase text-red-300"
                    >
                      Kaydı Kaldır
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "hizmet" ? (
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
            <h2 className="text-sm font-black uppercase text-white">Paket ve Hizmet Tahsilatları</h2>
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
            <h2 className="text-sm font-black uppercase text-white">Planlı Tahsilatlar</h2>
            <p className="text-[10px] font-semibold text-gray-500">Bir sonraki planlanan ödeme</p>
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
              {markingPlannedPaid ? "İşleniyor..." : "Ödemeyi Tamamlandı Olarak İşle"}
            </button>
          </form>
          <form onSubmit={handleCreatePayment} className="rounded-2xl border border-white/10 bg-[#121215] p-5 space-y-3">
            <h2 className="text-sm font-black uppercase text-white">Manuel Tahsilat Ekle</h2>
            <p className="text-[10px] font-semibold text-gray-500">Plan dışı ödeme/düzeltme kaydı</p>
            <input
              value={paymentForm.displayName}
              onChange={(e) => setPaymentForm((p) => ({ ...p, displayName: e.target.value }))}
              placeholder="Ödeme adı (Lisans Bedeli, Yaz Kampı...)"
              className="w-full min-h-11 rounded-xl border border-white/10 bg-black px-3 text-sm font-bold text-white"
            />
            <select
              value={paymentForm.kind}
              onChange={(e) =>
                setPaymentForm((p) => ({
                  ...p,
                  kind: e.target.value,
                  scope: e.target.value === "monthly_membership" ? "membership" : e.target.value === "private_lesson_package" ? "private_lesson" : "extra_charge",
                }))
              }
              className="w-full min-h-11 rounded-xl border border-white/10 bg-black px-3 text-sm font-bold text-white"
            >
              <option value="manual_other">Manuel Ek Tahsilat</option>
              <option value="license">Lisans</option>
              <option value="event">Etkinlik</option>
              <option value="equipment">Ekipman</option>
              <option value="monthly_membership">Aylik Uyelik</option>
              <option value="private_lesson_package">Ozel Ders Paketi</option>
            </select>
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
              {paymentSaving ? "İşleniyor..." : "Tahsilat Ekle"}
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
