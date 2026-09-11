"use client";

import type { ReactNode } from "react";

export function SectionBlock({
  number,
  title,
  children,
  id,
}: {
  number: number;
  title: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="rounded-2xl border border-[#E8E2D9] bg-white/80 p-5 shadow-[0_1px_2px_rgba(15,30,60,0.04)] sm:p-6"
    >
      <header className="mb-4 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B1F3A] text-xs font-semibold text-white">
          {number}
        </span>
        <h2 className="font-display text-xl text-[#0B1F3A] sm:text-2xl">
          {title}
        </h2>
      </header>
      {children}
    </section>
  );
}

export function PillToggle({
  value,
  onChange,
  yesLabel = "Yes",
  noLabel = "No",
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  yesLabel?: string;
  noLabel?: string;
}) {
  return (
    <div className="inline-flex rounded-full border border-[#D9D2C7] bg-[#F7F3EC] p-1">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`rounded-full px-5 py-1.5 text-sm font-medium transition ${
          value
            ? "bg-[#0B1F3A] text-white shadow-sm"
            : "text-[#5C6570] hover:text-[#0B1F3A]"
        }`}
      >
        {yesLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`rounded-full px-5 py-1.5 text-sm font-medium transition ${
          !value
            ? "bg-[#0B1F3A] text-white shadow-sm"
            : "text-[#5C6570] hover:text-[#0B1F3A]"
        }`}
      >
        {noLabel}
      </button>
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-[#8A8278]">
      {children}
    </label>
  );
}

export function SelectField({
  value,
  onChange,
  options,
  placeholder = "Select…",
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  id?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full appearance-none rounded-xl border border-[#D9D2C7] bg-white px-4 py-3 text-sm text-[#0B1F3A] outline-none transition focus:border-[#C4A35A] focus:ring-2 focus:ring-[#C4A35A]/25"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function NightCounter({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#D9D2C7] bg-[#F7F3EC] px-2 py-1">
      <button
        type="button"
        aria-label="Fewer nights"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="flex h-7 w-7 items-center justify-center rounded-full text-[#0B1F3A] hover:bg-white"
      >
        −
      </button>
      <span className="min-w-[4.5rem] text-center text-sm font-medium text-[#0B1F3A]">
        {value} night{value === 1 ? "" : "s"}
      </span>
      <button
        type="button"
        aria-label="More nights"
        onClick={() => onChange(value + 1)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-[#0B1F3A] hover:bg-white"
      >
        +
      </button>
    </div>
  );
}
