"use client";

export type FinancePeriodValue = {
  month: string;
  dateFrom: string;
  dateTo: string;
};

type Props = {
  value: FinancePeriodValue;
  onChange: (next: FinancePeriodValue) => void;
  compact?: boolean;
};

export function FinancePeriodSelector({ value, onChange, compact = false }: Props) {
  return (
    <div className={compact ? "flex min-w-0 flex-1 flex-wrap items-end gap-2" : "flex flex-wrap items-end gap-3"}>
      <label className={`min-w-0 space-y-1 ${compact ? "flex-1 sm:max-w-[11rem]" : "sm:max-w-[14rem]"}`}>
        <span className="text-[10px] font-black uppercase text-gray-500">Dönem (ay)</span>
        <input
          type="month"
          value={value.month}
          onChange={(e) => onChange({ ...value, month: e.target.value })}
          className="ui-input min-h-11 w-full max-w-full"
        />
      </label>
      {!compact ? (
        <>
          <label className="min-w-0 space-y-1 sm:max-w-[10rem]">
            <span className="text-[10px] font-black uppercase text-gray-500">Başlangıç</span>
            <input
              type="date"
              value={value.dateFrom}
              onChange={(e) => onChange({ ...value, dateFrom: e.target.value })}
              className="ui-input min-h-11 w-full"
            />
          </label>
          <label className="min-w-0 space-y-1 sm:max-w-[10rem]">
            <span className="text-[10px] font-black uppercase text-gray-500">Bitiş</span>
            <input
              type="date"
              value={value.dateTo}
              onChange={(e) => onChange({ ...value, dateTo: e.target.value })}
              className="ui-input min-h-11 w-full"
            />
          </label>
        </>
      ) : null}
    </div>
  );
}
