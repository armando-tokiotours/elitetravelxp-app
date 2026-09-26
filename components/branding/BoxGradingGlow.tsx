/**
 * Box grading — dual radial glow for glass overview / summary cards.
 *
 * Blue `#054F70` (left, larger) + amber `#F6A724` (right, softer).
 * Say “apply box grading” to drop this onto a specific card.
 *
 * Parent must be `relative overflow-hidden`. Content should sit in
 * `relative z-10` above these layers.
 */

export const BOX_GRADING = {
  blue: "#054F70",
  amber: "#F6A724",
  /** Blue blob ≈ 250px (30% larger than base 192) */
  blueSizePx: 250,
  blueOpacity: 0.45,
  /** Amber blob ≈ 134px (30% smaller than base 192) */
  amberSizePx: 134,
  /** Amber opacity 0.45 × 0.8 */
  amberOpacity: 0.36,
} as const;

export function BoxGradingGlow({ className = "" }: { className?: string }) {
  const { blue, amber, blueSizePx, amberSizePx, blueOpacity, amberOpacity } =
    BOX_GRADING;

  return (
    <>
      <div
        className={`pointer-events-none absolute -top-[4.5rem] -left-[4.5rem] z-0 select-none rounded-full blur-2xl ${className}`}
        style={{
          width: blueSizePx,
          height: blueSizePx,
          opacity: blueOpacity,
          background: `radial-gradient(circle, ${blue} 0%, rgba(5,79,112,0) 70%)`,
        }}
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute -top-8 -right-8 z-0 select-none rounded-full blur-2xl ${className}`}
        style={{
          width: amberSizePx,
          height: amberSizePx,
          opacity: amberOpacity,
          background: `radial-gradient(circle, ${amber} 0%, rgba(246,167,36,0) 70%)`,
        }}
        aria-hidden
      />
    </>
  );
}
