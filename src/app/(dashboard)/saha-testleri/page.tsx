"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Trophy,
  Edit3,
  Trash2,
  X,
  Settings2,
  Calendar,
  ChevronRight,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { listManagementDirectory } from "@/lib/actions/managementDirectoryActions";
import {
  createFieldTestDefinition,
  deleteFieldTestDefinition,
  listAthleticResultsForActorByDate,
  listFieldTestDefinitionsForActor,
  saveAthleticFieldResults,
  type AthleticResultCell,
} from "@/lib/actions/athleticFieldActions";
import type { AthleticResultRow, ProfileBasic, TestDefinitionRow } from "@/types/domain";
import Notification from "@/components/Notification";

export default function SahaTestleriFinal() {
  const [isEditMode, setIsEditMode] = useState(false);
  const [showMetricModal, setShowMetricModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  
  const [metrics, setMetrics] = useState<TestDefinitionRow[]>([]); 
  const [players, setPlayers] = useState<ProfileBasic[]>([]); 
  const [testValues, setTestValues] = useState<Record<string, string | number>>({}); 
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [globalDate, setGlobalDate] = useState(new Date().toISOString().split('T')[0]);
  const [newMetric, setNewMetric] = useState({ name: "", unit: "", category: "Genel" });
  const fetchRunRef = useRef(0);

  const fetchData = useCallback(async () => {
    const runId = ++fetchRunRef.current;
    setLoading(true);
    try {
      const dir = await listManagementDirectory();
      if (runId !== fetchRunRef.current) return;
      if ("error" in dir) {
        setPlayers([]);
        setDirectoryError(dir.error ?? "Kadro yüklenemedi.");
        setMetrics([]);
        setTestValues({});
        return;
      }
      setDirectoryError(null);

      const roster: ProfileBasic[] = dir.athletes.map((a) => ({
        id: a.id,
        full_name: a.full_name || "Sporcu",
      }));

      // 1. Organizasyona özel metrik tanımları (server action -> RLS etkilenmez)
      const defsRes = await listFieldTestDefinitionsForActor();
      if (runId !== fetchRunRef.current) return;
      if ("error" in defsRes) {
        setSaveMessage(defsRes.error ?? "Metrik listesi alinamadi.");
        setMetrics([]);
      } else {
        setMetrics(((defsRes.metrics || []) as unknown) as TestDefinitionRow[]);
      }

      // 2. Mevcut sonuçlar — server action (org + koç yetkisi)
      const playerIds = roster.map((p) => p.id);
      let existingResults: AthleticResultRow[] = [];
      if (playerIds.length > 0) {
        const res = await listAthleticResultsForActorByDate({
          profileIds: playerIds,
          testDate: globalDate,
        });
        if (runId !== fetchRunRef.current) return;
        if ("error" in res) {
          setSaveMessage(res.error ?? "Sonuclar alinamadi.");
        } else {
          existingResults = res.results;
        }
      }
      if (runId !== fetchRunRef.current) return;

      setPlayers(roster);

      const resultsMap: Record<string, string | number> = {};
      existingResults.forEach((r) => {
        resultsMap[`${r.profile_id}-${r.test_id}`] = r.value;
      });
      setTestValues(resultsMap);
    } catch (error) {
      console.error("Veri çekme hatası:", error);
    } finally {
      if (runId === fetchRunRef.current) {
        setLoading(false);
      }
    }
  }, [globalDate]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const togglePlayerSelection = (id: string) => {
    setSelectedPlayers(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedPlayers.length === players.length) setSelectedPlayers([]);
    else setSelectedPlayers(players.map(p => p.id));
  };

  const handleAddMetric = async () => {
    if (!newMetric.name) return;
    const fd = new FormData();
    fd.append("name", newMetric.name);
    fd.append("unit", newMetric.unit);
    fd.append("category", newMetric.category || "Genel");
    const result = await createFieldTestDefinition(fd);
    if ("error" in result && result.error) {
      setSaveMessage(result.error);
      return;
    }
    if ("metric" in result && result.metric) {
      setMetrics((prev) => {
        const next = [result.metric as unknown as TestDefinitionRow, ...prev];
        const seen = new Set<string>();
        return next.filter((m) => {
          if (!m?.id || seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
      });
    }
    setSaveMessage("Metrik basariyla eklendi.");
    setNewMetric({ name: "", unit: "", category: "Genel" });
    void fetchData();
  };

  const handleDeleteMetric = async (id: string) => {
    if (!confirm("Bu metrik silindiğinde tüm sporcu sonuçları da silinecektir. Onaylıyor musunuz?")) return;
    const result = await deleteFieldTestDefinition(id);
    if ("error" in result && result.error) {
      setSaveMessage(result.error);
      return;
    }
    void fetchData();
  };

  const handleValueChange = (playerId: string, metricId: string, val: string) => {
    setTestValues((prev) => ({
      ...prev,
      [`${playerId}-${metricId}`]: val
    }));
  };

  const saveSelectedResults = async () => {
    if (selectedPlayers.length === 0) return;

    setSaveLoading(true);
    setSaveMessage(null);
    try {
      const cells: AthleticResultCell[] = [];
      for (const pId of selectedPlayers) {
        for (const m of metrics) {
          const key = `${pId}-${m.id}`;
          const raw = testValues[key];
          const str = typeof raw === "string" ? raw.trim() : raw;
          const numeric =
            str === "" || str === null || str === undefined ? null : Number(str);
          if (numeric !== null && Number.isNaN(numeric)) {
            setSaveMessage("Gecersiz sayisal deger.");
            setSaveLoading(false);
            return;
          }
          cells.push({ profileId: pId, testId: m.id, value: numeric });
        }
      }

      const result = await saveAthleticFieldResults({
        testDate: globalDate,
        selectedProfileIds: selectedPlayers,
        cells,
      });

      if ("error" in result && result.error) {
        setSaveMessage(result.error);
      } else {
        setIsEditMode(false);
        setSelectedPlayers([]);
        setSaveMessage("Sonuclar basariyla kaydedildi.");
        void fetchData();
      }
    } catch (err) {
      console.error(err);
      setSaveMessage("Kayit sirasinda beklenmedik bir hata olustu.");
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading && players.length === 0) return (
    <div className="min-h-[50dvh] px-4 flex flex-col items-center justify-center bg-black gap-4 min-w-0 overflow-x-hidden pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] text-center">
      <Loader2 className="w-10 h-10 text-[#7c3aed] animate-spin" aria-hidden />
      <p className="text-[10px] font-black uppercase italic tracking-wide sm:tracking-widest text-gray-500 break-words max-w-md">
        Terminal Hazırlanıyor...
      </p>
    </div>
  );

  return (
    <div className="ui-page min-w-0 overflow-x-hidden pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      
      {/* HEADER */}
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-5 sm:gap-8 min-w-0">
        <div className="space-y-3 sm:space-y-4 min-w-0">
          <h1 className="ui-h1 break-words">
            SAHA <span className="text-[#7c3aed]">YÖNETİMİ</span>
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-[#121215] border border-white/5 px-5 py-2.5 rounded-2xl shadow-xl">
              <div className={`w-2 h-2 rounded-full animate-pulse ${selectedPlayers.length > 0 ? 'bg-green-500' : 'bg-gray-700'}`} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 italic">
                {selectedPlayers.length} Aktif Seçim
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 w-full xl:w-auto min-w-0">
          <Link 
            href="/saha-testleri/genel-rapor"
            className="ui-btn-ghost min-h-12 flex flex-1 md:flex-none items-center justify-center gap-2 px-5 sm:px-7 py-3 sm:py-4 rounded-[1.5rem] sm:rounded-[1.75rem] font-black italic group touch-manipulation text-center"
          >
            <Trophy size={18} className="text-[#7c3aed] sm:group-hover:scale-110 transition-transform shrink-0" aria-hidden />{" "}
            <span className="break-words">ANALİZ MERKEZİ</span>
          </Link>

          <div className="flex-1 md:flex-none flex items-center gap-3 sm:gap-4 bg-[#121215] border border-white/5 px-4 sm:px-7 py-3 sm:py-4 rounded-[1.5rem] sm:rounded-[1.75rem] shadow-xl min-h-12 min-w-0">
            <Calendar size={18} className="text-[#7c3aed] shrink-0" aria-hidden />
            <input 
              type="date" 
              className="min-w-0 flex-1 bg-transparent text-base sm:text-[11px] font-black uppercase outline-none text-white cursor-pointer touch-manipulation"
              value={globalDate}
              onChange={(e) => setGlobalDate(e.target.value)}
            />
          </div>

          <button 
            type="button"
            onClick={() => setShowMetricModal(true)}
            className="ui-btn-ghost min-h-12 flex flex-1 md:flex-none items-center justify-center gap-2 px-5 sm:px-7 py-3 sm:py-4 rounded-[1.5rem] sm:rounded-[1.75rem] font-black italic touch-manipulation"
          >
            <Settings2 size={18} className="shrink-0" aria-hidden /> METRİKLER
          </button>
          
          <button 
            type="button"
            onClick={isEditMode ? saveSelectedResults : () => {
              if(selectedPlayers.length === 0) setSaveMessage("Once sporcu secmelisiniz.");
              else setIsEditMode(true);
            }}
            disabled={saveLoading}
            className={`min-h-12 flex-1 md:flex-none px-6 sm:px-10 py-3 sm:py-4 rounded-[1.5rem] sm:rounded-[1.75rem] font-black italic text-[10px] uppercase flex items-center justify-center gap-2 sm:gap-3 transition-all shadow-xl touch-manipulation ${
              isEditMode 
              ? "bg-green-600 sm:hover:bg-green-500 shadow-green-900/20" 
              : "bg-[#7c3aed] sm:hover:bg-[#6d28d9] shadow-[#7c3aed]/20"
            }`}
          >
            {saveLoading ? <Loader2 className="animate-spin" size={18} aria-hidden /> : isEditMode ? <CheckCircle2 size={18} aria-hidden /> : <Edit3 size={18} aria-hidden />}
            {isEditMode ? "DEĞİŞİKLİKLERİ KAYDET" : "VERİ GİRİŞİNE BAŞLA"}
          </button>
        </div>
      </header>

      {/* TABLO KONTEYNERI */}
      <div className="ui-card !p-0 overflow-hidden min-w-0">
        <p className="sm:hidden px-4 py-2 text-[9px] font-bold text-gray-500 uppercase tracking-wide border-b border-white/5">
          Tabloyu yatay kaydirarak tum metrikleri gorebilirsiniz.
        </p>
        <div className="overflow-x-auto [-webkit-overflow-scrolling:touch] overscroll-x-contain">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/5">
                <th className="p-5 w-[72px] text-center sticky left-0 bg-[#121215] z-30">
                  <input 
                    type="checkbox" 
                    className="w-6 h-6 rounded-xl border-white/10 bg-white/5 accent-[#7c3aed] cursor-pointer"
                    checked={selectedPlayers.length === players.length && players.length > 0}
                    onChange={selectAll}
                  />
                </th>
                <th className="p-5 sticky left-[72px] bg-[#121215] z-20 w-[260px]">
                  <span className="text-[10px] font-black text-gray-500 uppercase italic tracking-[0.3em]">Sporcu Kadrosu</span>
                </th>
                {metrics.map(m => (
                  <th key={m.id} className="p-5 text-center border-l border-white/5 min-w-[140px]">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-white font-black italic text-xs uppercase tracking-tighter">{m.name}</span>
                      <div className="px-3 py-1 bg-[#7c3aed]/10 rounded-full">
                        <span className="text-[#7c3aed] font-bold text-[9px] uppercase tracking-widest">{m.unit}</span>
                      </div>
                    </div>
                  </th>
                ))}
                <th className="p-5 text-right sticky right-0 z-20 bg-[#121215] border-l border-white/5 shadow-[-20px_0_30px_-15px_rgba(0,0,0,0.5)]">
                  <span className="text-[10px] font-black text-gray-500 uppercase italic tracking-[0.3em]">İşlem</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {players.map(player => {
                const isSelected = selectedPlayers.includes(player.id);
                return (
                  <tr key={player.id} className={`h-[80px] transition-all duration-300 group ${isSelected ? 'bg-[#7c3aed]/5' : 'sm:hover:bg-white/[0.01]'}`}>
                    <td className="p-5 text-center sticky left-0 bg-inherit z-30">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => togglePlayerSelection(player.id)}
                        className="w-6 h-6 rounded-xl border-white/10 bg-white/5 accent-[#7c3aed] cursor-pointer"
                      />
                    </td>
                    <td className="p-5 sticky left-[72px] bg-inherit z-20">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xs font-black italic transition-all duration-500 border ${isSelected ? 'bg-[#7c3aed] text-white border-transparent scale-110 rotate-3 shadow-xl' : 'bg-[#1c1c21] text-gray-600 border-white/5 sm:group-hover:border-[#7c3aed]/30'}`}>
                          {player.full_name.substring(0,2).toUpperCase()}
                        </div>
                        <span className={`font-black italic text-sm sm:text-[15px] uppercase tracking-tight transition-all duration-300 truncate min-w-0 max-w-[min(220px,45vw)] sm:max-w-[220px] ${isSelected ? 'text-white sm:translate-x-1' : 'text-gray-500 sm:group-hover:text-gray-300'}`}>
                          {player.full_name}
                        </span>
                      </div>
                    </td>
                    {metrics.map(metric => (
                      <td key={metric.id} className="p-6 border-l border-white/5">
                        {isEditMode && isSelected ? (
                          <div className="relative group/input">
                            <input 
                              type="number"
                              step="0.01"
                              inputMode="decimal"
                              className="w-full min-w-0 bg-black border border-white/10 rounded-2xl py-4 sm:py-5 text-center text-base sm:text-lg font-black text-[#7c3aed] outline-none focus:border-[#7c3aed] focus:ring-4 focus:ring-[#7c3aed]/10 transition-all placeholder:opacity-20 touch-manipulation"
                              placeholder="0.00"
                              value={testValues[`${player.id}-${metric.id}`] || ""}
                              onChange={(e) => handleValueChange(player.id, metric.id, e.target.value)}
                            />
                          </div>
                        ) : (
                          <div className={`text-center font-black italic text-xl tracking-tighter transition-all ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                            {testValues[`${player.id}-${metric.id}`] ?? <span className="opacity-5 text-sm">NOT_SET</span>}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="p-5 text-right sticky right-0 z-20 bg-inherit border-l border-white/5 shadow-[-20px_0_30px_-15px_rgba(0,0,0,0.5)]">
                      <Link 
                        href={`/sporcu/${player.id}`}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center p-3 sm:p-4 bg-[#1c1c21] sm:hover:bg-[#7c3aed] text-gray-500 sm:hover:text-white rounded-2xl transition-all shadow-xl group/btn touch-manipulation" 
                        aria-label={`${player.full_name} profili`}
                      >
                        <ChevronRight size={20} className="sm:group-hover/btn:translate-x-1 transition-transform" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {directoryError && (
        <div className="min-w-0 break-words">
          <Notification message={directoryError} variant="error" className="px-6 py-4" />
        </div>
      )}
      {saveMessage && (
        <div className="min-w-0 break-words">
          <Notification message={saveMessage} variant={saveMessage.toLowerCase().includes("hata") ? "error" : "success"} className="px-6 py-4" />
        </div>
      )}

      {/* METRİK EDİTÖRÜ MODAL */}
      {showMetricModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 pb-[env(safe-area-inset-bottom,0px)]">
          <div className="bg-[#121215] border border-white/5 rounded-t-[2rem] sm:rounded-[4rem] w-full max-w-2xl max-h-[92dvh] overflow-y-auto p-6 sm:p-10 md:p-16 relative shadow-[0_0_100px_rgba(124,58,237,0.1)] min-w-0">
            <button 
              type="button"
              onClick={() => setShowMetricModal(false)} 
              className="absolute top-4 right-4 sm:top-10 sm:right-10 z-10 min-h-11 min-w-11 flex items-center justify-center text-gray-500 sm:hover:text-white bg-white/5 rounded-full transition-all sm:hover:rotate-90 touch-manipulation"
              aria-label="Kapat"
            >
              <X size={24} aria-hidden />
            </button>
            
            <div className="mb-8 sm:mb-12 pr-12 min-w-0">
              <h2 className="text-2xl sm:text-4xl font-black italic uppercase tracking-tighter break-words">Metrik <span className="text-[#7c3aed]">Sistemi</span></h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.25em] sm:tracking-[0.4em] mt-2 sm:mt-3 italic break-words">Organizasyon Parametreleri</p>
            </div>

            <div className="space-y-3 sm:space-y-4 mb-8 sm:mb-12 max-h-[40vh] sm:max-h-[350px] overflow-y-auto pr-2 sm:pr-4 custom-scrollbar min-w-0 [-webkit-overflow-scrolling:touch]">
              {metrics.length === 0 && <p className="text-center text-gray-700 py-10 italic font-black uppercase text-xs">Henüz metrik tanımlanmadı</p>}
              {metrics.map(m => (
                <div key={m.id} className="flex justify-between items-center gap-3 bg-white/[0.03] p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border border-white/5 sm:hover:border-[#7c3aed]/30 transition-all group min-w-0">
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-black italic text-base sm:text-lg uppercase tracking-tight break-words">{m.name}</span>
                    <span className="text-[#7c3aed] font-bold text-[10px] uppercase tracking-widest break-all">Birim: {m.unit}</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => handleDeleteMetric(m.id)} 
                    className="shrink-0 min-h-11 min-w-11 sm:min-w-[3.25rem] flex items-center justify-center p-3 sm:p-4 bg-red-500/10 text-red-500 rounded-2xl sm:hover:bg-red-500 sm:hover:text-white transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 touch-manipulation"
                    aria-label="Metriği sil"
                  >
                    <Trash2 size={20} aria-hidden />
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-white/5 p-5 sm:p-10 rounded-[2rem] sm:rounded-[3.5rem] space-y-4 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 min-w-0">
                <input 
                  placeholder="METRİK ADI (Örn: 30m Sprint)" 
                  className="col-span-1 sm:col-span-2 min-h-11 bg-black border border-white/5 rounded-2xl p-4 sm:p-6 text-base sm:text-sm font-bold outline-none focus:border-[#7c3aed] text-white transition-all touch-manipulation"
                  value={newMetric.name} onChange={e => setNewMetric({...newMetric, name: e.target.value})}
                />
                <input 
                  placeholder="BİRİM (sn, cm, kg)" 
                  className="min-h-11 bg-black border border-white/5 rounded-2xl p-4 sm:p-6 text-base sm:text-sm font-bold outline-none focus:border-[#7c3aed] text-white transition-all touch-manipulation"
                  value={newMetric.unit} onChange={e => setNewMetric({...newMetric, unit: e.target.value})}
                />
                <button 
                  type="button"
                  onClick={handleAddMetric} 
                  className="min-h-11 bg-[#7c3aed] text-white font-black italic rounded-2xl p-4 sm:p-6 uppercase text-[11px] tracking-widest sm:hover:bg-[#6d28d9] transition-all shadow-xl shadow-[#7c3aed]/20 touch-manipulation"
                >
                  YENİ METRİK EKLE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}