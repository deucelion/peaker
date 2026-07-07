"use client";

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
          <div className="shrink-0 rounded-xl bg-[#7c3aed]/10 p-2 text-[#7c3aed]">
            <TrendingUp size={18} aria-hidden />
          </div>
          <div>
            <h3 className="break-words text-sm font-black uppercase italic tracking-tight text-white">
              Boy / Kilo <span className="text-[#7c3aed]">Takibi</span>
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
            className={`min-h-9 rounded-lg border px-3 py-2 ${view === "grafik" ? "border-[#7c3aed]/40 bg-[#7c3aed]/10 text-[#c4b5fd]" : "border-white/10 text-gray-400"}`}
          >
            Grafik
          </button>
          <button
            type="button"
            onClick={() => setView("tablo")}
            className={`min-h-9 rounded-lg border px-3 py-2 ${view === "tablo" ? "border-[#7c3aed]/40 bg-[#7c3aed]/10 text-[#c4b5fd]" : "border-white/10 text-gray-400"}`}
          >
            Tablo
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
          <p className="mb-1 flex items-center justify-center gap-1 text-[9px] font-black uppercase text-gray-500">
            <Ruler size={12} aria-hidden /> Güncel boy
          </p>
          <p className="text-xl font-black tabular-nums text-white">{displayHeight ?? "—"}</p>
          <p className="text-[10px] font-bold text-gray-600">cm</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
          <p className="mb-1 flex items-center justify-center gap-1 text-[9px] font-black uppercase text-gray-500">
            <Scale size={12} aria-hidden /> Güncel kilo
          </p>
          <p className="text-xl font-black tabular-nums text-white">{displayWeight ?? "—"}</p>
          <p className="text-[10px] font-bold text-gray-600">kg</p>
        </div>
      </div>

      {canRecord ? (
        <form onSubmit={(e) => void handleSubmit(e)} className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-gray-500">Yeni ölçüm kaydı</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase text-gray-600">Tarih</span>
              <input
                type="date"
                value={measurementDate}
                onChange={(e) => setMeasurementDate(e.target.value)}
                className="min-h-11 rounded-xl border border-white/10 bg-black px-3 text-sm font-bold text-white outline-none focus:border-[#7c3aed]"
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
                className="min-h-11 rounded-xl border border-white/10 bg-black px-3 text-sm font-bold text-white outline-none focus:border-[#7c3aed]"
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
                className="min-h-11 rounded-xl border border-white/10 bg-black px-3 text-sm font-bold text-white outline-none focus:border-[#7c3aed]"
              />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
              <span className="text-[9px] font-black uppercase text-gray-600">Not (opsiyonel)</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Sabah aç karnına"
                className="min-h-11 rounded-xl border border-white/10 bg-black px-3 text-sm font-bold text-white outline-none focus:border-[#7c3aed]"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 rounded-xl bg-[#7c3aed] px-5 text-[10px] font-black uppercase tracking-wide text-white disabled:opacity-60"
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
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[9px] font-black uppercase text-gray-500">
                <th className="px-4 py-3">Tarih</th>
                <th className="px-4 py-3">Boy (cm)</th>
                <th className="px-4 py-3">Kilo (kg)</th>
                <th className="px-4 py-3">Not</th>
              </tr>
            </thead>
            <tbody>
              {[...measurements].reverse().map((m) => (
                <tr key={m.id} className="border-b border-white/5 text-white">
                  <td className="px-4 py-3 font-bold">{formatDateLabel(m.measurement_date)}</td>
                  <td className="px-4 py-3 tabular-nums">{m.height ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{m.weight ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{m.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="ui-chart-shell ui-chart-shell--passive h-[min(50vw,16rem)] min-h-[200px] w-full min-w-0 sm:h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ left: -12, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="tarih" stroke="#6b7280" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
              <YAxis yAxisId="boy" orientation="left" stroke="#a78bfa" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
              <YAxis yAxisId="kilo" orientation="right" stroke="#34d399" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1c1c21", border: "1px solid #7c3aed33", borderRadius: "16px" }}
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
