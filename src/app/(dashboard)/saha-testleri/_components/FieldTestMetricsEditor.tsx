"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronLeft, GripVertical, Loader2, Trash2 } from "lucide-react";
import { FieldTestSessionSubNav } from "./FieldTestSessionSubNav";
import {
  createFieldTestDefinition,
  deleteFieldTestDefinition,
  listFieldTestDefinitionsForActor,
  saveFieldTestDefinitionOrder,
  updateFieldTestDefinition,
  type MetricValueType,
} from "@/lib/actions/athleticFieldActions";
import type { TestDefinitionRow } from "@/types/domain";
import Notification from "@/components/Notification";
import EmptyState from "@/components/ui/EmptyState";
import { InlineErrorState } from "@/components/ui/data-display/InlineErrorState";
import { isTextMetricValueType, normalizeMetricValueType } from "@/lib/fieldTests/metricValueType";

const performanceTabs = [
  { key: "yuk", label: "Yük Analizi", href: "/performans" },
  { key: "saha", label: "Saha Testleri", href: "/saha-testleri" },
  { key: "rapor", label: "İdman Raporu", href: "/idman-raporu" },
] as const;

function metricIsText(m: TestDefinitionRow): boolean {
  const ext = m as TestDefinitionRow & { valueType?: unknown };
  return isTextMetricValueType(ext.value_type ?? ext.valueType);
}

type SortableMetricRowProps = {
  metric: TestDefinitionRow;
  index: number;
  orderingBusy: boolean;
  orderHighlightMetricId: string | null;
  onUpdate: (metric: TestDefinitionRow, patch: Partial<TestDefinitionRow>) => void;
  onDelete: (id: string) => void;
};

function SortableMetricRow({
  metric: m,
  index,
  orderingBusy,
  orderHighlightMetricId,
  onUpdate,
  onDelete,
}: SortableMetricRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: m.id,
    disabled: orderingBusy,
  });

  const isHighlighted = orderHighlightMetricId === m.id;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col gap-3 rounded-xl border p-3 min-w-0 transition-[box-shadow,background-color,border-color] duration-200 ease-out group md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-x-3 md:gap-y-2 ${
        isDragging
          ? "z-10 border-[#a78bfa]/80 bg-[#7c3aed]/20 shadow-[0_12px_32px_-12px_rgba(124,58,237,0.85)]"
          : isHighlighted
            ? "border-[#a78bfa]/70 bg-[#7c3aed]/15 ring-2 ring-[#7c3aed]/50 shadow-[0_0_0_1px_rgba(124,58,237,0.5),0_8px_24px_-14px_rgba(124,58,237,0.9)]"
            : "border-white/10 bg-white/[0.03] sm:hover:border-[#7c3aed]/35 sm:hover:bg-white/[0.05] sm:hover:shadow-[0_8px_24px_-16px_rgba(124,58,237,0.55)]"
      }`}
    >
      <div className="flex items-start gap-3 min-w-0 md:col-span-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          className={`flex h-8 w-8 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-white/15 bg-black/30 text-gray-400 transition sm:hover:border-[#7c3aed]/40 sm:hover:text-[#c4b5fd] ${
            orderingBusy ? "cursor-not-allowed opacity-50" : "cursor-grab active:cursor-grabbing"
          }`}
          aria-label={`${m.name} metriğini sürükleyerek sırala`}
          disabled={orderingBusy}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} aria-hidden />
        </button>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-black/30 text-[11px] font-black text-[#c4b5fd]">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <span className="font-black text-sm uppercase tracking-tight line-clamp-2 break-words text-white">
            {m.name}
          </span>
          <span className="text-[#c4b5fd] font-bold text-[10px] uppercase tracking-wide break-words">
            Tip: {metricIsText(m) ? "Yazılı Not" : "Sayısal Değer"} · Birim: {m.unit || "—"}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2 min-w-0 w-full md:col-span-1">
        <div className="flex flex-col gap-2 min-w-0 sm:flex-row sm:flex-wrap sm:items-center">
          <select
            value={metricIsText(m) ? "text" : "number"}
            onChange={(e) => void onUpdate(m, { value_type: e.target.value as MetricValueType })}
            className="ui-select min-h-10 w-full min-w-0 sm:max-w-[11.5rem] sm:flex-1"
            disabled={orderingBusy}
          >
            <option value="number">Sayısal Değer</option>
            <option value="text">Yazılı Not</option>
          </select>
          {!metricIsText(m) ? (
            <select
              value={(m.improvement_direction ?? "unknown") as string}
              onChange={(e) =>
                void onUpdate(m, {
                  improvement_direction: e.target.value as "higher_better" | "lower_better" | "unknown",
                })
              }
              className="ui-select min-h-10 w-full min-w-0 sm:max-w-[13rem] sm:flex-1"
              title="Bu metrikte iyileşme hangi yönde? (yüksek değer iyi vs. düşük değer iyi)"
              disabled={orderingBusy}
            >
              <option value="unknown">Yön: belirsiz</option>
              <option value="higher_better">↑ Yüksek daha iyi</option>
              <option value="lower_better">↓ Düşük daha iyi</option>
            </select>
          ) : null}
          <button
            type="button"
            onClick={() => void onDelete(m.id)}
            disabled={orderingBusy}
            className="shrink-0 min-h-10 min-w-10 self-end sm:self-auto flex items-center justify-center p-2.5 bg-red-500/10 text-red-400 rounded-xl sm:hover:bg-red-500 sm:hover:text-white transition-all touch-manipulation disabled:opacity-50"
            aria-label="Metriği sil"
          >
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

export function FieldTestMetricsEditor() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<TestDefinitionRow[]>([]);
  const [newMetric, setNewMetric] = useState<{
    name: string;
    unit: string;
    category: string;
    valueType: MetricValueType;
    improvementDirection: "higher_better" | "lower_better" | "unknown";
  }>({
    name: "",
    unit: "",
    category: "Genel",
    valueType: "number",
    improvementDirection: "unknown",
  });
  const [orderingBusy, setOrderingBusy] = useState(false);
  const [orderHighlightMetricId, setOrderHighlightMetricId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await listFieldTestDefinitionsForActor();
      if ("error" in res) {
        setMetrics([]);
        setLoadError(res.error ?? "Metrik listesi alınamadı.");
        return;
      }
      setMetrics(((res.metrics || []) as unknown) as TestDefinitionRow[]);
    } catch {
      setMetrics([]);
      setLoadError("Metrik listesi alınamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  const handleAddMetric = async () => {
    if (!newMetric.name.trim()) return;
    const fd = new FormData();
    fd.append("name", newMetric.name);
    fd.append("unit", newMetric.unit);
    fd.append("category", newMetric.category || "Genel");
    fd.append("valueType", newMetric.valueType);
    fd.append("improvementDirection", newMetric.improvementDirection);
    const result = await createFieldTestDefinition(fd);
    if ("error" in result && result.error) {
      setSaveMessage(result.error);
      return;
    }
    setSaveMessage("Metrik başarıyla eklendi.");
    setNewMetric({ name: "", unit: "", category: "Genel", valueType: "number", improvementDirection: "unknown" });
    void fetchMetrics();
  };

  const handleDeleteMetric = async (id: string) => {
    if (!confirm("Bu metrik silindiğinde tüm sporcu sonuçları da silinecektir. Onaylıyor musunuz?")) return;
    const result = await deleteFieldTestDefinition(id);
    if ("error" in result && result.error) {
      setSaveMessage(result.error);
      return;
    }
    setSaveMessage("Metrik silindi.");
    void fetchMetrics();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || orderingBusy) return;

    const oldIndex = metrics.findIndex((m) => m.id === active.id);
    const newIndex = metrics.findIndex((m) => m.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(metrics, oldIndex, newIndex);
    const orderedMetricIds = reordered.map((m) => m.id);
    const movedId = String(active.id);

    setMetrics(reordered);
    setOrderingBusy(true);
    setOrderHighlightMetricId(movedId);

    const res = await saveFieldTestDefinitionOrder({ orderedMetricIds });
    if ("error" in res) {
      setSaveMessage(res.error || "Metrik sırası kaydedilemedi.");
      setOrderingBusy(false);
      setOrderHighlightMetricId(null);
      void fetchMetrics();
      return;
    }

    window.setTimeout(() => setOrderHighlightMetricId(null), 700);
    setOrderingBusy(false);
  };

  const handleMetricUpdate = async (metric: TestDefinitionRow, patch: Partial<TestDefinitionRow>) => {
    const nextDirection =
      (patch.improvement_direction ?? metric.improvement_direction ?? "unknown") as
        | "higher_better"
        | "lower_better"
        | "unknown";
    const payload = {
      testDefinitionId: metric.id,
      name: (patch.name ?? metric.name ?? "").toString(),
      unit: (patch.unit ?? metric.unit ?? "").toString(),
      category: (patch.category ?? metric.category ?? "Genel").toString(),
      valueType: normalizeMetricValueType(
        patch.value_type ?? metric.value_type ?? (metric as TestDefinitionRow & { valueType?: unknown }).valueType
      ) as MetricValueType,
      improvementDirection: nextDirection,
    };
    const res = await updateFieldTestDefinition(payload);
    if ("error" in res) {
      setSaveMessage(res.error || "Metrik güncellenemedi.");
      return;
    }
    setSaveMessage("Metrik güncellendi.");
    void fetchMetrics();
  };

  if (loading && metrics.length === 0 && !loadError) {
    return (
      <div className="min-h-[50dvh] px-4 flex flex-col items-center justify-center bg-black gap-4 min-w-0 overflow-x-hidden pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] text-center">
        <Loader2 className="w-10 h-10 text-[#7c3aed] animate-spin" aria-hidden />
        <p className="text-[10px] font-black uppercase italic tracking-wide sm:tracking-widest text-gray-500 break-words max-w-md">
          Metrikler yükleniyor...
        </p>
      </div>
    );
  }

  return (
    <div className="ui-page min-w-0 overflow-x-hidden pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex flex-col gap-4 min-w-0">
        <div className="space-y-2 min-w-0">
          <Link
            href="/saha-testleri"
            className="inline-flex min-h-10 items-center gap-2 text-[10px] font-black uppercase tracking-wider text-gray-500 transition sm:hover:text-[#c4b5fd]"
          >
            <ChevronLeft size={14} aria-hidden />
            Saha testleri
          </Link>
          <h1 className="ui-h1 break-words">
            SAHA TEST <span className="text-[#7c3aed]">METRİKLERİ</span>
          </h1>
          <p className="text-[11px] font-bold text-gray-500">
            Veri girişinde kullanılan metrikleri tanımlayın, sürükleyerek sıralayın ve düzenleyin.
          </p>
        </div>

        <nav className="flex flex-wrap gap-2" aria-label="Performans alt gezinim">
          {performanceTabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={`inline-flex min-h-10 items-center rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-wide ${
                tab.key === "saha"
                  ? "border-[#7c3aed]/40 bg-[#7c3aed]/10 text-[#c4b5fd]"
                  : "border-white/10 bg-white/[0.03] text-gray-300 hover:text-white"
              }`}
              aria-current={tab.key === "saha" ? "page" : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <FieldTestSessionSubNav />
      </header>

      {loadError ? (
        <div className="mt-4 min-w-0">
          <InlineErrorState
            errorKind="fetch_error"
            title="Metrik listesi yüklenemedi"
            description={loadError}
            onRetry={() => void fetchMetrics()}
          />
        </div>
      ) : null}

      {saveMessage ? (
        <div className="mt-4 min-w-0 break-words">
          <Notification message={saveMessage} variant="success" className="px-6 py-4" />
        </div>
      ) : null}

      <section className="mt-6 min-w-0 space-y-4">
        <div className="rounded-2xl border border-white/10 bg-[#121215] p-4 sm:p-5 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Tanımlı metrikler</h2>
            {metrics.length > 1 ? (
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
                {orderingBusy ? "Sıra kaydediliyor…" : "Sıralamak için sol tutamacı sürükleyin"}
              </p>
            ) : null}
          </div>
          <div className="mt-4 space-y-2 min-w-0">
            {metrics.length === 0 ? (
              <EmptyState
                variant="onboarding"
                title="İlk saha testi metriğini tanımla"
                description="Henüz metrik yok. Aşağıdaki formdan ilk metriği oluşturun."
                reason="Hız, dayanıklılık veya ağırlık gibi sayısal/metin metrikleri tanımlayarak veri toplamaya başlayabilirsiniz."
                compact
              />
            ) : null}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(e)}>
              <SortableContext items={metrics.map((m) => m.id)} strategy={verticalListSortingStrategy}>
                {metrics.map((m, index) => (
                  <SortableMetricRow
                    key={m.id}
                    metric={m}
                    index={index}
                    orderingBusy={orderingBusy}
                    orderHighlightMetricId={orderHighlightMetricId}
                    onUpdate={(metric, patch) => void handleMetricUpdate(metric, patch)}
                    onDelete={(id) => void handleDeleteMetric(id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#121215] p-4 sm:p-5 min-w-0">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Yeni metrik ekle</h2>
          <div className="mt-4 bg-white/5 p-4 rounded-xl space-y-3 min-w-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-w-0">
              <input
                placeholder="Metrik adı (örn. 30m Sprint)"
                className="col-span-1 sm:col-span-2 min-h-11 bg-black border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[#7c3aed] text-white transition-all touch-manipulation"
                value={newMetric.name}
                onChange={(e) => setNewMetric({ ...newMetric, name: e.target.value })}
              />
              <input
                placeholder={newMetric.valueType === "text" ? "Birim (opsiyonel)" : "Birim (sn, cm, kg)"}
                className="min-h-11 bg-black border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[#7c3aed] text-white transition-all touch-manipulation"
                value={newMetric.unit}
                onChange={(e) => setNewMetric({ ...newMetric, unit: e.target.value })}
              />
              <select
                className="min-h-11 bg-black border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[#7c3aed] text-white transition-all touch-manipulation"
                value={newMetric.valueType}
                onChange={(e) => setNewMetric({ ...newMetric, valueType: e.target.value as MetricValueType })}
              >
                <option value="number">Sayısal Değer</option>
                <option value="text">Yazılı Not / Gözlem</option>
              </select>
              {newMetric.valueType === "number" ? (
                <select
                  className="min-h-11 bg-black border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[#7c3aed] text-white transition-all touch-manipulation"
                  value={newMetric.improvementDirection}
                  onChange={(e) =>
                    setNewMetric({
                      ...newMetric,
                      improvementDirection: e.target.value as "higher_better" | "lower_better" | "unknown",
                    })
                  }
                  title="Bu metrikte iyileşme hangi yönde?"
                >
                  <option value="unknown">Gelişim yönü: belirsiz</option>
                  <option value="higher_better">↑ Yüksek değer daha iyi</option>
                  <option value="lower_better">↓ Düşük değer daha iyi</option>
                </select>
              ) : (
                <div className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-[11px] font-medium text-gray-500">
                  Yazılı metrikler trend analizine girmez.
                </div>
              )}
              <button
                type="button"
                onClick={() => void handleAddMetric()}
                className="min-h-11 bg-[#7c3aed] text-white font-black rounded-xl px-4 py-3 uppercase text-[10px] tracking-wide sm:hover:bg-[#6d28d9] transition-all shadow-xl shadow-[#7c3aed]/20 touch-manipulation"
              >
                Metrik ekle
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
