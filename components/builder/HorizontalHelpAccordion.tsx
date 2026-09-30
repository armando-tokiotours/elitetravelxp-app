"use client";

import { useState, type ReactNode } from "react";
import { AlertCircle, HelpCircle } from "lucide-react";

/**
 * iOS-style horizontal help accordion: ? / ! only until tapped,
 * then help copy expands beside the button. Stays open until
 * the user taps the control again (does not auto-close on other clicks).
 */
export function HorizontalHelpAccordion({
  text,
  ariaLabelShow,
  ariaLabelHide,
  variant = "help",
  className = "",
}: {
  text: ReactNode;
  ariaLabelShow: string;
  ariaLabelHide: string;
  variant?: "help" | "alert";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [needsTap, setNeedsTap] = useState(true);
  const Icon = variant === "alert" ? AlertCircle : HelpCircle;

  return (
    <div className={`flex min-h-8 items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => {
          setNeedsTap(false);
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-label={open ? ariaLabelHide : ariaLabelShow}
        className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${
          open
            ? "border-white/50 bg-white/15 text-white"
            : needsTap
              ? "animate-locations-help-glow border-white/70 bg-white/10 text-white"
              : variant === "alert"
                ? "border-[#D91147]/60 bg-[#D91147]/10 text-[#D91147] hover:border-[#D91147]"
                : "border-zinc-600 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
        }`}
      >
        {needsTap && !open ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 animate-locations-help-ring rounded-full border border-white/80"
          />
        ) : null}
        <Icon className="relative z-[1] h-3.5 w-3.5" aria-hidden />
      </button>
      {open ? (
        <p className="min-w-0 flex-1 text-[11px] leading-snug text-zinc-400">
          {text}
        </p>
      ) : null}
    </div>
  );
}
