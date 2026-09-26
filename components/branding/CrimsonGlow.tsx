/** Signature Tokiotours crimson/magenta radial accent (`#E60F43`). */

export type CrimsonGlowPlacement =
  | "top-right"
  | "top-right-sm"
  | "bottom-right"
  | "right"
  | "left-drag";

const PLACEMENT_CLASS: Record<CrimsonGlowPlacement, string> = {
  "top-right": "-top-16 -right-16 h-64 w-64 opacity-40 blur-3xl",
  "top-right-sm": "-top-12 -right-12 h-48 w-48 opacity-45 blur-2xl",
  "bottom-right": "-bottom-20 -right-20 h-60 w-60 opacity-35 blur-3xl",
  right: "-top-10 -right-12 h-64 w-64 opacity-40 blur-3xl",
  /** City / tour drag rows — left corner, 30% opacity */
  "left-drag": "-top-10 -left-12 h-40 w-40 opacity-30 blur-2xl",
};

export function CrimsonGlow({
  placement = "top-right",
  className = "",
}: {
  placement?: CrimsonGlowPlacement;
  className?: string;
}) {
  return (
    <div
      className={`pointer-events-none absolute z-0 select-none rounded-full ${PLACEMENT_CLASS[placement]} ${className}`}
      style={{
        background:
          "radial-gradient(circle, #E60F43 0%, rgba(230,15,67,0) 70%)",
      }}
      aria-hidden
    />
  );
}
