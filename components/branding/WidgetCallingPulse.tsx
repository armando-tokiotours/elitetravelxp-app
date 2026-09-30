"use client";

/**
 * White “calling you” pulse for Builder widget cards.
 * Active until the step is completed / pulsar moves on.
 */
export function getWidgetPulsarClass(
  activePulsarStep: string | null,
  stepName: string
): string {
  return activePulsarStep === stepName
    ? "z-[1] border border-white/70 animate-widget-call-glow"
    : "border-white/10";
}

export function WidgetCallingPulse({
  active,
  roundedClass = "rounded-[22px]",
}: {
  active: boolean;
  /** Match the parent shell shape (cards vs pill CTAs). */
  roundedClass?: string;
}) {
  if (!active) return null;
  return (
    <span
      className={`pointer-events-none absolute inset-0 z-[2] animate-widget-call-ring border border-white/80 ${roundedClass}`}
      aria-hidden
    />
  );
}
