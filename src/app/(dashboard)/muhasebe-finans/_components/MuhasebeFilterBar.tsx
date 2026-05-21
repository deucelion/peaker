"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import {
  type CoachOption,
  type CoachesFiltersState,
  type FilterDropdownOption,
  type GeneralFiltersState,
} from "./types";

type CommonProps = {
  applyLabel?: string;
  resetLabel?: string;
  feedback: string | null;
  advancedOpen: boolean;
  onAdvancedToggle: () => void;
  onApply: () => void;
  onReset: () => void;
  coachOptions: CoachOption[];
  lessonTypeOptions: ReadonlyArray<FilterDropdownOption>;
  lessonStatusOptions: ReadonlyArray<FilterDropdownOption>;
};

type GeneralProps = CommonProps & {
  mode: "genel";
  draft: GeneralFiltersState;
  onDraftChange: (next: GeneralFiltersState) => void;
  paymentKindOptions: string[];
  paymentKindLabel: (kind: string) => string;
  paymentStatusOptions: ReadonlyArray<FilterDropdownOption>;
  summary: { rangePart: string; coachPart: string; kindPart: string };
};

type CoachesProps = CommonProps & {
  mode: "koclar";
  draft: CoachesFiltersState;
  onDraftChange: (next: CoachesFiltersState) => void;
  summary: { rangePart: string; coachPart: string };
};

export type MuhasebeFilterBarProps = GeneralProps | CoachesProps;

export function MuhasebeFilterBar(props: MuhasebeFilterBarProps) {
  const {
    advancedOpen,
    onAdvancedToggle,
    onApply,
    onReset,
    coachOptions,
    lessonTypeOptions,
    lessonStatusOptions,
    feedback,
    applyLabel = "Filtreleri uygula",
    resetLabel = "Filtreleri sıfırla",
  } = props;

  const draftMonth = props.mode === "genel" ? props.draft.month : props.draft.month;
  const draftFrom = props.mode === "genel" ? props.draft.dateFrom : props.draft.dateFrom;
  const draftTo = props.mode === "genel" ? props.draft.dateTo : props.draft.dateTo;

  const setMonth = (value: string) => {
    if (props.mode === "genel") props.onDraftChange({ ...props.draft, month: value });
    else props.onDraftChange({ ...props.draft, month: value });
  };
  const setFrom = (value: string) => {
    if (props.mode === "genel") props.onDraftChange({ ...props.draft, dateFrom: value });
    else props.onDraftChange({ ...props.draft, dateFrom: value });
  };
  const setTo = (value: string) => {
    if (props.mode === "genel") props.onDraftChange({ ...props.draft, dateTo: value });
    else props.onDraftChange({ ...props.draft, dateTo: value });
  };
  const setCoach = (value: string) => {
    if (props.mode === "genel") props.onDraftChange({ ...props.draft, coachId: value });
    else props.onDraftChange({ ...props.draft, coachId: value });
  };
  const setLessonType = (value: string) => {
    if (props.mode === "genel") props.onDraftChange({ ...props.draft, lessonType: value });
    else props.onDraftChange({ ...props.draft, lessonType: value });
  };
  const setLessonStatus = (value: string) => {
    if (props.mode === "genel") props.onDraftChange({ ...props.draft, lessonStatus: value });
    else props.onDraftChange({ ...props.draft, lessonStatus: value });
  };

  return (
    <section className="rounded-xl border border-white/10 bg-[#121215] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-black uppercase text-white">Filtreler</h2>
        {feedback ? (
          <span className="text-[10px] font-semibold text-emerald-400/95" role="status">
            {feedback}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="min-w-0 flex-1 space-y-1 lg:max-w-[14rem]">
          <span className="text-[10px] font-black uppercase text-gray-500">Ay</span>
          <input
            type="month"
            value={draftMonth}
            onChange={(e) => setMonth(e.target.value)}
            className="ui-input min-h-11 w-full max-w-full"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <button
            type="button"
            onClick={onApply}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 px-4 text-xs font-black uppercase tracking-wide text-black shadow-md shadow-emerald-500/15 transition hover:bg-emerald-400"
          >
            {applyLabel}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/30 px-4 text-xs font-black uppercase text-gray-300 transition hover:border-white/25 hover:text-white"
          >
            {resetLabel}
          </button>
          <button
            type="button"
            onClick={onAdvancedToggle}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 bg-black/30 px-4 text-xs font-black uppercase text-gray-300 transition hover:border-white/25 hover:text-white"
          >
            {advancedOpen ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
            Gelişmiş
          </button>
        </div>
      </div>
      {advancedOpen ? (
        <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase text-gray-500">Tarih başlangıç</span>
            <input
              type="date"
              value={draftFrom}
              onChange={(e) => setFrom(e.target.value)}
              className="ui-input min-h-11 w-full"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase text-gray-500">Tarih bitiş</span>
            <input
              type="date"
              value={draftTo}
              onChange={(e) => setTo(e.target.value)}
              className="ui-input min-h-11 w-full"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase text-gray-500">Koç</span>
            <select
              value={props.draft.coachId}
              onChange={(e) => setCoach(e.target.value)}
              className="ui-select min-h-11 w-full max-w-full"
            >
              <option value="">Tüm koçlar</option>
              {coachOptions.map((coach) => (
                <option key={coach.id} value={coach.id}>
                  {coach.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase text-gray-500">Ders tipi</span>
            <select
              value={props.draft.lessonType}
              onChange={(e) => setLessonType(e.target.value)}
              className="ui-select min-h-11 w-full max-w-full"
            >
              {lessonTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={props.mode === "koclar" ? "space-y-1 sm:col-span-2 lg:col-span-3" : "space-y-1"}>
            <span className="text-[10px] font-black uppercase text-gray-500">Ders durumu</span>
            <select
              value={props.draft.lessonStatus}
              onChange={(e) => setLessonStatus(e.target.value)}
              className="ui-select min-h-11 w-full max-w-full"
            >
              {lessonStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {props.mode === "genel" ? (
            <>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-500">Ödeme türü</span>
                <select
                  value={props.draft.paymentKind}
                  onChange={(e) => props.onDraftChange({ ...props.draft, paymentKind: e.target.value })}
                  className="ui-select min-h-11 w-full max-w-full"
                >
                  <option value="">Tüm ödeme türleri</option>
                  {props.paymentKindOptions.map((kind) => (
                    <option key={kind} value={kind}>
                      {props.paymentKindLabel(kind)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 sm:col-span-2 lg:col-span-3">
                <span className="text-[10px] font-black uppercase text-gray-500">Tahsilat durumu</span>
                <select
                  value={props.draft.paymentStatus}
                  onChange={(e) => props.onDraftChange({ ...props.draft, paymentStatus: e.target.value })}
                  className="ui-select min-h-11 w-full max-w-full"
                >
                  {props.paymentStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-500">Paket durumu</span>
                <select
                  value={props.draft.packageLifecycle}
                  onChange={(e) => props.onDraftChange({ ...props.draft, packageLifecycle: e.target.value })}
                  className="ui-select min-h-11 w-full max-w-full"
                >
                  <option value="all">Tüm paket durumları</option>
                  <option value="active">Aktif</option>
                  <option value="paused">Dondurulmuş</option>
                  <option value="cancelled">İptal</option>
                  <option value="refunded">İade</option>
                  <option value="completed">Tamamlandı</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-500">Paket ödemesi</span>
                <select
                  value={props.draft.packagePaymentState}
                  onChange={(e) => props.onDraftChange({ ...props.draft, packagePaymentState: e.target.value })}
                  className="ui-select min-h-11 w-full max-w-full"
                >
                  <option value="all">Tümü</option>
                  <option value="payment_complete">Ödeme tamamlandı</option>
                  <option value="payment_pending">Ödeme bekliyor</option>
                </select>
              </label>
            </>
          ) : null}
        </div>
      ) : null}
      {(advancedOpen || draftFrom || draftTo) && (
        <p className="mt-3 text-[11px] font-semibold text-amber-300/90">
          Özel tarih aralığı seçildiğinde ay filtresi dikkate alınmaz.
        </p>
      )}
      <div className="mt-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[10px] font-semibold text-gray-400">
        <p className="font-black uppercase tracking-wide text-gray-500">Aktif filtre özeti</p>
        <p className="mt-1 text-gray-300">{props.summary.rangePart}</p>
        <p className="mt-0.5">{props.summary.coachPart}</p>
        {props.mode === "genel" ? <p className="mt-0.5">{props.summary.kindPart}</p> : null}
      </div>
    </section>
  );
}
