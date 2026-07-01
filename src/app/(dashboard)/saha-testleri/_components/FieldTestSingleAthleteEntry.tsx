"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import type { ProfileBasic, TestDefinitionRow } from "@/types/domain";
import { fieldTestCellKey } from "@/lib/fieldTests/buildFieldTestSavePayload";
import type { FieldTestPreviousCell } from "@/lib/fieldTests/hydrateFieldTestValuesFromResults";
import { formatFieldTestPreviousDateLabel } from "@/lib/fieldTests/fieldTestPreviousValueDisplay";
import { hrefAthleteDetail } from "@/lib/navigation/athleteDetailBackLink";

export function FieldTestSingleAthleteEntry({
  athlete,
  metrics,
  metricIsTextFn,
  testValues,
  previousTestCells,
  generalNote,
  athleteIndex,
  athleteTotal,
  onPrev,
  onNext,
  onValueChange,
  onGeneralNoteChange,
  onAutosaveBlur,
  cellRefs,
  onMetricEnter,
}: {
  athlete: ProfileBasic;
  metrics: TestDefinitionRow[];
  metricIsTextFn: (m: TestDefinitionRow) => boolean;
  testValues: Record<string, string | number>;
  previousTestCells: Record<string, FieldTestPreviousCell>;
  generalNote: string;
  athleteIndex: number;
  athleteTotal: number;
  onPrev: () => void;
  onNext: () => void;
  onValueChange: (metricId: string, value: string) => void;
  onGeneralNoteChange: (value: string) => void;
  onAutosaveBlur: () => void;
  cellRefs: React.MutableRefObject<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>;
  onMetricEnter: (metricId: string, reverse: boolean) => void;
}) {
  const canPrev = athleteIndex > 0;
  const canNext = athleteIndex < athleteTotal - 1;

  return (
    <div className="min-w-0 space-y-4 rounded-2xl border border-white/10 bg-[#121215] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#7c3aed] text-sm font-black italic text-white">
            {athlete.full_name.substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-black uppercase italic tracking-tight text-white">
              {athlete.full_name}
            </h2>
            <p className="text-[10px] font-bold text-gray-500">
              Sporcu {athleteIndex + 1} / {athleteTotal}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canPrev}
            onClick={onPrev}
            className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-white/10 bg-black/30 px-3 text-[10px] font-black uppercase text-gray-300 disabled:opacity-40"
          >
            <ChevronLeft size={16} aria-hidden /> Önceki
          </button>
          <button
            type="button"
            disabled={!canNext}
            onClick={onNext}
            className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-white/10 bg-black/30 px-3 text-[10px] font-black uppercase text-gray-300 disabled:opacity-40"
          >
            Sonraki <ChevronRight size={16} aria-hidden />
          </button>
          <Link
            href={hrefAthleteDetail(athlete.id, "saha-testleri", "alan-testleri")}
            className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-white/10 bg-black/30 px-3 text-[10px] font-black uppercase text-[#c4b5fd]"
          >
            Geçmiş <ExternalLink size={14} aria-hidden />
          </Link>
        </div>
      </div>

      {metrics.length === 0 ? (
        <p className="text-sm font-semibold text-gray-500">Metrik tanımlanmadan veri girişi yapılamaz.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {metrics.map((metric) => {
            const key = fieldTestCellKey(athlete.id, metric.id);
            const isText = metricIsTextFn(metric);
            const previous = previousTestCells[key];
            return (
              <label key={metric.id} className="flex min-w-0 flex-col gap-2 rounded-xl border border-white/10 bg-black/25 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-black uppercase tracking-tight text-white">{metric.name}</span>
                  <span className="shrink-0 rounded-full bg-[#7c3aed]/15 px-2 py-0.5 text-[9px] font-black uppercase text-[#c4b5fd]">
                    {isText ? "Yazılı not" : metric.unit || "Sayı"}
                  </span>
                </div>
                {previous ? (
                  <p className="text-[10px] font-semibold leading-snug text-gray-500">
                    <span className="font-black uppercase tracking-wide text-gray-600">Önceki</span>
                    <span className="text-gray-600"> · {formatFieldTestPreviousDateLabel(previous.testDate)}</span>
                    <span className="mt-0.5 block break-words text-gray-400">{previous.display}</span>
                  </p>
                ) : null}
                {isText ? (
                  <textarea
                    ref={(el) => {
                      cellRefs.current[key] = el;
                    }}
                    rows={3}
                    className="ui-textarea w-full min-h-[88px] text-sm"
                    placeholder="Not / yorum gir"
                    value={String(testValues[key] ?? "")}
                    onChange={(e) => onValueChange(metric.id, e.target.value)}
                    onBlur={onAutosaveBlur}
                  />
                ) : (
                  <input
                    ref={(el) => {
                      cellRefs.current[key] = el;
                    }}
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    className="ui-input min-h-11 w-full text-center text-lg font-black"
                    placeholder="Değer"
                    value={testValues[key] ?? ""}
                    onChange={(e) => onValueChange(metric.id, e.target.value)}
                    onBlur={onAutosaveBlur}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      onMetricEnter(metric.id, e.shiftKey);
                    }}
                  />
                )}
              </label>
            );
          })}
        </div>
      )}

      <label className="flex min-w-0 flex-col gap-2 rounded-xl border border-white/10 bg-black/25 p-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Genel test notu</span>
        <span className="text-[10px] font-semibold text-gray-600">
          Bu alan metriklerden bağımsızdır; o günün genel gözlemini yazın.
        </span>
        <textarea
          className="ui-textarea w-full min-h-[80px] text-sm"
          placeholder="örn: Test öncesi yorgunluk, saha koşulları…"
          value={generalNote}
          onChange={(e) => onGeneralNoteChange(e.target.value)}
          onBlur={onAutosaveBlur}
          rows={3}
        />
      </label>
    </div>
  );
}
