"use client";

type AthleteMetricCardProps = {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  isEditing?: boolean;
  onChange?: (value: string) => void;
};

export function AthleteMetricCard({
  label,
  value,
  unit,
  isEditing,
  onChange,
}: AthleteMetricCardProps) {
  return (
    <div className="ui-metric-card">
      <p className="mb-1 text-[8px] font-black uppercase tracking-wide text-gray-600">{label}</p>
      {isEditing && onChange ? (
        <input
          type="number"
          inputMode="decimal"
          className="ui-metric-card__input"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="flex items-baseline gap-1">
          <span className="ui-kpi-card__value text-xl sm:text-2xl">
            {value || "0"}
          </span>
          {unit ? (
            <span className="text-[10px] font-black uppercase text-gray-700">{unit}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}
