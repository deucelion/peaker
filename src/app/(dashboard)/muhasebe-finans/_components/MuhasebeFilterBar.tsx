"use client";

import { useMemo, useState } from "react";
import {
  FinanceFilterChipRow,
  FinanceFilterDrawer,
  FinanceFilterToggleButton,
} from "@/components/finance/FinanceFilterDrawer";
import { FinancePeriodSelector } from "@/components/finance/FinancePeriodSelector";
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
  onApply: () => void;
  onReset: () => void;
  coachOptions: CoachOption[];
  lessonTypeOptions: ReadonlyArray<FilterDropdownOption>;
  lessonStatusOptions: ReadonlyArray<FilterDropdownOption>;
};

type GeneralProps = CommonProps & {
  mode: "genel";
  draft: GeneralFiltersState;
  applied: GeneralFiltersState;
  onDraftChange: (next: GeneralFiltersState) => void;
  paymentKindOptions: string[];
  paymentKindLabel: (kind: string) => string;
  paymentStatusOptions: ReadonlyArray<FilterDropdownOption>;
  summary: { rangePart: string; coachPart: string; kindPart: string };
  onPresetOverdue?: () => void;
};

type CoachesProps = CommonProps & {
  mode: "koclar";
  draft: CoachesFiltersState;
  applied: CoachesFiltersState;
  onDraftChange: (next: CoachesFiltersState) => void;
  summary: { rangePart: string; coachPart: string };
};

export type MuhasebeFilterBarProps = GeneralProps | CoachesProps;

function countActiveFilters(props: MuhasebeFilterBarProps): number {
  const d = props.applied;
  let n = 0;
  if (d.dateFrom || d.dateTo) n += 1;
  if (d.coachId) n += 1;
  if (d.lessonType !== "all") n += 1;
  if (d.lessonStatus !== "all") n += 1;
  if (props.mode === "genel") {
    if (props.applied.paymentKind) n += 1;
    if (props.applied.paymentStatus !== "all") n += 1;
    if (props.applied.packageLifecycle !== "all") n += 1;
    if (props.applied.packagePaymentState !== "all") n += 1;
  }
  return n;
}

function buildChips(props: MuhasebeFilterBarProps, coachOptions: CoachOption[]): Array<{ key: string; label: string; onRemove?: () => void }> {
  const chips: Array<{ key: string; label: string; onRemove?: () => void }> = [];
  const d = props.draft;

  const patchDraft = (patch: Partial<GeneralFiltersState & CoachesFiltersState>) => {
    if (props.mode === "genel") {
      props.onDraftChange({ ...props.draft, ...patch });
    } else {
      props.onDraftChange({ ...props.draft, ...patch });
    }
  };

  if (d.dateFrom && d.dateTo) {
    chips.push({
      key: "range",
      label: `${d.dateFrom} – ${d.dateTo}`,
      onRemove: () => patchDraft({ dateFrom: "", dateTo: "" }),
    });
  }
  if (d.coachId) {
    const name = coachOptions.find((c) => c.id === d.coachId)?.full_name || "Koç";
    chips.push({
      key: "coach",
      label: name,
      onRemove: () => patchDraft({ coachId: "" }),
    });
  }
  if (d.lessonType !== "all") {
    chips.push({
      key: "lessonType",
      label: d.lessonType === "group" ? "Grup dersi" : "Özel ders",
      onRemove: () => patchDraft({ lessonType: "all" }),
    });
  }
  if (d.lessonStatus !== "all") {
    chips.push({
      key: "lessonStatus",
      label: d.lessonStatus,
      onRemove: () => patchDraft({ lessonStatus: "all" }),
    });
  }
  if (props.mode === "genel") {
    const g = props.draft;
    if (g.paymentKind) {
      chips.push({
        key: "paymentKind",
        label: props.paymentKindLabel(g.paymentKind),
        onRemove: () => props.onDraftChange({ ...g, paymentKind: "" }),
      });
    }
    if (g.paymentStatus !== "all") {
      chips.push({
        key: "paymentStatus",
        label: g.paymentStatus === "bekliyor" ? "Bekliyor" : "Ödendi",
        onRemove: () => props.onDraftChange({ ...g, paymentStatus: "all" }),
      });
    }
    if (g.packageLifecycle !== "all") {
      chips.push({
        key: "pkgLifecycle",
        label: g.packageLifecycle,
        onRemove: () => props.onDraftChange({ ...g, packageLifecycle: "all" }),
      });
    }
    if (g.packagePaymentState !== "all") {
      chips.push({
        key: "pkgPay",
        label: g.packagePaymentState,
        onRemove: () => props.onDraftChange({ ...g, packagePaymentState: "all" }),
      });
    }
  }
  return chips;
}

export function MuhasebeFilterBar(props: MuhasebeFilterBarProps) {
  const {
    onApply,
    onReset,
    coachOptions,
    lessonTypeOptions,
    lessonStatusOptions,
    feedback,
    applyLabel = "Filtreleri uygula",
    resetLabel = "Filtreleri sıfırla",
  } = props;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const activeCount = useMemo(() => countActiveFilters(props), [props]);
  const chips = useMemo(() => buildChips(props, coachOptions), [props, coachOptions]);

  const period = {
    month: props.draft.month,
    dateFrom: props.draft.dateFrom,
    dateTo: props.draft.dateTo,
  };

  const setPeriod = (next: typeof period) => {
    if (props.mode === "genel") props.onDraftChange({ ...props.draft, ...next });
    else props.onDraftChange({ ...props.draft, ...next });
  };

  const patchDraft = (patch: Partial<GeneralFiltersState & CoachesFiltersState>) => {
    if (props.mode === "genel") {
      props.onDraftChange({ ...props.draft, ...patch });
    } else {
      props.onDraftChange({ ...props.draft, ...patch });
    }
  };

  const drawerFields = (
    <div className="grid gap-4">
      <FinancePeriodSelector
        value={period}
        onChange={setPeriod}
        compact={false}
      />
      <label className="space-y-1">
        <span className="text-[10px] font-black uppercase text-gray-500">Koç</span>
        <select
          value={props.draft.coachId}
          onChange={(e) => patchDraft({ coachId: e.target.value })}
          className="ui-select min-h-11 w-full"
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
          onChange={(e) => patchDraft({ lessonType: e.target.value })}
          className="ui-select min-h-11 w-full"
        >
          {lessonTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-[10px] font-black uppercase text-gray-500">Ders durumu</span>
        <select
          value={props.draft.lessonStatus}
          onChange={(e) => patchDraft({ lessonStatus: e.target.value })}
          className="ui-select min-h-11 w-full"
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
              className="ui-select min-h-11 w-full"
            >
              <option value="">Tüm ödeme türleri</option>
              {props.paymentKindOptions.map((kind) => (
                <option key={kind} value={kind}>
                  {props.paymentKindLabel(kind)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase text-gray-500">Tahsilat durumu</span>
            <select
              value={props.draft.paymentStatus}
              onChange={(e) => props.onDraftChange({ ...props.draft, paymentStatus: e.target.value })}
              className="ui-select min-h-11 w-full"
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
              className="ui-select min-h-11 w-full"
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
              className="ui-select min-h-11 w-full"
            >
              <option value="all">Tümü</option>
              <option value="payment_complete">Ödeme tamamlandı</option>
              <option value="payment_pending">Ödeme bekliyor</option>
            </select>
          </label>
        </>
      ) : null}
      {(period.dateFrom || period.dateTo) && (
        <p className="text-[11px] font-semibold text-amber-300/90">
          Özel tarih aralığı seçildiğinde ay filtresi dikkate alınmaz.
        </p>
      )}
    </div>
  );

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
        <FinancePeriodSelector value={period} onChange={setPeriod} compact />
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          {props.mode === "genel" && props.onPresetOverdue ? (
            <button
              type="button"
              onClick={props.onPresetOverdue}
              className="inline-flex min-h-11 items-center rounded-xl border border-red-500/35 bg-red-500/10 px-3 text-[10px] font-black uppercase text-red-200 hover:bg-red-500/20"
            >
              Gecikmiş
            </button>
          ) : null}
          <button
            type="button"
            onClick={onApply}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 text-xs font-black uppercase tracking-wide text-black shadow-md shadow-emerald-500/15 hover:bg-emerald-400"
          >
            {applyLabel}
          </button>
          <FinanceFilterToggleButton activeCount={activeCount} onClick={() => setDrawerOpen(true)} />
        </div>
      </div>

      {chips.length > 0 ? <div className="mt-3"><FinanceFilterChipRow chips={chips} /></div> : null}

      <div className="mt-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[10px] font-semibold text-gray-400">
        <p className="font-black uppercase tracking-wide text-gray-500">Aktif filtre özeti</p>
        <p className="mt-1 text-gray-300">{props.summary.rangePart}</p>
        <p className="mt-0.5">{props.summary.coachPart}</p>
        {props.mode === "genel" ? <p className="mt-0.5">{props.summary.kindPart}</p> : null}
      </div>

      <FinanceFilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onApply={onApply}
        onReset={() => {
          onReset();
          setDrawerOpen(false);
        }}
        applyLabel={applyLabel}
        resetLabel={resetLabel}
        feedback={feedback}
      >
        {drawerFields}
      </FinanceFilterDrawer>
    </section>
  );
}
