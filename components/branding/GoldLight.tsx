/**
 * Gold light — top-center border lamp / spotlight wash.
 *
 * Say “apply gold light” (and name a color) to drop this onto a card.
 * Default color is brand gold `#F6A724`. Parent must be `relative overflow-hidden`
 * with a `group` class if using hover. Content sits in `relative z-10`.
 */

export const GOLD_LIGHT = {
  /** Default lamp color */
  color: "#F6A724",
  /** Soft highlight near the hot spot (lighter mix of the lamp color) */
  hotHighlight: "#FFDC8C",
  /** Wash height as % of card */
  washHeight: "50%",
  /** Ellipse size (locked +20% radiation over base 90×120) */
  ellipseX: "108%",
  ellipseY: "144%",
  ellipseAt: "50% 0%",
  washCoreOpacity: 0.28,
  washMidOpacity: 0.1,
  /** Hot spot on the top border */
  hotW: "8.4rem",
  hotH: "4.8rem",
} as const;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n) || full.length !== 6) {
    return { r: 246, g: 167, b: 36 };
  }
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgba(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Lighter tint for the hot core (mix toward white). */
function hotHighlightFrom(color: string): string {
  if (color.toUpperCase() === GOLD_LIGHT.color) return GOLD_LIGHT.hotHighlight;
  const { r, g, b } = hexToRgb(color);
  const mix = (c: number) => Math.round(c + (255 - c) * 0.45);
  return `#${[mix(r), mix(g), mix(b)]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function GoldLight({
  color = GOLD_LIGHT.color,
  active = false,
  className = "",
}: {
  /** Lamp color — pass any hex when ordering the effect */
  color?: string;
  /** Force visible (e.g. selected). Otherwise shows on group-hover / group-active. */
  active?: boolean;
  className?: string;
}) {
  const {
    washHeight,
    ellipseX,
    ellipseY,
    ellipseAt,
    washCoreOpacity,
    washMidOpacity,
    hotW,
    hotH,
  } = GOLD_LIGHT;
  const hot = hotHighlightFrom(color);

  return (
    <span
      className={`pointer-events-none absolute inset-x-0 top-0 z-0 transition-opacity duration-300 ${
        active
          ? "opacity-100"
          : "opacity-0 group-hover:opacity-100 group-active:opacity-100"
      } ${className}`}
      style={{ height: washHeight }}
      aria-hidden
    >
      {/* Soft wash into the card */}
      <span
        className="absolute inset-x-0 top-0 h-full"
        style={{
          background: `radial-gradient(ellipse ${ellipseX} ${ellipseY} at ${ellipseAt}, ${rgba(color, washCoreOpacity)} 0%, ${rgba(color, washMidOpacity)} 32%, ${rgba(color, 0)} 70%)`,
        }}
      />
      {/* Hot spot on the top-center border */}
      <span
        className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full blur-md"
        style={{
          width: hotW,
          height: hotH,
          background: `radial-gradient(circle, ${rgba(hot, 0.85)} 0%, ${rgba(color, 0.45)} 28%, ${rgba(color, 0)} 72%)`,
        }}
      />
      {/* Thin lit rim along the top edge */}
      <span
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent 8%, ${rgba(color, 0.15)} 28%, ${rgba(hot, 0.95)} 50%, ${rgba(color, 0.15)} 72%, transparent 92%)`,
        }}
      />
    </span>
  );
}
