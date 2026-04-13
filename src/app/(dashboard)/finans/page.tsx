"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  CheckCircle2,
  XCircle,
  Download,
  Filter,
  TrendingUp,
  Package,
  Clock,
  ChevronRight,
  MinusCircle,
  Loader2,
} from "lucide-react";
import {
  createOrgPayment,
  decrementOrgPaymentPackageSession,
  listOrgPaymentsForAdmin,
  updateOrgPaymentStatus,
} from "@/lib/actions/financeActions";
import { FINANCE_ADMIN_ONLY_MESSAGE } from "@/lib/finance/messages";
import type { PaymentRow, PlayerWithPayments } from "@/types/domain";
import Notification from "@/components/Notification";

export default function FinansYonetimi() {
  const [players, setPlayers] = useState<PlayerWithPayments[]>([]);
  const [pendingAmountTotal, setPendingAmountTotal] = useState(0);
  const [collectionPower, setCollectionPower] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerWithPayments | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<'aylik' | 'paket'>('aylik');
  const [statusFilter, setStatusFilter] = useState<"tum" | "bekliyor" | "odendi">("tum");
  const [typeFilter, setTypeFilter] = useState<"tum" | "aylik" | "paket">("tum");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setAccessDenied(false);
    const res = await listOrgPaymentsForAdmin();
    if ("error" in res) {
      setPlayers([]);
      setPendingAmountTotal(0);
      setCollectionPower(0);
      if (res.error === FINANCE_ADMIN_ONLY_MESSAGE) {
        setAccessDenied(true);
      } else {
        setLoadError(res.error);
      }
      setLoading(false);
      return;
    }
    const { snapshot } = res;
    setPlayers(snapshot.players);
    setPendingAmountTotal(snapshot.pendingAmountTotal);
    setCollectionPower(snapshot.collectionPowerPercent);
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchData]);

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayer) return;

    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    formData.set("profile_id", selectedPlayer.id);
    formData.set("payment_type", paymentType);

    const result = await createOrgPayment(formData);
    if ("error" in result && result.error) {
      setActionMessage(result.error);
      return;
    }
    setIsModalOpen(false);
    setActionMessage(null);
    void fetchData();
  };

  const updatePaymentStatus = async (paymentId: string, status: string) => {
    const result = await updateOrgPaymentStatus(paymentId, status);
    if ("error" in result && result.error) {
      setActionMessage(result.error);
      return;
    }
    void fetchData();
  };

  const handleSessionMinus = async (paymentId: string, currentRemaining: number) => {
    if (currentRemaining <= 0) {
      setActionMessage("Paket bitti.");
      return;
    }
    const result = await decrementOrgPaymentPackageSession(paymentId);
    if ("error" in result && result.error) {
      setActionMessage(result.error);
      return;
    }
    void fetchData();
    setSelectedPlayer((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        payments: (prev.payments || []).map((p) =>
          p.id === paymentId ? { ...p, remaining_sessions: currentRemaining - 1 } : p
        ),
      };
    });
  };

  const nextFilter = () => {
    setStatusFilter((prev) => {
      if (prev === "tum") return "bekliyor";
      if (prev === "bekliyor") return "odendi";
      return "tum";
    });
  };

  const nextTypeFilter = () => {
    setTypeFilter((prev) => {
      if (prev === "tum") return "aylik";
      if (prev === "aylik") return "paket";
      return "tum";
    });
  };

  const handleExportReport = () => {
    const rows = players
      .filter((p) => p.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
      .flatMap((player) =>
        (player.payments || [])
          .filter((payment: PaymentRow) => statusFilter === "tum" || payment.status === statusFilter)
          .filter((payment: PaymentRow) => typeFilter === "tum" || payment.payment_type === typeFilter)
          .map((payment: PaymentRow) => ({
            sporcu: player.full_name,
            tutar: payment.amount,
            tur: payment.payment_type,
            durum: payment.status,
            vade: payment.due_date || "",
            aciklama: payment.description || "",
          }))
      );

    if (rows.length === 0) {
      setActionMessage("Rapor için filtreye uygun ödeme kaydı bulunamadı.");
      return;
    }

    const header = "sporcu,tutar,tur,durum,vade,aciklama";
    const csv = [
      header,
      ...rows.map((row) =>
        [row.sporcu, row.tutar, row.tur, row.durum, row.vade, row.aciklama]
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `finans-raporu-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setActionMessage("Rapor indirildi.");
  };

  const filteredPlayers = players
    .filter((p) => p.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter((player) => {
      if (statusFilter === "tum" && typeFilter === "tum") return true;
      const latest = [...(player.payments || [])].sort((a, b) => new Date(b.due_date || 0).getTime() - new Date(a.due_date || 0).getTime())[0];
      const statusOk = statusFilter === "tum" || latest?.status === statusFilter;
      const typeOk = typeFilter === "tum" || latest?.payment_type === typeFilter;
      return statusOk && typeOk;
    });

  if (loading) return (
    <div className="flex min-h-[45dvh] min-w-0 flex-wrap items-center justify-center gap-3 overflow-x-hidden px-4 py-10 pb-[max(1rem,env(safe-area-inset-bottom,0px))] text-center text-sm font-black uppercase italic tracking-wide text-green-500 animate-pulse sm:text-base sm:tracking-widest">
      <Loader2 className="shrink-0 animate-spin" aria-hidden /> <span>Finansal Veriler Yükleniyor...</span>
    </div>
  );

  if (accessDenied) return (
    <div className="min-w-0 px-4 py-8 text-center sm:p-20">
      <XCircle size={64} className="mx-auto mb-6 text-red-500" aria-hidden />
      <h2 className="text-3xl font-black uppercase italic text-white">YETKİSİZ ERİŞİM</h2>
      <p className="mt-4 break-words text-xs font-bold uppercase italic tracking-widest text-gray-500">Finansal verileri sadece işletme sahibi görüntüleyebilir.</p>
    </div>
  );

  return (
    <div className="ui-page-loose animate-in fade-in duration-500 min-w-0 overflow-x-hidden pb-[max(5rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="ui-h1">AİDAT <span className="text-green-500">TAKİBİ</span></h1>
          <p className="ui-lead break-words border-green-500">Finansal Durum ve Tahsilat Yönetimi</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto shrink-0">
          <div className="bg-[#121215] border border-white/5 p-4 rounded-3xl text-right min-w-0 sm:min-w-[140px] flex-1 sm:flex-initial">
            <p className="text-[8px] font-black text-gray-500 uppercase italic">Bekleyen tutar</p>
            <p className="text-xl font-black italic text-amber-400 leading-none">₺{pendingAmountTotal.toLocaleString("tr-TR")}</p>
          </div>
          <div className="bg-[#121215] border border-white/5 p-4 rounded-3xl text-right min-w-0 sm:min-w-[140px] flex-1 sm:flex-initial">
            <p className="text-[8px] font-black text-gray-500 uppercase italic">Tahsilat Gücü</p>
            <p className="text-2xl font-black italic text-green-500 leading-none">%{collectionPower}</p>
          </div>
        </div>
      </header>
      {actionMessage ? (
        <div className="min-w-0 break-words">
          <Notification message={actionMessage} variant={actionMessage.toLowerCase().includes("indirildi") ? "success" : "info"} />
        </div>
      ) : null}

      {/* ARAÇ ÇUBUĞU */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between ui-toolbar shadow-xl min-w-0">
        <div className="relative w-full md:w-96 group min-w-0">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 transition-colors group-focus-within:text-green-500" size={18} aria-hidden />
          <input 
            type="search" 
            placeholder="Sporcu Ara..." 
            className="ui-input pl-12 text-base sm:text-sm focus:border-green-500 min-h-11 touch-manipulation"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3 w-full md:w-auto justify-stretch md:justify-end">
          <button
            type="button"
            onClick={nextFilter}
            className="ui-btn-ghost min-h-11 flex-1 sm:flex-initial px-4 sm:px-6 text-gray-300 touch-manipulation inline-flex items-center justify-center gap-2"
          >
            <Filter size={16} className="shrink-0" aria-hidden /> <span className="min-w-0 truncate">Durum: {statusFilter}</span>
          </button>
          <button
            type="button"
            onClick={nextTypeFilter}
            className="ui-btn-ghost min-h-11 flex-1 sm:flex-initial px-4 sm:px-6 text-gray-300 touch-manipulation inline-flex items-center justify-center gap-2"
          >
            <Package size={16} className="shrink-0" aria-hidden /> <span className="min-w-0 truncate">Tür: {typeFilter}</span>
          </button>
          <button
            type="button"
            onClick={handleExportReport}
            className="ui-btn inline-flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 bg-green-600 px-6 text-white shadow-lg shadow-green-600/20 sm:w-auto sm:hover:bg-green-700"
          >
            <Download size={16} aria-hidden /> Rapor Al
          </button>
        </div>
      </div>

      {/* LİSTE */}
      <div className="grid gap-3 min-w-0">
        {loadError && (
          <div className="rounded-2xl border border-red-500/20 bg-[#121215] p-8 text-center text-xs font-black uppercase italic tracking-widest text-red-400 break-words">
            {loadError}
          </div>
        )}
        {!loadError && filteredPlayers.map((player) => {
          const latest = [...(player.payments || [])].sort((a, b) => new Date(b.due_date || 0).getTime() - new Date(a.due_date || 0).getTime())[0];
          const isNear = latest?.status === 'bekliyor' && latest.due_date && (new Date(latest.due_date).getTime() - new Date().getTime()) < 259200000;

          return (
            <div 
              key={player.id} 
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedPlayer(player);
                  setIsModalOpen(true);
                }
              }}
              onClick={() => { setSelectedPlayer(player); setIsModalOpen(true); }}
              className="group flex min-w-0 cursor-pointer touch-manipulation flex-col justify-between gap-4 rounded-[1.75rem] border border-white/5 bg-[#121215] p-4 shadow-lg transition-all sm:gap-5 sm:rounded-[2rem] sm:p-5 sm:hover:border-green-500/40 lg:flex-row lg:items-center"
            >
              <div className="flex items-center gap-4 min-w-0 w-full lg:w-auto">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/5 bg-[#1c1c21] font-black text-xl italic text-green-500 transition-transform sm:group-hover:scale-105">
                  {player.full_name?.[0] || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-black uppercase italic leading-tight text-white transition-colors break-words sm:text-lg sm:group-hover:text-green-500">{player.full_name}</h3>
                  <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mt-1 italic opacity-60 break-words">#{player.number || "00"} • {player.position || 'GELİŞİM'}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 sm:gap-6 lg:gap-8 w-full lg:w-auto justify-between lg:justify-end min-w-0">
                <div className="text-center min-w-0 sm:min-w-[100px] flex-1 sm:flex-initial">
                  <p className="text-[8px] font-black text-gray-600 uppercase mb-2 italic">PAKET/TÜR</p>
                  <span className="text-[10px] font-black text-white px-4 py-1.5 bg-white/5 rounded-xl italic uppercase border border-white/5">
                    {latest?.payment_type === 'paket' ? `PAKET (${latest.remaining_sessions}/${latest.total_sessions})` : 'AYLIK AİDAT'}
                  </span>
                </div>

                <div className="text-center min-w-0 sm:min-w-[120px] flex-1 sm:flex-initial">
                  <p className="text-[8px] font-black text-gray-600 uppercase mb-2 italic">DURUM</p>
                  <div className={`flex items-center justify-center gap-2 text-[11px] font-black italic uppercase ${latest?.status === 'odendi' ? 'text-green-500' : isNear ? 'text-orange-500' : 'text-red-500'}`}>
                    {latest?.status === 'odendi' ? <CheckCircle2 size={14} aria-hidden /> : <Clock size={14} className={isNear ? "animate-bounce" : "animate-pulse"} aria-hidden />}
                    {latest?.status === 'odendi' ? 'ÖDENDİ' : isNear ? 'YAKLAŞTI' : 'BEKLİYOR'}
                  </div>
                </div>

                <div className="text-right min-w-0 shrink-0">
                  <p className="text-[8px] font-black text-gray-600 uppercase mb-2 italic">SON TARİH</p>
                  <p className="text-xs font-black text-gray-300 italic break-all">{latest?.due_date || '-'}</p>
                </div>
                <ChevronRight className="hidden shrink-0 text-gray-700 transition-all sm:block sm:group-hover:text-green-500" aria-hidden />
              </div>
            </div>
          );
        })}
        {!loadError && filteredPlayers.length === 0 && (
          <div className="rounded-2xl border border-white/5 bg-[#121215] p-8 text-center text-xs font-black uppercase italic tracking-widest text-gray-500 sm:p-16">
            {searchTerm || statusFilter !== "tum" || typeFilter !== "tum"
              ? "Filtreye uygun finans kaydı bulunamadı."
              : "Bu organizasyonda henuz finans kaydi bulunmuyor."}
          </div>
        )}
      </div>

      {/* MODAL */}
      {isModalOpen && selectedPlayer && (
        <div className="fixed inset-0 z-50 flex min-w-0 items-center justify-center overflow-x-hidden overflow-y-auto bg-black/95 p-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] backdrop-blur-xl sm:p-4">
          <div className="bg-[#121215] border border-white/10 w-full max-w-5xl max-h-[min(96dvh,100%)] overflow-y-auto overscroll-y-contain rounded-[2rem] sm:rounded-[3.5rem] overflow-x-hidden flex flex-col shadow-2xl animate-in zoom-in duration-300 my-auto min-w-0">
            
            <div className="p-5 sm:p-8 lg:p-10 border-b border-white/5 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center bg-white/[0.02] min-w-0">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 bg-green-500/10 rounded-3xl flex items-center justify-center font-black italic text-2xl sm:text-3xl text-green-500 border border-green-500/20">{selectedPlayer.full_name?.[0]}</div>
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-black italic text-white uppercase tracking-tight leading-tight break-words">{selectedPlayer.full_name}</h2>
                  <p className="text-[10px] sm:text-xs text-green-500 font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] mt-2 italic">FİNANSAL PORTFÖY & DERS TAKİBİ</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex min-h-12 min-w-12 touch-manipulation items-center justify-center self-end rounded-2xl border border-white/5 bg-white/5 text-gray-400 transition-all font-bold italic sm:self-auto sm:hover:bg-white/10" aria-label="Kapat">✕</button>
            </div>

            <div className="p-5 sm:p-8 lg:p-10 grid md:grid-cols-2 gap-6 lg:gap-10 min-w-0">
              <div className="space-y-6">
                  <h3 className="flex items-center gap-2 border-b border-white/5 pb-4 text-xs font-black uppercase italic tracking-widest text-white">
                  <TrendingUp size={16} className="text-green-500" aria-hidden /> ÖDEME VE DERS GEÇMİŞİ
                </h3>
                <div className="space-y-4 max-h-[min(50vh,400px)] sm:max-h-[400px] overflow-y-auto pr-2 custom-scrollbar min-w-0">
                  {selectedPlayer.payments?.map((p) => (
                    <div key={p.id} className="group flex min-w-0 flex-col gap-4 rounded-2xl border border-white/5 bg-[#1c1c21] p-4 transition-all sm:rounded-3xl sm:p-6 sm:hover:border-green-500/30 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black text-white italic uppercase tracking-wider">{p.description || (p.payment_type === 'paket' ? 'Özel Ders Paketi' : 'Aylık Aidat')}</p>
                          {p.payment_type === 'paket' && (
                            <span className="text-[9px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded-md font-black italic border border-green-500/20">
                              {p.remaining_sessions}/{p.total_sessions} DERS
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] text-gray-500 font-bold uppercase italic tracking-tighter">VADE: {p.due_date} • TUTAR: ₺{p.amount}</p>
                      </div>

                      <div className="flex flex-wrap items-stretch sm:items-center gap-2 shrink-0">
                        {p.payment_type === 'paket' && p.status === 'odendi' && (
                          <button 
                            type="button"
                            onClick={() => void handleSessionMinus(p.id, p.remaining_sessions ?? 0)}
                            className="inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-[9px] font-black italic text-red-500 transition-all sm:hover:bg-red-500 sm:hover:text-white"
                          >
                            <MinusCircle size={14} aria-hidden /> DERS DÜŞ
                          </button>
                        )}
                        {p.status === 'bekliyor' ? (
                          <button
                            type="button"
                            onClick={() => void updatePaymentStatus(p.id, "odendi")}
                            className="min-h-11 touch-manipulation rounded-2xl bg-green-500 px-5 py-3 text-[10px] font-black uppercase italic tracking-widest text-white shadow-lg shadow-green-500/20 transition-all sm:hover:bg-green-400"
                          >
                            ÖDEME AL
                          </button>
                        ) : (
                          <div className="flex flex-col items-center">
                            <CheckCircle2 size={24} className="text-green-500" aria-hidden />
                            <span className="text-[8px] font-black text-green-500 mt-1 italic uppercase tracking-tighter">TAMAMLANDI</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#1c1c21]/40 p-5 sm:p-8 lg:p-10 rounded-[2rem] sm:rounded-[3rem] border border-white/5 shadow-inner min-w-0">
                <h3 className="text-xs font-black italic text-green-500 uppercase tracking-widest mb-6 sm:mb-10 text-center italic">YENİ ÖDEME/PAKET TANIMLA</h3>
                <form onSubmit={(ev) => void handleCreatePayment(ev)} className="space-y-5 sm:space-y-6 [&_input]:min-h-11 [&_input]:text-base [&_input]:sm:text-sm [&_input]:touch-manipulation">
                  <div className="flex gap-2 p-1.5 bg-black/40 rounded-2xl border border-white/5">
                    <button type="button" onClick={() => setPaymentType('aylik')} className={`min-h-11 flex-1 touch-manipulation rounded-xl py-3 text-[9px] font-black uppercase italic tracking-[0.1em] transition-all sm:text-[10px] ${paymentType === 'aylik' ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' : 'text-gray-500 sm:hover:text-white'}`}>AYLIK AİDAT</button>
                    <button type="button" onClick={() => setPaymentType('paket')} className={`min-h-11 flex-1 touch-manipulation rounded-xl py-3 text-[9px] font-black uppercase italic tracking-[0.1em] transition-all sm:text-[10px] ${paymentType === 'paket' ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' : 'text-gray-500 sm:hover:text-white'}`}>ÖZEL DERS PAKETİ</button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input name="amount" type="number" required inputMode="decimal" className="bg-black/30 border border-white/5 p-4 rounded-xl font-bold text-white focus:border-green-500 outline-none transition-all shadow-inner w-full min-w-0" placeholder="Tutar (₺)" />
                    <input name="due_date" type="date" required className="bg-black/30 border border-white/5 p-4 rounded-xl font-bold text-white focus:border-green-500 outline-none transition-all shadow-inner w-full min-w-0" />
                  </div>

                  {paymentType === 'paket' && (
                    <input
                      name="sessions"
                      type="number"
                      required
                      min={1}
                      inputMode="numeric"
                      className="w-full min-w-0 bg-black/30 border border-white/5 p-4 rounded-xl font-bold text-white focus:border-green-500 outline-none transition-all shadow-inner"
                      placeholder="Toplam Ders Sayısı"
                    />
                  )}

                  <input name="desc" type="text" className="w-full min-w-0 bg-black/30 border border-white/5 p-4 rounded-xl font-bold text-white focus:border-green-500 outline-none transition-all shadow-inner" placeholder="Açıklama (Örn: Mart Aidatı)" />

                  <button type="submit" className="mt-2 min-h-12 w-full touch-manipulation rounded-[1.5rem] bg-green-600 py-4 text-xs font-black uppercase italic tracking-[0.2em] text-white shadow-lg shadow-green-600/30 transition-all active:scale-[0.99] sm:mt-4 sm:min-h-14 sm:rounded-[2rem] sm:py-5 sm:tracking-[0.3em] sm:hover:bg-green-500">ÖDEMEYİ SİSTEME İŞLE</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}