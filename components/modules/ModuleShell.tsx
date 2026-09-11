import type { ReactNode } from "react";

interface ModuleShellProps {
  step: number;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function ModuleShell({
  step,
  title,
  description,
  children,
  className = "",
}: ModuleShellProps) {
  return (
    <section
      className={`module-card border border-white/10 bg-[#121214]/60 p-6 sm:p-8 backdrop-blur-sm transition-colors duration-300 hover:border-[#D4AF37]/25 ${className}`}
    >
      <header className="mb-6 flex items-start gap-4">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#D4AF37]/40 font-display text-sm tracking-widest text-[#D4AF37]"
          aria-hidden
        >
          {String(step).padStart(2, "0")}
        </span>
        <div>
          <h2 className="font-display text-2xl font-medium tracking-wide text-white sm:text-[1.65rem]">
            {title}
          </h2>
          {description ? (
            <p className="mt-1.5 text-sm leading-relaxed text-white/55">
              {description}
            </p>
          ) : null}
        </div>
      </header>
      {children}
    </section>
  );
}

interface OptionChipProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}

export function OptionChip({
  selected,
  onClick,
  children,
  className = "",
}: OptionChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-4 py-2.5 text-left text-sm tracking-wide transition-all duration-200 ${
        selected
          ? "border-[#D4AF37] bg-[#D4AF37]/15 text-[#D4AF37]"
          : "border-white/15 bg-transparent text-white/80 hover:border-white/35 hover:text-white"
      } ${className}`}
    >
      {children}
    </button>
  );
}

interface ToggleYesNoProps {
  value: boolean;
  onChange: (v: boolean) => void;
  yesLabel?: string;
  noLabel?: string;
}

export function ToggleYesNo({
  value,
  onChange,
  yesLabel = "Yes",
  noLabel = "No",
}: ToggleYesNoProps) {
  return (
    <div className="inline-flex border border-white/15">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-5 py-2 text-sm tracking-wider transition-colors ${
          value
            ? "bg-[#D4AF37] text-[#0B0B0C]"
            : "text-white/60 hover:text-white"
        }`}
      >
        {yesLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-5 py-2 text-sm tracking-wider transition-colors ${
          !value
            ? "bg-[#D4AF37] text-[#0B0B0C]"
            : "text-white/60 hover:text-white"
        }`}
      >
        {noLabel}
      </button>
    </div>
  );
}

interface CounterProps {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  label?: string;
}

export function Counter({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
}: CounterProps) {
  return (
    <div className="flex items-center gap-3">
      {label ? (
        <span className="min-w-[4.5rem] text-sm text-white/60">{label}</span>
      ) : null}
      <div className="inline-flex items-center border border-white/15">
        <button
          type="button"
          aria-label="Decrease"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="px-3 py-1.5 text-white/70 transition hover:text-[#D4AF37] disabled:opacity-30"
        >
          −
        </button>
        <span className="min-w-[2.5rem] text-center font-display text-lg text-white tabular-nums">
          {value}
        </span>
        <button
          type="button"
          aria-label="Increase"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="px-3 py-1.5 text-white/70 transition hover:text-[#D4AF37] disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}
