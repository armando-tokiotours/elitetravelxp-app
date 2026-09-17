"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useBuilderAccordionOptional } from "./BuilderAccordion";

const GOLD = "#C4A35A";
const NAVY = "#0B1F3A";

export type SectionIcon =
  | "calendar"
  | "plane"
  | "hotel"
  | "map"
  | "tour";

export function SectionBlock({
  number,
  title,
  children,
  id,
  icon = "calendar",
  summary,
}: {
  number: number;
  title: string;
  children: ReactNode;
  id?: string;
  icon?: SectionIcon;
  /** Collapsed at-a-glance preview of the user's selection */
  summary?: string;
}) {
  const accordion = useBuilderAccordionOptional();
  const isOpen = accordion ? accordion.openSection === number : true;

  const onToggle = () => {
    if (accordion) accordion.toggleSection(number);
  };

  return (
    <section
      id={id}
      className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-[0_2px_16px_rgba(0,0,0,0.45)]"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-zinc-800/60 sm:gap-3.5 sm:px-6 sm:py-5"
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-[0_4px_12px_rgba(196,163,90,0.35)]"
          style={{ background: GOLD }}
          aria-hidden
        >
          <SectionGlyph name={icon} />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl tracking-tight text-white sm:text-[1.7rem]">
            <span className="text-[#C4A35A]">{number}.</span> {title}
          </h2>
          {!isOpen && summary ? (
            <p className="mt-0.5 truncate text-xs font-medium text-[#C4A35A] sm:text-[0.8rem]">
              {summary}
            </p>
          ) : null}
        </div>

        {!isOpen && summary ? (
          <span className="mr-1 hidden max-w-[9rem] truncate rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-[0.65rem] font-medium text-zinc-300 sm:inline-block lg:max-w-[14rem]">
            {summary}
          </span>
        ) : null}

        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-white"
          aria-hidden
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M3 5l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-zinc-800 px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
              {children}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function SectionGlyph({ name }: { name: SectionIcon }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "white",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "plane":
      // Plane landing (nose down toward runway) — Lucide-style
      return (
        <svg {...common}>
          <path d="M2 22h20" />
          <path d="M3.77 10.77 2 9l2-4.5 1.1.55c.55.28.91.84.91 1.45s.36 1.17.91 1.45L8 8.5l3-6 1.05.53A2.5 2.5 0 0 1 14 5.5V7l6.15 3.27A2 2 0 0 1 21 12v1.5" />
        </svg>
      );
    case "hotel":
      return (
        <svg {...common}>
          <path d="M3 21V8a2 2 0 012-2h6v15M11 6h6a2 2 0 012 2v13M7 21v-4M15 21v-4M7 10h.01M15 10h.01" />
        </svg>
      );
    case "map":
      return (
        <svg {...common}>
          <path d="M9 4l-5 2v14l5-2 6 2 5-2V4l-5 2-6-2zM9 4v14M15 6v14" />
        </svg>
      );
    case "tour":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4l2.5 2.5" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      );
  }
}

/** Selection pill with gold check when active — matches luxury builder mockup. */
export function ChoicePill({
  active,
  onClick,
  children,
  className = "",
  size = "default",
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  /** sm ≈15% smaller; xs for dense 2-col Yes/No rows */
  size?: "default" | "sm" | "xs";
}) {
  const sizing =
    size === "xs"
      ? active
        ? "min-h-[2rem] gap-1 px-3 py-1.5 pr-7 text-xs"
        : "min-h-[2rem] gap-1 px-3 py-1.5 text-xs"
      : size === "sm"
        ? active
          ? "min-h-[2.35rem] gap-1.5 px-5 py-2 pr-9 text-[0.8125rem]"
          : "min-h-[2.35rem] gap-1.5 px-5 py-2 text-[0.8125rem]"
        : active
          ? "min-h-[2.75rem] gap-2 px-6 py-2.5 pr-11 text-sm"
          : "min-h-[2.75rem] gap-2 px-6 py-2.5 text-sm";
  const checkSize =
    size === "xs"
      ? "h-4 w-4 text-[0.55rem]"
      : size === "sm"
        ? "h-5 w-5 text-[0.6rem]"
        : "h-6 w-6 text-[0.7rem]";
  const checkRight = size === "xs" ? "right-1.5" : "right-2";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex items-center justify-center rounded-full font-semibold tracking-wide transition ${sizing} ${
        active
          ? "border border-[#C4A35A] bg-[#0B1F3A] text-white shadow-md"
          : "border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
      } ${className}`}
    >
      {children}
      {active ? (
        <span
          className={`absolute ${checkRight} top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full font-bold text-white ${checkSize}`}
          style={{ background: GOLD }}
          aria-hidden
        >
          ✓
        </span>
      ) : null}
    </button>
  );
}

export function PillToggle({
  value,
  onChange,
  yesLabel = "Yes",
  noLabel = "No",
  size = "default",
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  yesLabel?: string;
  noLabel?: string;
  size?: "default" | "sm" | "xs";
}) {
  return (
    <div className={`inline-flex ${size === "default" ? "gap-2" : "gap-1.5"}`}>
      <ChoicePill
        active={value}
        onClick={() => onChange(true)}
        size={size}
      >
        {yesLabel}
      </ChoicePill>
      <ChoicePill
        active={!value}
        onClick={() => onChange(false)}
        size={size}
      >
        {noLabel}
      </ChoicePill>
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
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
      className="w-full appearance-none rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-[#C4A35A] focus:ring-2 focus:ring-[#C4A35A]/25"
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
    <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950 px-2 py-1">
      <button
        type="button"
        aria-label="Fewer nights"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="flex h-7 w-7 items-center justify-center rounded-full text-white hover:bg-zinc-800"
      >
        −
      </button>
      <span className="min-w-[4.5rem] text-center text-sm font-medium text-white">
        {value} night{value === 1 ? "" : "s"}
      </span>
      <button
        type="button"
        aria-label="More nights"
        onClick={() => onChange(value + 1)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-white hover:bg-zinc-800"
      >
        +
      </button>
    </div>
  );
}

export { GOLD, NAVY };
