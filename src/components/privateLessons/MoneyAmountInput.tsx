"use client";

type MoneyAmountInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  className?: string;
  id?: string;
};

const INPUT_CLASS =
  "min-h-[3rem] w-full rounded-2xl border border-white/10 pl-10 pr-4 py-3 text-sm font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition placeholder:text-gray-600 sm:text-base bg-[color-mix(in_srgb,var(--peaker-ui-SURFACE)_94%,var(--peaker-ui-TEXT_PRIMARY)_6%)] text-[var(--peaker-ui-TEXT_PRIMARY)] focus:border-[color-mix(in_srgb,var(--peaker-ui-PRIMARY)_60%,transparent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--peaker-ui-PRIMARY)_20%,transparent)]";

export function MoneyAmountInput({
  label,
  value,
  onChange,
  required,
  hint = "Örn: 10000 veya 10.000",
  placeholder = "10000",
  className,
  id,
}: MoneyAmountInputProps) {
  const inputId = id || label.replace(/\s+/g, "-").toLowerCase();
  return (
    <label className="block space-y-1.5" htmlFor={inputId}>
      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
        {label}
        {required ? " *" : ""}
      </span>
      <div className="relative">
        <span
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-gray-500"
          aria-hidden
        >
          ₺
        </span>
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={className ? `${INPUT_CLASS} ${className}` : INPUT_CLASS}
        />
      </div>
      {hint ? <p className="text-[10px] font-semibold text-gray-500">{hint}</p> : null}
    </label>
  );
}
