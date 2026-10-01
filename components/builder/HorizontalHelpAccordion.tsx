"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, HelpCircle } from "lucide-react";

/**
 * iOS-style horizontal help accordion: icon only until tapped,
 * then copy expands beside the button. Closes on outside click
 * or when the icon is tapped again.
 *
 * Default icon is ? / !. Pass `icon` to swap (e.g. compare A/B).
 */
export function HorizontalHelpAccordion({
  text,
  ariaLabelShow,
  ariaLabelHide,
  variant = "help",
  icon,
  className = "",
}: {
  text: ReactNode;
  ariaLabelShow: string;
  ariaLabelHide: string;
  variant?: "help" | "alert";
  /** Replace the default ? / ! glyph (e.g. compare-ab image). */
  icon?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [needsTap, setNeedsTap] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const FallbackIcon = variant === "alert" ? AlertCircle : HelpCircle;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`flex min-h-8 items-center gap-2 ${className}`}
    >
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
        {icon ? (
          <span className="relative z-[1] flex h-4 w-4 items-center justify-center overflow-hidden">
            {icon}
          </span>
        ) : (
          <FallbackIcon className="relative z-[1] h-3.5 w-3.5" aria-hidden />
        )}
      </button>
      {open ? (
        <div className="min-w-0 flex-1 text-[11px] leading-snug text-zinc-400">
          {text}
        </div>
      ) : null}
    </div>
  );
}
