"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import Notification from "@/components/Notification";
import { CollectionPaymentForm } from "@/components/finance/CollectionPaymentForm";
import { AthleteFinanceTimeline } from "@/components/finance/AthleteFinanceTimeline";
import { TahsilatRecordSheet } from "@/components/finance/TahsilatRecordSheet";
import {
  getAthleteFinanceDetailForManagement,
  markPlannedAidatAsPaidForManagement,
  softDeleteOrgPayment,
  updateAthleteNextAidatPlanForManagement,
  updateOrgPaymentStatus,
} from "@/lib/actions/financeActions";
import type { AthleteFinanceDetail } from "@/lib/types";
import { fetchMeRoleClient } from "@/lib/auth/meRoleClient";
import { loadAccountingFinanceDashboard } from "@/lib/actions/accountingFinanceActions";
import { PATHS } from "@/lib/navigation/routeRegistry";

function monthKeyNow() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function FinanceAthleteDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const athleteId = typeof params.athleteId === "string" ? params.athleteId : params.athleteId?.[0] || "";
  const fromWorkspace = searchParams.get("from") === "workspace";
  const backHref = fromWorkspace ? `${PATHS.tahsilatMerkezi}?bolum=sporcular` : "/finans";
  const backLabel = fromWorkspace ? "← Tahsilat Merkezi" : "← Sporcu Ödemeleri";

  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<AthleteFinanceDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [planSaving, setPlanSaving] = useState(false);
  const [markingPlannedPaid, setMarkingPlannedPaid] = useState(false);
  const [paymentFormResetKey, setPaymentFormResetKey] = useState(0);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({ dueDate: "", amount: "" });
  const [canOpenAccountingPanel, setCanOpenAccountingPanel] = useState(false);
  const [tahsilatOpen, setTahsilatOpen] = useState(false);
  const [tahsilatResetKey, setTahsilatResetKey] = useState(0);
  const [tahsilatBusy, setTahsilatBusy] = useState(false);
  const [athleteOptions, setAthleteOptions] = useState<{ id: string; full_name: string }[]>([]);

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

  const accountingOrgId =
    snapshot?.aidatPayments[0]?.organization_id ?? snapshot?.privateLessonPackages[0]?.organizationId ?? null;

  const openAdminTahsilat = useCallback(async () => {
    setTahsilatResetKey((k) => k + 1);
    setTahsilatOpen(true);
    const res = await loadAccountingFinanceDashboard({
      orgId: null,
      month: monthKeyNow(),
      lessonType: "all",
      lessonStatus: "all",
      paymentStatus: "all",
    });
    if (!("error" in res)) {
      setAthleteOptions(res.snapshot.options.athletes);
    }
  }, []);

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
    if ("error" in res) setMessage(res.error || "Ödeme planı güncellenemedi.");
    else {
      setMessage("Sonraki ödeme planı güncellendi.");
      await load();
    }
    setPlanSaving(false);
  }

  async function handleDeletePayment(paymentId: string) {
    const fd = new FormData();
    fd.append("payment_id", paymentId);
    fd.append("delete_reason", "ui_manual_delete");
    const res = await softDeleteOrgPayment(fd);
    if ("error" in res) setMessage(res.error || "Ödeme kaydı kaldırılamadı.");
    else {
      setMessage("Ödeme kaydı kaldırıldı.");
      await load();
    }
  }

  async function handleMarkPlannedPaid() {
    if (!snapshot) return;
    setMarkingPlannedPaid(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("athlete_id", snapshot.athlete.id);
    const res = await markPlannedAidatAsPaidForManagement(fd);
    if ("error" in res) setMessage(res.error || "Planlanan ödeme tamamlanamadı.");
    else {
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
        <Link href={backHref} className="text-[10px] font-black uppercase text-green-400">
          {backLabel}
        </Link>
        <Notification message={message || "Finans detayı alınamadı."} variant="error" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={backHref} className="text-[10px] font-black uppercase text-green-400">
            {backLabel}
          </Link>
          {canOpenAccountingPanel && !fromWorkspace ? (
            <Link
              href={PATHS.tahsilatMerkezi}
              className="inline-flex min-h-10 items-center rounded-xl border border-emerald-500/45 bg-emerald-500/15 px-3 text-[10px] font-black uppercase tracking-wide text-emerald-100 hover:bg-emerald-500/25"
            >
              Tahsilat Merkezi
            </Link>
          ) : null}
        </div>
        <h1 className="text-2xl font-black uppercase italic text-white">
          {snapshot.athlete.fullName} · Finans Detayı
        </h1>
      </div>

      {canOpenAccountingPanel ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void openAdminTahsilat()}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-500 px-4 text-[10px] font-black uppercase tracking-wide text-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-400"
          >
            <Plus size={14} aria-hidden />
            Tahsilat kaydet (ödendi)
          </button>
        </div>
      ) : null}

      {message ? (
        <Notification
          message={message}
          variant={
            message.toLowerCase().includes("guncellendi") ||
            message.toLowerCase().includes("güncellendi") ||
            message.toLowerCase().includes("olusturuldu") ||
            message.toLowerCase().includes("oluşturuldu") ||
            message.toLowerCase().includes("islendi") ||
            message.toLowerCase().includes("işlendi") ||
            message.toLowerCase().includes("kaldırıldı")
              ? "success"
              : "error"
          }
        />
      ) : null}

      <AthleteFinanceTimeline
        snapshot={snapshot}
        mode="management"
        accent="green"
        statusSavingId={statusSavingId}
        markingPlannedPaid={markingPlannedPaid}
        onStatusUpdate={(id, status) => void handleStatusUpdate(id, status)}
        onDeletePayment={(id) => void handleDeletePayment(id)}
        onMarkPlannedPaid={() => void handleMarkPlannedPaid()}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={handlePlanSubmit} className="space-y-3 rounded-2xl border border-white/10 bg-[#121215] p-5">
          <h2 className="text-sm font-black uppercase text-white">Aidat planı düzenle</h2>
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
            {markingPlannedPaid ? "İşleniyor..." : "Planlı aidatı tamamlandı olarak işaretle"}
          </button>
        </form>

        {!canOpenAccountingPanel ? (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-[#121215] p-5">
            <h2 className="text-sm font-black uppercase text-white">Ödeme kaydet</h2>
            <p className="text-[10px] font-semibold text-gray-500">
              Koç kayıtları sporcu finans özeti ile senkron kalır; durum çoğunlukla bekliyor olarak açılır.
            </p>
            <CollectionPaymentForm
              variant="management"
              lockedProfileId={snapshot.athlete.id}
              organizationIdFromUrl={accountingOrgId}
              athletes={[{ id: snapshot.athlete.id, full_name: snapshot.athlete.fullName }]}
              resetKey={paymentFormResetKey}
              layout="page"
              onError={(err) => setMessage(err)}
              onSuccess={async () => {
                setMessage("Ödeme kaydı oluşturuldu.");
                setPaymentFormResetKey((k) => k + 1);
                await load();
              }}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5">
            <h2 className="text-sm font-black uppercase text-white">Resmi tahsilat</h2>
            <p className="mt-1 text-[10px] font-semibold text-gray-400">
              Yönetici tahsilatları deftere <strong className="text-emerald-300">ödendi</strong> olarak işlenir. Üstteki
              butonla hızlı kayıt açabilirsiniz.
            </p>
          </div>
        )}
      </section>

      {canOpenAccountingPanel ? (
        <TahsilatRecordSheet
          open={tahsilatOpen}
          organizationIdFromUrl={accountingOrgId}
          athletes={athleteOptions.length ? athleteOptions : [{ id: snapshot.athlete.id, full_name: snapshot.athlete.fullName }]}
          resetKey={tahsilatResetKey}
          initialPrefill={{ profileId: snapshot.athlete.id }}
          busy={tahsilatBusy}
          onBusyChange={setTahsilatBusy}
          onClose={() => setTahsilatOpen(false)}
          onError={(msg) => setMessage(msg)}
          onSuccess={async () => {
            setMessage("Tahsilat kaydı başarıyla eklendi.");
            setTahsilatOpen(false);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}
