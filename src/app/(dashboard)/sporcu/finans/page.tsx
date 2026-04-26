"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Notification from "@/components/Notification";
import { getMyFinanceDetailForAthlete } from "@/lib/actions/financeActions";
import type { AthleteFinanceDetail } from "@/lib/types";
import { getFinanceStatusPresentation } from "@/lib/finance/statusPresentation";

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

export default function AthleteFinanceDetailPage() {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<AthleteFinanceDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FinanceTab>("timeline");

  useEffect(() => {
    async function run() {
      setLoading(true);
      const res = await getMyFinanceDetailForAthlete();
      if ("error" in res) {
        setSnapshot(null);
        setMessage(res.error);
      } else {
        setSnapshot(res);
      }
      setLoading(false);
    }
    void run();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[45dvh] items-center justify-center">
        <Loader2 className="size-10 animate-spin text-[#7c3aed]" aria-hidden />
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="space-y-4">
        <Link href="/sporcu" className="text-[10px] font-black uppercase text-[#7c3aed]">← Sporcu Paneli</Link>
        <Notification message={message || "Finans detay alinamadi."} variant="error" />
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
        <Link href="/sporcu" className="text-[10px] font-black uppercase text-[#7c3aed]">← Sporcu Paneli</Link>
        <h1 className="text-2xl font-black uppercase italic text-white">Finans Detayı</h1>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#121215] p-4 sm:p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Ana Finans Bilgisi</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-[10px] font-black uppercase text-gray-500">Ödenecek Tutar</p>
            <p className="mt-1 text-xl font-black text-white">{dueAmountLabel}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-[10px] font-black uppercase text-gray-500">Son Ödeme Tarihi</p>
            <p className="mt-1 text-xl font-black text-white">{dueDateLabel}</p>
          </div>
        </div>
      </section>

      <section className={`rounded-2xl border p-5 ${summaryPresentation.cardClass}`}>
        <p className="text-[9px] font-black uppercase tracking-widest">Ödeme Durumu</p>
        <p className="mt-2 text-2xl font-black uppercase italic">{summaryPresentation.label}</p>
        <p className="mt-2 text-[11px] font-semibold text-white/90">{summaryPresentation.supportText}</p>
        <p className="mt-2 text-[10px] font-semibold text-white/80">
          Sonraki ödeme: {dueDateLabel} - {dueAmountLabel}
        </p>
        <div className="mt-3 rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-[11px] font-bold leading-relaxed text-white/90">
          {summaryActionMessage(snapshot.summary)}
        </div>
        {showPrimaryAction ? (
          <button
            type="button"
            onClick={() => setActiveTab("timeline")}
            className="mt-4 min-h-11 w-full rounded-xl bg-white px-4 text-[11px] font-black uppercase tracking-wide text-black md:w-auto md:min-w-[220px]"
          >
            {primaryActionLabel}
          </button>
        ) : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#121215] p-4">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Özel Ders Toplamı</p>
        <p className="mt-2 text-lg font-black text-[#c4b5fd]">{formatCurrency(snapshot.totals.privateLessonPaidTotal)}</p>
        <p className="text-xs font-semibold text-gray-400">{snapshot.privateLessonPackages.length} paket • {ozelDersPaymentCount} ödeme</p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#121215] p-2 sm:p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setActiveTab("timeline")}
            className={`min-h-11 rounded-xl px-3 text-[10px] font-black uppercase tracking-wider ${
              activeTab === "timeline" ? "bg-[#7c3aed] text-white" : "bg-black/30 text-gray-300"
            }`}
          >
            Tahsilat Geçmişi
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("hizmet")}
            className={`min-h-11 rounded-xl px-3 text-[10px] font-black uppercase tracking-wider ${
              activeTab === "hizmet" ? "bg-[#7c3aed] text-white" : "bg-black/30 text-gray-300"
            }`}
          >
            Paket ve Hizmetler
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("plan")}
            className={`min-h-11 rounded-xl px-3 text-[10px] font-black uppercase tracking-wider ${
              activeTab === "plan" ? "bg-[#7c3aed] text-white" : "bg-black/30 text-gray-300"
            }`}
          >
            Planlı Tahsilatlar
          </button>
        </div>
      </section>

      {activeTab === "timeline" ? (
        <section className="rounded-2xl border border-white/10 bg-[#121215] p-5">
          <h2 className="text-sm font-black uppercase text-white">Tahsilat Geçmişi</h2>
          <p className="mt-1 text-[10px] font-semibold text-gray-500">Geçmiş ödemeleriniz ({aidatHistoryCount})</p>
          <div className="mt-3 space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {snapshot.aidatPayments.length === 0 ? (
              <p className="text-xs font-semibold text-gray-500">Henüz aidat kaydı yok.</p>
            ) : (
              snapshot.aidatPayments.map((row) => (
                <div key={row.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-white">{formatCurrency(row.amount)}</p>
                    <p className="text-[10px] font-bold text-gray-500">{formatDate(row.due_date)}</p>
                  </div>
                  <p className="mt-1 text-[10px] font-semibold text-gray-400 uppercase">
                    {row.status === "odendi" ? "Ödendi" : "Bekliyor"}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "hizmet" ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#121215] p-5">
            <h2 className="text-sm font-black uppercase text-white">Paket ve Hizmet Tahsilatları</h2>
            <p className="mt-1 text-[10px] font-semibold text-gray-500">Toplam {ozelDersPaymentCount} ödeme kaydı listeleniyor.</p>
            <div className="mt-3 space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {snapshot.privateLessonPayments.length === 0 ? (
                <p className="text-xs font-semibold text-gray-500">Henüz özel ders ödeme kaydı yok.</p>
              ) : (
                snapshot.privateLessonPayments.map((row) => (
                  <div key={row.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-white">{formatCurrency(row.amount)}</p>
                      <p className="text-[10px] font-bold text-gray-500">{new Date(row.paidAt).toLocaleDateString("tr-TR")}</p>
                    </div>
                    {row.note ? <p className="mt-1 text-[10px] font-bold text-gray-400">{row.note}</p> : null}
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#121215] p-5">
            <h2 className="text-sm font-black uppercase text-white">Paket Özeti</h2>
            <div className="mt-3 space-y-2">
              {snapshot.privateLessonPackages.length === 0 ? (
                <p className="text-xs font-semibold text-gray-500">Henüz özel ders paketi bulunmuyor.</p>
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
        </section>
      ) : null}

      {activeTab === "plan" ? (
        <section className="rounded-2xl border border-white/10 bg-[#121215] p-5">
            <h2 className="text-sm font-black uppercase text-white">Planlı Tahsilatlar</h2>
          <p className="mt-1 text-[10px] font-semibold text-gray-500">
            Bir sonraki aidat planı yönetim tarafından belirlenir.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[10px] font-black uppercase text-gray-500">Tarih</p>
              <p className="mt-2 text-sm font-black text-white">{snapshot.summary.nextDueDate || "-"}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[10px] font-black uppercase text-gray-500">Tutar</p>
              <p className="mt-2 text-sm font-black text-white">₺{snapshot.summary.nextAmount ?? 0}</p>
            </div>
          </div>
          <p className="mt-3 text-[10px] font-semibold text-gray-500">
            Bu alanda yalnızca bilgi gösterilir. Güncelleme işlemleri yönetim panelinden yapılır.
          </p>
        </section>
      ) : null}
    </div>
  );
}
