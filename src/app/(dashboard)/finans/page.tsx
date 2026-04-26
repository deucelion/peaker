"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, ChevronRight, Loader2, Clock3, CheckCircle2, AlertTriangle } from "lucide-react";
import { listOrgPaymentsForAdmin } from "@/lib/actions/financeActions";
import type { FinanceStatusSummary } from "@/lib/types";
import Notification from "@/components/Notification";
import { getFinanceStatusPresentation } from "@/lib/finance/statusPresentation";
type FinanceListPlayer = {
  id: string;
  full_name: string;
  number?: string | null;
  position?: string | null;
  financeSummary: FinanceStatusSummary;
  nextAidatPlan: { dueDate: string | null; amount: number | null };
  paymentModel: "Aylik" | "Paket" | "Hibrit" | "Ek Tahsilat";
  activeProductLabel: string | null;
  overdueAmount: number;
  pendingAmountTotal: number;
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
};

export default function FinansYonetimi() {
  const [players, setPlayers] = useState<FinanceListPlayer[]>([]);
  const [pendingAmountTotal, setPendingAmountTotal] = useState(0);
  const [collectionPower, setCollectionPower] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await listOrgPaymentsForAdmin();
    if ("error" in res) {
      setLoadError(res.error);
      setPlayers([]);
      setPendingAmountTotal(0);
      setCollectionPower(0);
      setLoading(false);
      return;
    }
    setLoadError(null);
    setPlayers(res.snapshot.players);
    setPendingAmountTotal(res.snapshot.pendingAmountTotal);
    setCollectionPower(res.snapshot.collectionPowerPercent);
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchData]);

  const filteredPlayers = useMemo(
    () => players.filter((p) => (p.full_name || "").toLowerCase().includes(searchTerm.toLowerCase())),
    [players, searchTerm]
  );

  if (loading) {
    return (
      <div className="flex min-h-[45dvh] items-center justify-center text-green-500">
        <Loader2 className="size-10 animate-spin" aria-hidden />
      </div>
    );
  }

  return (
    <div className="ui-page-loose space-y-6 pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="ui-h1">Sporcu <span className="text-green-500">Ödemeleri</span></h1>
          <p className="ui-lead border-green-500">Odeme modeli, borc ve tahsilat durumunu tek listede izleyin</p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-2xl border border-white/10 bg-[#121215] px-4 py-3 text-right">
            <p className="text-[8px] font-black uppercase text-gray-500">Bekleyen toplam</p>
            <p className="text-xl font-black italic text-amber-300">₺{pendingAmountTotal.toLocaleString("tr-TR")}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#121215] px-4 py-3 text-right">
            <p className="text-[8px] font-black uppercase text-gray-500">Tahsilat gücü</p>
            <p className="text-xl font-black italic text-emerald-400">%{collectionPower}</p>
          </div>
        </div>
      </header>

      {loadError ? <Notification message={loadError} variant="error" /> : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} aria-hidden />
        <input
          type="search"
          placeholder="Sporcu ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="ui-input min-h-11 pl-11"
        />
      </div>

      <div className="grid gap-3">
        {filteredPlayers.map((player) => {
          const presentation = getFinanceStatusPresentation(player.financeSummary);
          const toneNode =
            presentation.tone === "red" ? (
              <span className={`inline-flex items-center gap-1 ${presentation.inlineTextClass}`}><AlertTriangle size={14} /> {presentation.label}</span>
            ) : presentation.tone === "yellow" ? (
              <span className={`inline-flex items-center gap-1 ${presentation.inlineTextClass}`}><Clock3 size={14} /> {presentation.label}</span>
            ) : presentation.tone === "orange" ? (
              <span className={`inline-flex items-center gap-1 ${presentation.inlineTextClass}`}><AlertTriangle size={14} /> {presentation.label}</span>
            ) : (
              <span className={`inline-flex items-center gap-1 ${presentation.inlineTextClass}`}><CheckCircle2 size={14} /> {presentation.label}</span>
            );

          return (
            <Link
              key={player.id}
              href={`/finans/${player.id}`}
              className="group flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#121215] p-4 transition-colors sm:flex-row sm:items-center sm:justify-between sm:hover:border-green-500/40"
            >
              <div className="min-w-0">
                <p className="text-base font-black uppercase italic text-white">{player.full_name}</p>
                  <p className="text-[10px] font-bold uppercase text-gray-500">#{player.number || "00"} · {player.position || "Gelisim"} · {player.paymentModel}</p>
                  <p className="text-[10px] font-semibold text-gray-400">{player.activeProductLabel || "Aktif plan bulunmuyor"}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                    <p className="text-[9px] font-black uppercase text-gray-500">Sonraki planli tahsilat</p>
                  <p className="text-xs font-black text-white">{player.financeSummary.nextDueDate || player.nextAidatPlan.dueDate || "-"}</p>
                  <p className="text-xs font-bold text-gray-400">₺{player.financeSummary.nextAmount ?? player.nextAidatPlan.amount ?? 0}</p>
                    <p className="text-[10px] font-semibold text-red-300">Vadesi geçmiş: ₺{player.overdueAmount.toLocaleString("tr-TR")}</p>
                    <p className="text-[10px] font-semibold text-amber-300">Açık bakiye: ₺{player.pendingAmountTotal.toLocaleString("tr-TR")}</p>
                    <p className="text-[10px] font-semibold text-gray-500">
                      Son tahsilat: {player.lastPaymentDate ? new Date(player.lastPaymentDate).toLocaleDateString("tr-TR") : "-"} · ₺
                      {(player.lastPaymentAmount ?? 0).toLocaleString("tr-TR")}
                    </p>
                </div>
                <div className="text-[11px] font-black uppercase">{toneNode}</div>
                <ChevronRight className="text-gray-600 sm:group-hover:text-green-400" />
              </div>
            </Link>
          );
        })}
        {filteredPlayers.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#121215] p-8 text-center text-xs font-black uppercase text-gray-500">
            Kayit bulunamadi.
          </div>
        ) : null}
      </div>
    </div>
  );
}