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
    <div className="flex min-w-0 flex-col items-center rounded-lg border border-white/5 bg-black/40 p-2.5 sm:p-3">
      <p className="mb-1 text-[8px] font-black uppercase tracking-wide text-gray-600">{label}</p>
      {isEditing && onChange ? (
        <input
          type="number"
          inputMode="decimal"
          className="min-h-10 w-full min-w-0 touch-manipulation border-b-2 border-[#7c3aed]/50 bg-transparent text-center text-xl font-black text-[#7c3aed] outline-none"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-black tabular-nums text-white sm:text-2xl">
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
