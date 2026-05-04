"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Trophy,
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
  listAthleticResultNotesByDate,
  listFieldTestDefinitionsForActor,
  saveFieldTestDefinitionOrder,
  saveAthleticFieldResults,
  updateFieldTestDefinition,
  type AthleticResultCell,
  type MetricValueType,
} from "@/lib/actions/athleticFieldActions";
import type { AthleticResultRow, ProfileBasic, TestDefinitionRow } from "@/types/domain";
import Notification from "@/components/Notification";
import EmptyStateCard from "@/components/EmptyStateCard";
import { useUnsavedChangesGuard } from "@/lib/hooks/useUnsavedChangesGuard";
import { isTextMetricValueType, normalizeMetricValueType } from "@/lib/fieldTests/metricValueType";

function metricIsText(m: TestDefinitionRow): boolean {
  const ext = m as TestDefinitionRow & { valueType?: unknown };
  return isTextMetricValueType(ext.value_type ?? ext.valueType);
}

export default function SahaTestleriFinal() {
  const performanceTabs = [
    { key: "yuk", label: "Yük Analizi", href: "/performans" },
    { key: "saha", label: "Saha Testleri", href: "/saha-testleri" },
    { key: "rapor", label: "İdman Raporu", href: "/idman-raporu" },
  ] as const;
  const [showMetricModal, setShowMetricModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [contextPulse, setContextPulse] = useState(false);
  
  const [metrics, setMetrics] = useState<TestDefinitionRow[]>([]); 
  const [players, setPlayers] = useState<ProfileBasic[]>([]); 
  const [testValues, setTestValues] = useState<Record<string, string | number>>({});
  const [generalNotes, setGeneralNotes] = useState<Record<string, string>>({});
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [globalDate, setGlobalDate] = useState(new Date().toISOString().split('T')[0]);
  const [newMetric, setNewMetric] = useState<{ name: string; unit: string; category: string; valueType: MetricValueType }>({
    name: "",
    unit: "",
    category: "Genel",
    valueType: "number",
  });
  const [orderingBusyMetricId, setOrderingBusyMetricId] = useState<string | null>(null);
  const [orderHighlightMetricId, setOrderHighlightMetricId] = useState<string | null>(null);
  const fetchRunRef = useRef(0);
  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const saveFeedbackRef = useRef(saveFeedback);

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
        setSaveMessage(defsRes.error ?? "Metrik listesi alınamadı.");
        setMetrics([]);
      } else {
        setMetrics(((defsRes.metrics || []) as unknown) as TestDefinitionRow[]);
      }

      // 2. Mevcut sonuçlar — server action (org + koç yetkisi)
      const playerIds = roster.map((p) => p.id);
      let existingResults: AthleticResultRow[] = [];
      let existingNotes: Record<string, string> = {};
      if (playerIds.length > 0) {
        const [res, notesRes] = await Promise.all([
          listAthleticResultsForActorByDate({
            profileIds: playerIds,
            testDate: globalDate,
          }),
          listAthleticResultNotesByDate({
            profileIds: playerIds,
            testDate: globalDate,
          }),
        ]);
        if (runId !== fetchRunRef.current) return;
        if ("error" in res) {
          setSaveMessage(res.error ?? "Sonuçlar alınamadı.");
        } else {
          existingResults = res.results;
        }
        if (!("error" in notesRes)) {
          existingNotes = (notesRes.notes || []).reduce<Record<string, string>>((acc, row) => {
            acc[row.profile_id] = row.note || "";
            return acc;
          }, {});
        }
      }
      if (runId !== fetchRunRef.current) return;

      setPlayers(roster);

      const resultsMap: Record<string, string | number> = {};
      existingResults.forEach((r) => {
        if (typeof r.value === "number" && Number.isFinite(r.value)) {
          resultsMap[`${r.profile_id}-${r.test_id}`] = r.value;
        } else if ((r.value_text || "").trim()) {
          resultsMap[`${r.profile_id}-${r.test_id}`] = r.value_text!.trim();
        }
      });
      if (saveFeedbackRef.current !== "dirty") {
        setTestValues(resultsMap);
        setGeneralNotes(existingNotes);
        setSaveFeedback("idle");
      }
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

  useEffect(() => {
    if (saveFeedback !== "saved") return;
    const timeout = window.setTimeout(() => {
      setSaveFeedback("idle");
    }, 1400);
    return () => window.clearTimeout(timeout);
  }, [saveFeedback]);

  useEffect(() => {
    saveFeedbackRef.current = saveFeedback;
  }, [saveFeedback]);

  useEffect(() => {
    setContextPulse(true);
    const timeout = window.setTimeout(() => setContextPulse(false), 260);
    return () => window.clearTimeout(timeout);
  }, [selectedPlayers.length, metrics.length, globalDate, saveFeedback]);

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
    fd.append("valueType", newMetric.valueType);
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
    setSaveMessage("Metrik başarıyla eklendi.");
    setNewMetric({ name: "", unit: "", category: "Genel", valueType: "number" });
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
    setSaveFeedback("dirty");
  };

  const handleGeneralNoteChange = (playerId: string, val: string) => {
    setGeneralNotes((prev) => ({ ...prev, [playerId]: val }));
    setSaveFeedback("dirty");
  };

  const moveMetric = async (metricId: string, direction: -1 | 1) => {
    if (orderingBusyMetricId) return;
    setOrderingBusyMetricId(metricId);
    setOrderHighlightMetricId(metricId);
    setMetrics((prev) => {
      const idx = prev.findIndex((m) => m.id === metricId);
      if (idx === -1) return prev;
      const nextIdx = idx + direction;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const clone = [...prev];
      const temp = clone[idx];
      clone[idx] = clone[nextIdx];
      clone[nextIdx] = temp;
      return clone;
    });

    const current = metrics.map((m) => m.id);
    const idx = current.findIndex((id) => id === metricId);
    const nextIdx = idx + direction;
    if (idx < 0 || nextIdx < 0 || nextIdx >= current.length) return;
    const nextOrder = [...current];
    const tmp = nextOrder[idx];
    nextOrder[idx] = nextOrder[nextIdx];
    nextOrder[nextIdx] = tmp;
    const res = await saveFieldTestDefinitionOrder({ orderedMetricIds: nextOrder });
    if ("error" in res) {
      setSaveMessage(res.error || "Metrik sırası kaydedilemedi.");
      setOrderingBusyMetricId(null);
      void fetchData();
      return;
    }
    window.setTimeout(() => {
      setOrderHighlightMetricId(null);
    }, 700);
    setOrderingBusyMetricId(null);
    void fetchData();
  };

  const handleMetricUpdate = async (metric: TestDefinitionRow, patch: Partial<TestDefinitionRow>) => {
    const payload = {
      testDefinitionId: metric.id,
      name: (patch.name ?? metric.name ?? "").toString(),
      unit: (patch.unit ?? metric.unit ?? "").toString(),
      category: (patch.category ?? metric.category ?? "Genel").toString(),
      valueType: normalizeMetricValueType(patch.value_type ?? metric.value_type ?? (metric as TestDefinitionRow & { valueType?: unknown }).valueType) as MetricValueType,
    };
    const res = await updateFieldTestDefinition(payload);
    if ("error" in res) {
      setSaveMessage(res.error || "Metrik güncellenemedi.");
      return;
    }
    setSaveMessage("Metrik güncellendi.");
    void fetchData();
  };

  const orderedCellKeys = useMemo(() => {
    const keys: string[] = [];
    selectedPlayers.forEach((playerId) => {
      metrics.forEach((metric) => {
        keys.push(`${playerId}-${metric.id}`);
      });
    });
    return keys;
  }, [selectedPlayers, metrics]);

  useEffect(() => {
    if (orderedCellKeys.length === 0) return;
    const timeout = window.setTimeout(() => {
      const first = cellRefs.current[orderedCellKeys[0]];
      if (first && document.activeElement !== first) {
        first.focus();
      }
    }, 80);
    return () => window.clearTimeout(timeout);
  }, [orderedCellKeys]);

  const focusSiblingCell = (currentKey: string, direction: 1 | -1) => {
    const index = orderedCellKeys.indexOf(currentKey);
    if (index === -1) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= orderedCellKeys.length) return;
    const nextInput = cellRefs.current[orderedCellKeys[nextIndex]];
    if (nextInput) {
      nextInput.focus();
      nextInput.select();
    }
  };

  const saveSelectedResults = async () => {
    if (selectedPlayers.length === 0) return;

    setSaveLoading(true);
    setSaveMessage(null);
    setSaveFeedback("saving");
    try {
      const cells: AthleticResultCell[] = [];
      for (const pId of selectedPlayers) {
        for (const m of metrics) {
          const key = `${pId}-${m.id}`;
          const raw = testValues[key];
          const str = typeof raw === "string" ? raw.trim() : raw;
          const valueType = metricIsText(m) ? "text" : "number";
          if (valueType === "number") {
            const numeric = str === "" || str === null || str === undefined ? null : Number(str);
            if (numeric !== null && Number.isNaN(numeric)) {
              setSaveMessage("Geçersiz sayısal değer.");
              setSaveFeedback("error");
              setSaveLoading(false);
              return;
            }
            cells.push({ profileId: pId, testId: m.id, valueNumber: numeric, valueText: null });
          } else {
            cells.push({
              profileId: pId,
              testId: m.id,
              valueNumber: null,
              valueText: str === "" || str === null || str === undefined ? null : String(str),
            });
          }
        }
      }

      const result = await saveAthleticFieldResults({
        testDate: globalDate,
        selectedProfileIds: selectedPlayers,
        cells,
        notes: selectedPlayers.map((profileId) => ({
          profileId,
          note: generalNotes[profileId]?.trim() || null,
        })),
      });

      if ("error" in result && result.error) {
        setSaveMessage(result.error);
        setSaveFeedback("error");
      } else {
        setSelectedPlayers([]);
        setSaveMessage("Sonuçlar başarıyla kaydedildi.");
        setSaveFeedback("saved");
        void fetchData();
      }
    } catch (err) {
      console.error(err);
      setSaveMessage("Kayıt sırasında beklenmedik bir hata oluştu.");
      setSaveFeedback("error");
    } finally {
      setSaveLoading(false);
    }
  };

  const contextStatus = (() => {
    if (saveFeedback === "saving") return { label: "Kaydediliyor...", tone: "text-amber-200 border-amber-500/30 bg-amber-500/10", dot: "bg-amber-400" };
    if (saveFeedback === "saved") return { label: "Kaydedildi", tone: "text-emerald-200 border-emerald-500/30 bg-emerald-500/10", dot: "bg-emerald-400" };
    if (saveFeedback === "error") return { label: "Kaydedilemedi", tone: "text-rose-200 border-rose-500/30 bg-rose-500/10", dot: "bg-rose-400" };
    if (saveFeedback === "dirty") return { label: "Kaydedilmemiş değişiklik var", tone: "text-amber-200 border-amber-500/30 bg-amber-500/10", dot: "bg-amber-400" };
    if (selectedPlayers.length === 0) return { label: "Sporcu seçimi bekleniyor", tone: "text-gray-300 border-white/15 bg-white/5", dot: "bg-gray-500" };
    return { label: "Değişiklik yok", tone: "text-gray-300 border-white/15 bg-white/5", dot: "bg-gray-500" };
  })();

  const hasUnsavedChanges = saveFeedback === "dirty";
  const canSave = selectedPlayers.length > 0 && hasUnsavedChanges && !saveLoading;
  useUnsavedChangesGuard({ enabled: hasUnsavedChanges });
  const handleDateChange = (nextDate: string) => {
    if (hasUnsavedChanges) {
      const ok = window.confirm("Kayıt edilmemiş değişiklikler var, devam etmek istiyor musunuz?");
      if (!ok) return;
    }
    setGlobalDate(nextDate);
  };


  const renderCellDisplayValue = (raw: string | number | undefined) => {
    if (raw === null || raw === undefined || raw === "") {
      return <span className="opacity-30 text-xs">—</span>;
    }
    const str = String(raw);
    if (!Number.isFinite(Number(str))) {
      return <span className="text-[11px] font-semibold normal-case">{str}</span>;
    }
    const [integerPart, decimalPart] = str.split(".");
    if (!decimalPart) return <span>{integerPart}</span>;
    return (
      <span>
        <span>{integerPart}</span>
        <span className="text-xs opacity-80">.{decimalPart}</span>
      </span>
    );
  };

  const hasSelectedData = useMemo(() => {
    if (selectedPlayers.length === 0 || metrics.length === 0) return false;
    for (const playerId of selectedPlayers) {
      for (const metric of metrics) {
        const value = testValues[`${playerId}-${metric.id}`];
        if (value !== undefined && value !== null && String(value).trim() !== "") {
          return true;
        }
      }
    }
    return false;
  }, [selectedPlayers, metrics, testValues]);

  if (loading && players.length === 0) return (
    <div className="min-h-[50dvh] px-4 flex flex-col items-center justify-center bg-black gap-4 min-w-0 overflow-x-hidden pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] text-center">
      <Loader2 className="w-10 h-10 text-[#7c3aed] animate-spin" aria-hidden />
      <p className="text-[10px] font-black uppercase italic tracking-wide sm:tracking-widest text-gray-500 break-words max-w-md">
        Saha testleri hazırlanıyor...
      </p>
    </div>
  );

  return (
    <div className="ui-page min-w-0 overflow-x-hidden pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      
      {/* HEADER */}
      <header className="flex flex-col gap-4 min-w-0">
        <div className="space-y-2 min-w-0">
          <h1 className="ui-h1 break-words">
            SAHA <span className="text-[#7c3aed]">YÖNETİMİ</span>
          </h1>
          <p className="text-[11px] font-bold text-gray-500">
            Sporcu seçin, tarih belirleyin, test verisi girin ve kaydedin.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="Performans alt gezinim">
          {performanceTabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={`inline-flex min-h-10 items-center rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-wide ${
                tab.href === "/saha-testleri"
                  ? "border-[#7c3aed]/40 bg-[#7c3aed]/10 text-[#c4b5fd]"
                  : "border-white/10 bg-white/[0.03] text-gray-300 hover:text-white"
              }`}
              aria-current={tab.href === "/saha-testleri" ? "page" : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="grid gap-2 rounded-2xl border border-white/10 bg-[#121215] p-2.5 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-[9px] font-black uppercase tracking-wider text-gray-500">Seçili tarih</p>
            <p className={`mt-1 text-xs font-black text-white transition ${contextPulse ? "scale-[1.02]" : "scale-100"}`}>{new Date(`${globalDate}T00:00:00`).toLocaleDateString("tr-TR")}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-[9px] font-black uppercase tracking-wider text-gray-500">Seçili sporcu</p>
            <p className={`mt-1 text-xs font-black text-white tabular-nums transition ${contextPulse ? "scale-[1.02]" : "scale-100"}`}>
              {selectedPlayers.length} sporcu seçili
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-[9px] font-black uppercase tracking-wider text-gray-500">Seçili metrik</p>
            <p className={`mt-1 text-xs font-black text-white tabular-nums transition ${contextPulse ? "scale-[1.02]" : "scale-100"}`}>{metrics.length} metrik aktif</p>
          </div>
          <div className={`rounded-xl border px-3 py-2 ${contextStatus.tone} transition-colors`}>
            <p className="text-[9px] font-black uppercase tracking-wider">Kayıt durumu</p>
            <p className="mt-1 inline-flex items-center gap-2 text-xs font-black">
              <span className={`h-2 w-2 rounded-full ${contextStatus.dot} ${saveFeedback === "saving" ? "animate-pulse" : ""}`} />
              {contextStatus.label}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-[#121215] p-2.5 sm:flex-row sm:items-end">
          <div className="flex-1 md:flex-none flex items-center gap-3 bg-black/20 border border-white/10 px-4 py-2 rounded-xl min-h-11 min-w-0">
            <Calendar size={16} className="text-[#7c3aed] shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-wider text-gray-500">Tarih</p>
              <input
                type="date"
                className="min-w-0 w-full bg-transparent text-[11px] font-black outline-none text-white cursor-pointer touch-manipulation"
                value={globalDate}
                onChange={(e) => handleDateChange(e.target.value)}
              />
            </div>
          </div>
          <p className="text-[10px] font-bold text-gray-500 sm:max-w-xs">
            Bu ekrandaki tüm girişler seçilen tarihe kaydedilir.
          </p>
          <Link
            href="/saha-testleri/genel-rapor"
            title="Takım analiz raporunu aç"
            className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-[10px] font-black uppercase tracking-wide text-gray-300 transition sm:hover:border-[#7c3aed]/35 sm:hover:text-[#c4b5fd]"
          >
            <Trophy size={14} className="text-[#7c3aed] shrink-0" aria-hidden /> Takım analiz raporu
          </Link>
          <button
            type="button"
            onClick={() => setShowMetricModal(true)}
            title="Metrik ayarlarını aç"
            className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-[10px] font-black uppercase tracking-wide text-gray-300 transition sm:hover:border-[#7c3aed]/35 sm:hover:text-[#c4b5fd]"
          >
            <Settings2 size={14} className="shrink-0" aria-hidden /> Metrikler
          </button>
          <button
            type="button"
            onClick={() => {
              if (selectedPlayers.length === 0) {
                setSaveMessage("Önce sporcu seçmelisiniz.");
                return;
              }
              void saveSelectedResults();
            }}
            disabled={!canSave}
            className={`min-h-11 flex-1 sm:flex-none px-5 py-3 rounded-xl font-black text-[10px] uppercase inline-flex items-center justify-center gap-2 transition-all shadow-xl touch-manipulation ${
              canSave
                ? "bg-[#7c3aed] sm:hover:bg-[#6d28d9] shadow-[#7c3aed]/20"
                : "bg-white/10 text-gray-500 shadow-none cursor-not-allowed"
            }`}
          >
            {saveLoading ? (
              <Loader2 className="animate-spin" size={18} aria-hidden />
            ) : saveFeedback === "saved" ? (
              <CheckCircle2 size={16} className="text-emerald-300" aria-hidden />
            ) : (
              <CheckCircle2 size={16} aria-hidden />
            )}
            {saveLoading ? "Kaydediliyor..." : "Değişiklikleri kaydet"}
          </button>
        </div>
      </header>

      {/* TABLO KONTEYNERI */}
      <div className="ui-card !p-0 overflow-hidden min-w-0">
        {metrics.length === 0 && (
          <div className="border-b border-white/10 bg-white/5 px-4 py-2.5">
            <p className="text-[11px] font-bold text-gray-300">Önce metrik ekleyin, ardından tabloya veri girişi yapabilirsiniz.</p>
          </div>
        )}
        {players.length > 0 && selectedPlayers.length === 0 && (
          <div className="border-b border-white/10 bg-[#7c3aed]/8 px-4 py-2.5">
            <p className="text-[11px] font-bold text-[#ddd6fe]">Sporcu seçerek veri girmeye başlayabilirsiniz.</p>
          </div>
        )}
        {selectedPlayers.length > 0 && metrics.length > 0 && !hasSelectedData && (
          <div className="border-b border-white/10 bg-emerald-500/8 px-4 py-2.5">
            <p className="text-[11px] font-bold text-emerald-100">Seçili sporcularda henüz test değeri yok. İlk değeri girerek başlayabilirsiniz.</p>
          </div>
        )}
        <p className="sm:hidden px-4 py-2 text-[9px] font-bold text-gray-500 uppercase tracking-wide border-b border-white/5">
          Tabloyu yatay kaydırarak tüm metrikleri görebilirsiniz.
        </p>
        <div className="overflow-x-auto [-webkit-overflow-scrolling:touch] overscroll-x-contain">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/5">
                <th className="p-4 w-[72px] text-center sticky left-0 bg-[#121215] z-30">
                  <input 
                    type="checkbox" 
                    className="w-6 h-6 rounded-xl border-white/10 bg-white/5 accent-[#7c3aed] cursor-pointer"
                    checked={selectedPlayers.length === players.length && players.length > 0}
                    onChange={selectAll}
                  />
                </th>
                <th className="p-4 sticky left-[72px] bg-[#121215] z-20 w-[250px]">
                  <span className="text-[10px] font-black text-gray-500 uppercase italic tracking-[0.3em]">Sporcu Kadrosu</span>
                </th>
                {metrics.map(m => (
                  <th key={m.id} className="p-4 text-center border-l border-white/5 min-w-[132px]">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-white font-black italic text-xs uppercase tracking-tighter">{m.name}</span>
                      <div className="px-3 py-1 bg-[#7c3aed]/10 rounded-full">
                        <span className="text-[#7c3aed] font-bold text-[9px] uppercase tracking-widest">
                          {metricIsText(m) ? "YAZILI NOT" : m.unit}
                        </span>
                      </div>
                    </div>
                  </th>
                ))}
                <th className="p-4 text-center border-l border-white/5 min-w-[220px]">
                  <span className="text-[10px] font-black text-gray-500 uppercase italic tracking-[0.2em]">Genel Not</span>
                </th>
                <th className="p-4 text-right sticky right-0 z-20 bg-[#121215] border-l border-white/5 shadow-[-20px_0_30px_-15px_rgba(0,0,0,0.5)]">
                  <span className="text-[10px] font-black text-gray-500 uppercase italic tracking-[0.3em]">İşlem</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {players.length === 0 && (
                <tr>
                  <td colSpan={metrics.length + 4} className="px-6 py-10 text-center">
                    <EmptyStateCard
                      title="Kayıt bulunamadı"
                      description="Saha testi girişi için uygun sporcu bulunamadı."
                      reason="Aktif sporcu listesi boş olabilir veya organizasyona henüz sporcu eklenmemiş olabilir."
                      primaryAction={{ label: "Sporcu ekle", href: "/sporcular/yeni" }}
                      secondaryAction={{ label: "Sporculara git", href: "/oyuncular" }}
                      compact
                    />
                  </td>
                </tr>
              )}
              {players.map(player => {
                const isSelected = selectedPlayers.includes(player.id);
                return (
                  <tr key={player.id} className={`h-[76px] transition-all duration-200 group ${isSelected ? 'bg-[#7c3aed]/12 ring-1 ring-inset ring-[#a78bfa]/45 shadow-[inset_0_0_0_1px_rgba(124,58,237,0.35)]' : 'sm:hover:bg-white/[0.02]'}`}>
                    <td className="p-4 text-center sticky left-0 bg-inherit z-30">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => togglePlayerSelection(player.id)}
                        className="w-6 h-6 rounded-xl border-white/10 bg-white/5 accent-[#7c3aed] cursor-pointer"
                      />
                    </td>
                    <td className="p-4 sticky left-[72px] bg-inherit z-20">
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
                      <td key={metric.id} className={`p-3 border-l border-white/5 transition-colors ${isSelected ? "sm:hover:bg-[#7c3aed]/8" : ""}`}>
                        {isSelected ? (
                          <div className="relative group/input">
                            {metricIsText(metric) ? (
                              <input
                                type="text"
                                inputMode="text"
                                autoComplete="off"
                                ref={(el) => {
                                  cellRefs.current[`${player.id}-${metric.id}`] = el;
                                }}
                                className="w-full min-w-0 rounded-xl border border-white/12 bg-gradient-to-b from-[#1a1a23] to-[#14141c] px-2.5 py-2 text-left text-xs font-bold text-white outline-none transition-all duration-150 touch-manipulation placeholder:text-gray-600 sm:hover:-translate-y-[1px] sm:hover:border-[#7c3aed]/45 sm:hover:shadow-[0_6px_16px_-10px_rgba(124,58,237,0.55)] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/25 focus:shadow-[0_0_0_4px_rgba(124,58,237,0.12)]"
                                placeholder="Not / yorum gir"
                                value={testValues[`${player.id}-${metric.id}`] || ""}
                                onChange={(e) => handleValueChange(player.id, metric.id, e.target.value)}
                              />
                            ) : (
                              <input
                                type="number"
                                step="0.01"
                                inputMode="decimal"
                                ref={(el) => {
                                  cellRefs.current[`${player.id}-${metric.id}`] = el;
                                }}
                                onKeyDown={(e) => {
                                  if (e.key !== "Enter") return;
                                  e.preventDefault();
                                  focusSiblingCell(`${player.id}-${metric.id}`, e.shiftKey ? -1 : 1);
                                }}
                                className="w-full min-w-0 rounded-xl border border-white/12 bg-gradient-to-b from-[#1a1a23] to-[#14141c] px-2.5 py-2 text-center text-sm font-black text-white outline-none transition-all duration-150 touch-manipulation placeholder:text-gray-600 sm:hover:-translate-y-[1px] sm:hover:border-[#7c3aed]/45 sm:hover:shadow-[0_6px_16px_-10px_rgba(124,58,237,0.55)] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/25 focus:shadow-[0_0_0_4px_rgba(124,58,237,0.12)]"
                                placeholder="Değer girin"
                                value={testValues[`${player.id}-${metric.id}`] || ""}
                                onChange={(e) => handleValueChange(player.id, metric.id, e.target.value)}
                              />
                            )}
                          </div>
                        ) : (
                          <div className={`text-center font-black text-lg tracking-tight transition-all ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                            {renderCellDisplayValue(testValues[`${player.id}-${metric.id}`])}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="p-3 border-l border-white/5">
                      {isSelected ? (
                        <textarea
                          className="w-full min-w-0 rounded-xl border border-white/12 bg-gradient-to-b from-[#1a1a23] to-[#14141c] px-2.5 py-2 text-left text-xs font-bold text-white outline-none transition-all duration-150 touch-manipulation placeholder:text-gray-600 focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/25"
                          placeholder="Genel test notu"
                          rows={2}
                          value={generalNotes[player.id] || ""}
                          onChange={(e) => handleGeneralNoteChange(player.id, e.target.value)}
                        />
                      ) : (
                        <p className="text-[11px] font-semibold text-gray-500">{generalNotes[player.id]?.trim() || "—"}</p>
                      )}
                    </td>
                    <td className="p-4 text-right sticky right-0 z-20 bg-inherit border-l border-white/5 shadow-[-20px_0_30px_-15px_rgba(0,0,0,0.5)]">
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
          <Notification message={saveMessage} variant={saveFeedback === "error" ? "error" : "success"} className="px-6 py-4" />
        </div>
      )}

      {/* METRİK EDİTÖRÜ MODAL */}
      {showMetricModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 pb-[env(safe-area-inset-bottom,0px)]">
          <div className="bg-[#121215] border border-white/10 rounded-t-[2rem] sm:rounded-[2rem] w-full max-w-xl max-h-[90dvh] overflow-y-auto p-5 sm:p-7 relative shadow-[0_0_60px_rgba(124,58,237,0.15)] min-w-0">
            <button 
              type="button"
              onClick={() => setShowMetricModal(false)} 
              className="absolute top-4 right-4 z-10 min-h-11 min-w-11 flex items-center justify-center text-gray-500 sm:hover:text-white bg-white/5 rounded-full transition-all sm:hover:rotate-90 touch-manipulation"
              aria-label="Kapat"
            >
              <X size={24} aria-hidden />
            </button>
            
            <div className="mb-5 pr-12 min-w-0">
              <h2 className="text-xl font-black uppercase tracking-tight break-words">Metrik ayarları</h2>
              <p className="text-[11px] text-gray-500 font-bold mt-1 break-words">Veri girişi için kullanılan metrikleri buradan yönetin.</p>
            </div>

            <div className="space-y-2 mb-6 max-h-[34vh] overflow-y-auto pr-1 custom-scrollbar min-w-0 [-webkit-overflow-scrolling:touch]">
              {metrics.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-center">
                  <p className="text-[11px] font-bold text-gray-500">Henüz metrik tanımlanmadı.</p>
                  <p className="mt-1 text-[10px] font-bold text-gray-600">İlk metriği aşağıdaki formdan ekleyin.</p>
                </div>
              )}
              {metrics.map((m, index) => {
                const isFirst = index === 0;
                const isLast = index === metrics.length - 1;
                const isBusy = orderingBusyMetricId === m.id;
                const isHighlighted = orderHighlightMetricId === m.id;
                return (
                <div
                  key={m.id}
                  className={`grid min-h-[82px] grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 rounded-xl border p-3 min-w-0 transition-all duration-200 ease-out group ${
                    isHighlighted
                      ? "border-[#a78bfa]/70 bg-[#7c3aed]/15 ring-2 ring-[#7c3aed]/50 shadow-[0_0_0_1px_rgba(124,58,237,0.5),0_8px_24px_-14px_rgba(124,58,237,0.9)]"
                      : "border-white/10 bg-white/[0.03] sm:hover:border-[#7c3aed]/35 sm:hover:bg-white/[0.05] sm:hover:shadow-[0_8px_24px_-16px_rgba(124,58,237,0.55)]"
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-black/30 text-[11px] font-black text-[#c4b5fd]">
                    {index + 1}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-black text-sm uppercase tracking-tight break-words text-white">{m.name}</span>
                    <span className="text-[#c4b5fd] font-bold text-[10px] uppercase tracking-wide break-all">
                      Tip: {metricIsText(m) ? "Yazılı Not" : "Sayısal Değer"} · Birim: {m.unit || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 self-stretch">
                    <button
                      type="button"
                      onClick={() => void moveMetric(m.id, -1)}
                      disabled={isFirst || Boolean(orderingBusyMetricId)}
                      className={`min-h-10 rounded-lg border px-2 text-[10px] font-black uppercase tracking-wide transition ${
                        isFirst || orderingBusyMetricId
                          ? "cursor-not-allowed border-white/10 bg-white/[0.02] text-gray-600 opacity-60"
                          : "border-white/15 bg-white/5 text-gray-300 sm:hover:border-[#7c3aed]/35 sm:hover:text-white"
                      }`}
                    >
                      Yukarı
                    </button>
                    <button
                      type="button"
                      onClick={() => void moveMetric(m.id, 1)}
                      disabled={isLast || Boolean(orderingBusyMetricId)}
                      className={`min-h-10 rounded-lg border px-2 text-[10px] font-black uppercase tracking-wide transition ${
                        isLast || orderingBusyMetricId
                          ? "cursor-not-allowed border-white/10 bg-white/[0.02] text-gray-600 opacity-60"
                          : "border-white/15 bg-white/5 text-gray-300 sm:hover:border-[#7c3aed]/35 sm:hover:text-white"
                      }`}
                    >
                      {isBusy ? "..." : "Aşağı"}
                    </button>
                  </div>
                  <select
                    value={metricIsText(m) ? "text" : "number"}
                    onChange={(e) => void handleMetricUpdate(m, { value_type: e.target.value as MetricValueType })}
                    className="ui-select min-h-10 w-36"
                  >
                    <option value="number">Sayısal Değer</option>
                    <option value="text">Yazılı Not</option>
                  </select>
                  <button 
                    type="button"
                    onClick={() => handleDeleteMetric(m.id)} 
                    className="shrink-0 min-h-10 min-w-10 flex items-center justify-center p-2.5 bg-red-500/10 text-red-400 rounded-xl sm:hover:bg-red-500 sm:hover:text-white transition-all touch-manipulation"
                    aria-label="Metriği sil"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              )})}
            </div>

            <div className="bg-white/5 p-4 rounded-xl space-y-3 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                <input 
                  placeholder="Metrik adı (örn. 30m Sprint)" 
                  className="col-span-1 sm:col-span-2 min-h-11 bg-black border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[#7c3aed] text-white transition-all touch-manipulation"
                  value={newMetric.name} onChange={e => setNewMetric({...newMetric, name: e.target.value})}
                />
                <input 
                  placeholder={newMetric.valueType === "text" ? "Birim (opsiyonel)" : "Birim (sn, cm, kg)"} 
                  className="min-h-11 bg-black border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[#7c3aed] text-white transition-all touch-manipulation"
                  value={newMetric.unit} onChange={e => setNewMetric({...newMetric, unit: e.target.value})}
                />
                <select
                  className="min-h-11 bg-black border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[#7c3aed] text-white transition-all touch-manipulation"
                  value={newMetric.valueType}
                  onChange={(e) => setNewMetric({ ...newMetric, valueType: e.target.value as MetricValueType })}
                >
                  <option value="number">Sayısal Değer</option>
                  <option value="text">Yazılı Not / Gözlem</option>
                </select>
                <button 
                  type="button"
                  onClick={handleAddMetric} 
                  className="min-h-11 bg-[#7c3aed] text-white font-black rounded-xl px-4 py-3 uppercase text-[10px] tracking-wide sm:hover:bg-[#6d28d9] transition-all shadow-xl shadow-[#7c3aed]/20 touch-manipulation"
                >
                  Metrik ekle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}