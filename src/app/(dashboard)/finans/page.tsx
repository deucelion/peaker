"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, ChevronRight, Loader2, Clock3, CheckCircle2, AlertTriangle } from "lucide-react";
import { listOrgPaymentsForAdmin } from "@/lib/actions/financeActions";
import type { FinanceStatusSummary } from "@/lib/types";
import Notification from "@/components/Notification";
import EmptyStateCard from "@/components/EmptyStateCard";
import { getFinanceStatusPresentation } from "@/lib/finance/statusPresentation";
import { fetchMeRoleClient } from "@/lib/auth/meRoleClient";
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
  const [statusFilter, setStatusFilter] = useState("Tümü");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [canOpenAccountingPanel, setCanOpenAccountingPanel] = useState(false);

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

  const statusOptions = useMemo(
    () => [
      "Tümü",
      "Ödeme Tamamlandı",
      "Ödeme Bekleniyor",
      "Kısmi Ödeme",
      "Gecikmiş Ödeme",
      "Borç Bulunmuyor",
    ],
    []
  );

  const filteredPlayers = useMemo(() => {
    return players
      .filter((p) => (p.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()))
      .filter((p) => {
        if (statusFilter === "Tümü") return true;
        const presentation = getFinanceStatusPresentation(p.financeSummary);
        return presentation.label === statusFilter;
      });
  }, [players, searchTerm, statusFilter]);

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
          <p className="ui-lead border-green-500">Sporcu bazlı borç, ödeme ve tahsilat durumlarını yönetin.</p>
          <p className="mt-2 text-xs font-semibold text-gray-400">
            Bu ekran sporcu finans takibi içindir; genel muhasebe ve koç ödemesi süreci ayrı panelde yönetilir.
          </p>
          {canOpenAccountingPanel ? (
            <Link
              href="/muhasebe-finans"
              className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 text-[10px] font-black uppercase tracking-wide text-emerald-200 hover:bg-emerald-500/15"
            >
              Genel muhasebe paneline git
            </Link>
          ) : null}
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-full max-w-sm">
          <label className="mb-1 block text-[10px] font-black uppercase text-gray-500">Durum filtresi</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="ui-select min-h-11 w-full"
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <p className="text-[11px] font-bold text-gray-500">{filteredPlayers.length} kayıt gösteriliyor</p>
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
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
                <div className="text-left sm:text-right">
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
                <ChevronRight className="self-end text-gray-600 sm:self-auto sm:group-hover:text-green-400" />
              </div>
            </Link>
          );
        })}
        {filteredPlayers.length === 0 ? (
          <EmptyStateCard
            title="Kayıt bulunamadı"
            description="Seçili filtrelerde sporcu ödeme kaydı görünmüyor."
            reason="Filtreler çok dar olabilir veya henüz finans kaydı açılmamış olabilir."
            primaryAction={{
              label: "Filtreleri sıfırla",
              onClick: () => {
                setSearchTerm("");
                setStatusFilter("Tümü");
              },
            }}
            secondaryAction={
              canOpenAccountingPanel ? { label: "Muhasebe paneline git", href: "/muhasebe-finans" } : undefined
            }
          />
        ) : null}
      </div>
    </div>
  );
}