"use client";

import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";
import { useMemo, useState } from "react";
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, Ruler, Scale, TrendingUp } from "lucide-react";
import Notification from "@/components/Notification";
import { AthleteEmptyState } from "@/components/athlete/AthleteEmptyState";
import { AthleteCard } from "@/components/athlete/AthleteCard";
import type { AthleteBodyMeasurementRow } from "@/lib/athlete/bodyMeasurement";
import {
  recordAthleteBodyMeasurementForManagement,
  recordMyBodyMeasurement,
} from "@/lib/actions/athleteBodyMeasurementActions";
import { todayDateKeyUtc } from "@/lib/athlete/bodyMeasurement";
import { DataTable, uiTableRowHoverClass, uiTableTdClass, uiTableThClass } from "@/components/ui/data-display";
import { chartTooltipStyle } from "@/components/ui/charts";

type AthleteBodyMeasurementSectionProps = {
  mode: "self" | "management";
  athleteId?: string;
  canRecord: boolean;
  measurements: AthleteBodyMeasurementRow[];
  currentHeight?: number | null;
  currentWeight?: number | null;
  onRecorded?: () => void;
};

function formatDateLabel(isoDate: string) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatShortDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
  });
}

export function AthleteBodyMeasurementSection({
  mode,
  athleteId,
  canRecord,
  measurements,
  currentHeight,
  currentWeight,
  onRecorded,
}: AthleteBodyMeasurementSectionProps) {
  const [measurementDate, setMeasurementDate] = useState(todayDateKeyUtc());
  const [height, setHeight] = useState(currentHeight != null ? String(currentHeight) : "");
  const [weight, setWeight] = useState(currentWeight != null ? String(currentWeight) : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [view, setView] = useState<"grafik" | "tablo">("tablo");

  const chartData = useMemo(
    () =>
      measurements.map((m) => ({
        tarih: formatShortDate(m.measurement_date),
        boy: m.height ?? undefined,
        kilo: m.weight ?? undefined,
      })),
    [measurements]
  );

  const latest = measurements.length > 0 ? measurements[measurements.length - 1] : null;
  const displayHeight = latest?.height ?? currentHeight ?? null;
  const displayWeight = latest?.weight ?? currentWeight ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canRecord || busy) return;
    setBusy(true);
    setMessage(null);

    const payload = {
      measurementDate,
      height: height.trim() || null,
      weight: weight.trim() || null,
      note: note.trim() || null,
    };

    const result =
      mode === "self"
        ? await recordMyBodyMeasurement(payload)
        : athleteId
          ? await recordAthleteBodyMeasurementForManagement(athleteId, payload)
          : { error: "Sporcu kimligi eksik." };

    setBusy(false);
    if ("error" in result && result.error) {
      setMessage(result.error);
      return;
    }
    setMessage("Olçüm kaydedildi.");
    setNote("");
    onRecorded?.();
  }

  return (
    <AthleteCard className="shadow-lg" padding="sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className={`${uiBrandingClasses.kpi.chipBrand} shrink-0 rounded-xl p-2 text-[color:var(--peaker-ui-PRIMARY)]`}>
            <TrendingUp size={18} aria-hidden />
          </div>
          <div>
            <h3 className="break-words text-sm font-black uppercase italic tracking-tight text-white">
              Boy / Kilo <span className="text-[color:var(--peaker-ui-PRIMARY)]">Takibi</span>
            </h3>
            <p className="text-[10px] font-bold text-gray-500">
              Periyodik ölçümlerle gelişim eğrisi oluşturun (Hylyght/RYPT tarzı).
            </p>
          </div>
        </div>
        <div className="flex gap-2 text-[10px] font-black uppercase">
          <button
            type="button"
            onClick={() => setView("grafik")}
            className={`${uiBrandingClasses.navigation.tabsNavTab} min-h-9 rounded-lg px-3 py-2 ${view === "grafik" ? uiBrandingClasses.navigation.tabsNavTabActive : "ui-tabs-nav__tab--inactive text-gray-400"}`}
          >
            Grafik
          </button>
          <button
            type="button"
            onClick={() => setView("tablo")}
            className={`${uiBrandingClasses.navigation.tabsNavTab} min-h-9 rounded-lg px-3 py-2 ${view === "tablo" ? uiBrandingClasses.navigation.tabsNavTabActive : "ui-tabs-nav__tab--inactive text-gray-400"}`}
          >
            Tablo
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className={`${uiBrandingClasses.kpi.card} rounded-xl p-3 text-center`}>
          <p className="mb-1 flex items-center justify-center gap-1 text-[9px] font-black uppercase text-gray-500">
            <Ruler size={12} aria-hidden /> Güncel boy
          </p>
          <p className="text-xl font-black tabular-nums text-white">{displayHeight ?? "—"}</p>
          <p className="text-[10px] font-bold text-gray-600">cm</p>
        </div>
        <div className={`${uiBrandingClasses.kpi.card} rounded-xl p-3 text-center`}>
          <p className="mb-1 flex items-center justify-center gap-1 text-[9px] font-black uppercase text-gray-500">
            <Scale size={12} aria-hidden /> Güncel kilo
          </p>
          <p className="text-xl font-black tabular-nums text-white">{displayWeight ?? "—"}</p>
          <p className="text-[10px] font-bold text-gray-600">kg</p>
        </div>
      </div>

      {canRecord ? (
        <form onSubmit={(e) => void handleSubmit(e)} className={`${uiBrandingClasses.card.inner} mb-5 rounded-2xl p-4`}>
          <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-gray-500">Yeni ölçüm kaydı</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase text-gray-600">Tarih</span>
              <input
                type="date"
                value={measurementDate}
                onChange={(e) => setMeasurementDate(e.target.value)}
                className="min-h-11 ui-input px-3 text-sm font-bold text-white outline-none focus:border-[color:var(--peaker-ui-PRIMARY)]"
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase text-gray-600">Boy (cm)</span>
              <input
                type="number"
                min={50}
                max={260}
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="örn. 178"
                className="min-h-11 ui-input px-3 text-sm font-bold text-white outline-none focus:border-[color:var(--peaker-ui-PRIMARY)]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase text-gray-600">Kilo (kg)</span>
              <input
                type="number"
                min={20}
                max={300}
                step={0.1}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="örn. 72.5"
                className="min-h-11 ui-input px-3 text-sm font-bold text-white outline-none focus:border-[color:var(--peaker-ui-PRIMARY)]"
              />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
              <span className="text-[9px] font-black uppercase text-gray-600">Not (opsiyonel)</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Sabah aç karnına"
                className="min-h-11 ui-input px-3 text-sm font-bold text-white outline-none focus:border-[color:var(--peaker-ui-PRIMARY)]"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 rounded-xl bg-[color:var(--peaker-ui-PRIMARY)] px-5 text-[10px] font-black uppercase tracking-wide text-white disabled:opacity-60"
            >
              {busy ? <Loader2 className="mx-auto animate-spin" size={16} aria-hidden /> : "Olçümü kaydet"}
            </button>
            <p className="text-[10px] font-bold text-gray-600">Aynı gün tekrar kayıt mevcut satırı günceller.</p>
          </div>
        </form>
      ) : (
        <p className="mb-4 text-[10px] font-bold uppercase text-gray-600">Bu ekranda yalnizca goruntuleme yetkiniz var.</p>
      )}

      {message ? (
        <div className="mb-4">
          <Notification
            message={message}
            variant={message.toLowerCase().includes("kaydedilemedi") || message.toLowerCase().includes("geçersiz") ? "error" : "success"}
          />
        </div>
      ) : null}

      {measurements.length === 0 ? (
        <AthleteEmptyState
          compact
          title="Henüz ölçüm geçmişi yok"
          description="İlk boy/kilo kaydını eklediğinizde trend grafiği ve geçmiş tablosu burada oluşur."
          hint="Akademi yazılımlarında (Hylyght, RYPT) 4–8 haftada bir ölçüm önerilir."
        />
      ) : view === "tablo" ? (
        <DataTable
          className="rounded-2xl"
          scrollClassName=""
          tableClassName="w-full min-w-[320px] text-left text-sm"
          headClassName="ui-table-head ui-table-head--divided text-[9px] font-black uppercase"
          head={
            <tr>
              <th className={`${uiTableThClass} px-4 py-3`}>Tarih</th>
              <th className={`${uiTableThClass} px-4 py-3`}>Boy (cm)</th>
              <th className={`${uiTableThClass} px-4 py-3`}>Kilo (kg)</th>
              <th className={`${uiTableThClass} px-4 py-3`}>Not</th>
            </tr>
          }
        >
          {[...measurements].reverse().map((m) => (
            <tr key={m.id} className={`${uiTableRowHoverClass} text-white`}>
              <td className={`${uiTableTdClass} px-4 py-3 font-bold`}>{formatDateLabel(m.measurement_date)}</td>
              <td className={`${uiTableTdClass} px-4 py-3 tabular-nums`}>{m.height ?? "—"}</td>
              <td className={`${uiTableTdClass} px-4 py-3 tabular-nums`}>{m.weight ?? "—"}</td>
              <td className={`${uiTableTdClass} px-4 py-3 text-gray-400`}>{m.note || "—"}</td>
            </tr>
          ))}
        </DataTable>
      ) : (
        <div className="ui-chart-shell ui-chart-shell--passive h-[min(50vw,16rem)] min-h-[200px] w-full min-w-0 sm:h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ left: -12, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="tarih" stroke="#6b7280" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
              <YAxis yAxisId="boy" orientation="left" stroke="#a78bfa" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
              <YAxis yAxisId="kilo" orientation="right" stroke="#34d399" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={chartTooltipStyle.contentStyle}
                itemStyle={chartTooltipStyle.itemStyle}
                labelStyle={chartTooltipStyle.labelStyle}
                formatter={(value, name) => [value ?? "—", name === "boy" ? "Boy (cm)" : "Kilo (kg)"]}
              />
              <Line yAxisId="boy" type="monotone" dataKey="boy" stroke="#a78bfa" strokeWidth={2.5} dot={{ r: 4 }} connectNulls name="boy" />
              <Line yAxisId="kilo" type="monotone" dataKey="kilo" stroke="#34d399" strokeWidth={2.5} dot={{ r: 4 }} connectNulls name="kilo" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </AthleteCard>
  );
}
