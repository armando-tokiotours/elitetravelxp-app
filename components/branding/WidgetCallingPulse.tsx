"use client";

export type WidgetPulseTone = "white" | "cyan";

/**
 * “Calling you” pulse for Builder widget cards.
 * Active until the step is completed / pulsar moves on.
 * Express Pass / Builder S always uses cyan — do not vary by step.
 */
export function getWidgetPulsarClass(
  activePulsarStep: string | null,
  stepName: string,
  tone: WidgetPulseTone = "white"
): string {
  if (activePulsarStep !== stepName) return "border-white/10";
  return tone === "cyan"
    ? "z-[1] border border-[#0080A3] animate-widget-call-glow-cyan shadow-lg shadow-[#0080A3]/50"
    : "z-[1] border border-white/70 animate-widget-call-glow";
}

export function WidgetCallingPulse({
  active,
  roundedClass = "rounded-[22px]",
  tone = "white",
}: {
  active: boolean;
  /** Match the parent shell shape (cards vs pill CTAs). */
  roundedClass?: string;
  tone?: WidgetPulseTone;
}) {
  if (!active) return null;
  const ring =
    tone === "cyan"
      ? "animate-widget-call-ring-cyan border-[#0080A3]/90"
      : "animate-widget-call-ring border-white/80";
  return (
    <span
      className={`pointer-events-none absolute inset-0 z-[2] border ${ring} ${roundedClass}`}
      aria-hidden
    />
  );
}

/**
 * Top-right step check — bare icon overlay (no circular chrome).
 * Unapproved: muted grey. Approved: cyan text.
 * Absolutely positioned so it does not affect card layout.
 */
export function WidgetApprovedCheck({
  show,
  className = "top-3 right-3",
}: {
  /** True when the step is approved / complete. */
  show: boolean;
  className?: string;
}) {
  return (
    <span
      className={`pointer-events-none absolute z-30 ${
        show ? "text-[#0080A3]" : "text-gray-500/60"
      } ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}
