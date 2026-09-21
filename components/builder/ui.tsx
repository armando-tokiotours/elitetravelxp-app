"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lock } from "lucide-react";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useBuilderAccordionOptional } from "./BuilderAccordion";

const GOLD = "#B85304";
const NAVY = "#1E2D4A";

export type SectionIcon =
  | "calendar"
  | "plane"
  | "hotel"
  | "map"
  | "tour"
  | "car";

export function SectionBlock({
  number,
  title,
  children,
  id,
  icon = "calendar",
  summary,
}: {
  number: number;
  title: ReactNode;
  children: ReactNode;
  id?: string;
  icon?: SectionIcon;
  /** Collapsed at-a-glance preview of the user's selection */
  summary?: ReactNode;
}) {
  const accordion = useBuilderAccordionOptional();
  const highestUnlockedStep = useBuilderStore((s) => s.highestUnlockedStep);
  const locked = number > highestUnlockedStep;
  const isOpen = accordion
    ? !locked && accordion.openSection === number
    : true;

  const onToggle = () => {
    if (locked) {
      accordion?.showToast?.(
        "Complete the previous steps before unlocking this section."
      );
      return;
    }
    if (accordion) accordion.toggleSection(number);
  };

  const summaryText = typeof summary === "string" ? summary : null;
  const stepSaved = !locked && highestUnlockedStep > number;

  return (
    <section
      id={id}
      aria-disabled={locked || undefined}
      className={`scroll-mt-24 overflow-hidden rounded-2xl border border-[#2C2C2E] bg-[#121212] p-0 shadow-2xl ${
        locked ? "opacity-50" : ""
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-disabled={locked}
        disabled={locked}
        className={`flex w-full items-center gap-3 px-4 py-4 text-left transition sm:gap-3.5 sm:px-5 sm:py-5 ${
          locked
            ? "cursor-not-allowed"
            : "hover:bg-[#1C1C1E]/80"
        }`}
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
            stepSaved
              ? "bg-[#1E2D4A] text-cyan-400"
              : "bg-[#1C1C1E] text-zinc-500"
          }`}
          aria-hidden
        >
          <SectionGlyph name={icon} />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="font-display text-sm font-extrabold tracking-tight text-white sm:text-[1.2rem]">
            <span className="text-[#E2C498]">{number}.</span> {title}
          </h2>
          {!isOpen && !locked && summary ? (
            typeof summary === "string" ? (
              <p className="mt-0.5 max-w-[180px] truncate text-[10px] font-medium text-[#E2C498] sm:max-w-none sm:text-xs">
                {summary}
              </p>
            ) : (
              <div className="mt-0.5 min-w-0 max-w-[180px] sm:max-w-none">
                {summary}
              </div>
            )
          ) : null}
          {locked ? (
            <p className="mt-0.5 text-xs font-medium text-zinc-500">
              Complete previous steps to unlock
            </p>
          ) : null}
        </div>

        {!isOpen && !locked && summaryText ? (
          <span className="mr-1 hidden max-w-[9rem] truncate rounded-full border border-[#2C2C2E] bg-[#1C1C1E] px-2.5 py-1 text-[0.65rem] font-medium text-zinc-300 sm:inline-block lg:max-w-[14rem]">
            {summaryText}
          </span>
        ) : null}

        {locked ? (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-[#1C1C1E] text-zinc-400"
            aria-hidden
          >
            <Lock className="h-3.5 w-3.5" />
          </span>
        ) : (
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.25 }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#2C2C2E] bg-[#1C1C1E] text-[#F5EFE6]"
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
        )}
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
            <div className="border-t border-[#2C2C2E] bg-[#1C1C1E]/40 px-4 pb-5 pt-4 sm:px-5 sm:pb-6">
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
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
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
    case "car":
      return (
        <svg {...common}>
          <path d="M5 17h2M17 17h2" />
          <path d="M3 13v-1.5A2.5 2.5 0 015.5 9H7l1.5-3.5A2 2 0 0110.3 4h3.4a2 2 0 011.8 1.1L17 9h1.5A2.5 2.5 0 0121 11.5V13" />
          <path d="M3 13h18v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3z" />
          <circle cx="7.5" cy="16.5" r="1.5" />
          <circle cx="16.5" cy="16.5" r="1.5" />
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
          ? "border border-[#D9BB96] bg-[#0B1F3A] text-white shadow-md"
          : "border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
      } ${className}`}
    >
      {children}
      {active ? (
        <span
          className={`absolute ${checkRight} top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-[#D9BB96] font-bold text-[#0B1F3A] ${checkSize}`}
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
      className="w-full appearance-none rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-[#B85304] focus:ring-2 focus:ring-[#B85304]/25"
    >
      <option key="__placeholder__" value="">
        {placeholder}
      </option>
      {options.map((o, i) => (
        <option key={o.value || `__opt-${i}`} value={o.value}>
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
