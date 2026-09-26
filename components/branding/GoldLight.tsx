/**
 * Gold light — border lamp / spotlight wash (color + placement on order).
 *
 * Say “apply gold light” (and name a color / placement) to drop this onto a card.
 * Default: gold `#F6A724`, top-center. Parent: `relative overflow-hidden group`.
 * Content sits in `relative z-10`.
 */

import type { CSSProperties } from "react";

export type GoldLightPlacement =
  | "top-center"
  | "left-center"
  | "right-center"
  | "bottom-center";

export const GOLD_LIGHT = {
  /** Default lamp color */
  color: "#F6A724",
  /** Soft highlight near the hot spot (lighter mix of the lamp color) */
  hotHighlight: "#FFDC8C",
  /** Ellipse size (locked +20% radiation over base 90×120) */
  ellipseX: "108%",
  ellipseY: "144%",
  washCoreOpacity: 0.28,
  washMidOpacity: 0.1,
  /** Hot spot size */
  hotW: "8.4rem",
  hotH: "4.8rem",
} as const;

type PlacementGeom = {
  wrapClass: string;
  washStyle: (color: string, hot: string) => CSSProperties;
  hotClass: string;
  rimClass: string;
  rimBackground: (color: string, hot: string) => string;
};

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

function washGradient(
  color: string,
  at: string,
  ellipseX = GOLD_LIGHT.ellipseX,
  ellipseY = GOLD_LIGHT.ellipseY
): string {
  const { washCoreOpacity, washMidOpacity } = GOLD_LIGHT;
  return `radial-gradient(ellipse ${ellipseX} ${ellipseY} at ${at}, ${rgba(color, washCoreOpacity)} 0%, ${rgba(color, washMidOpacity)} 32%, ${rgba(color, 0)} 70%)`;
}

const PLACEMENT: Record<GoldLightPlacement, PlacementGeom> = {
  "top-center": {
    wrapClass: "inset-x-0 top-0 h-[50%]",
    washStyle: (color) => ({
      background: washGradient(color, "50% 0%"),
    }),
    hotClass:
      "absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full blur-md",
    rimClass: "absolute inset-x-0 top-0 h-px",
    rimBackground: (color, hot) =>
      `linear-gradient(90deg, transparent 8%, ${rgba(color, 0.15)} 28%, ${rgba(hot, 0.95)} 50%, ${rgba(color, 0.15)} 72%, transparent 92%)`,
  },
  /** Left edge → wash right (Most Popular / Food) */
  "left-center": {
    wrapClass: "inset-y-0 left-0 w-[55%]",
    washStyle: (color) => ({
      background: washGradient(color, "0% 50%", "144%", "108%"),
    }),
    hotClass:
      "absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-md",
    rimClass: "absolute inset-y-0 left-0 w-px",
    rimBackground: (color, hot) =>
      `linear-gradient(180deg, transparent 8%, ${rgba(color, 0.15)} 28%, ${rgba(hot, 0.95)} 50%, ${rgba(color, 0.15)} 72%, transparent 92%)`,
  },
  /** Right edge → wash left (Nature) */
  "right-center": {
    wrapClass: "inset-y-0 right-0 w-[55%]",
    washStyle: (color) => ({
      background: washGradient(color, "100% 50%", "144%", "108%"),
    }),
    hotClass:
      "absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 rounded-full blur-md",
    rimClass: "absolute inset-y-0 right-0 w-px",
    rimBackground: (color, hot) =>
      `linear-gradient(180deg, transparent 8%, ${rgba(color, 0.15)} 28%, ${rgba(hot, 0.95)} 50%, ${rgba(color, 0.15)} 72%, transparent 92%)`,
  },
  /** Bottom-center upward (Best Value / Modern) */
  "bottom-center": {
    wrapClass: "inset-x-0 bottom-0 h-[50%]",
    washStyle: (color) => ({
      background: washGradient(color, "50% 100%"),
    }),
    hotClass:
      "absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 rounded-full blur-md",
    rimClass: "absolute inset-x-0 bottom-0 h-px",
    rimBackground: (color, hot) =>
      `linear-gradient(90deg, transparent 8%, ${rgba(color, 0.15)} 28%, ${rgba(hot, 0.95)} 50%, ${rgba(color, 0.15)} 72%, transparent 92%)`,
  },
};

export function GoldLight({
  color = GOLD_LIGHT.color,
  placement = "top-center",
  active = false,
  className = "",
}: {
  /** Lamp color — pass any hex when ordering the effect */
  color?: string;
  placement?: GoldLightPlacement;
  /** Force visible (e.g. selected). Otherwise shows on group-hover / group-active. */
  active?: boolean;
  className?: string;
}) {
  const { hotW, hotH } = GOLD_LIGHT;
  const hot = hotHighlightFrom(color);
  const geom = PLACEMENT[placement];

  return (
    <span
      className={`pointer-events-none absolute z-0 transition-opacity duration-300 ${
        geom.wrapClass
      } ${
        active
          ? "opacity-100"
          : "opacity-0 group-hover:opacity-100 group-active:opacity-100"
      } ${className}`}
      aria-hidden
    >
      <span
        className="absolute inset-0"
        style={geom.washStyle(color, hot)}
      />
      <span
        className={geom.hotClass}
        style={{
          width: hotW,
          height: hotH,
          background: `radial-gradient(circle, ${rgba(hot, 0.85)} 0%, ${rgba(color, 0.45)} 28%, ${rgba(color, 0)} 72%)`,
        }}
      />
      <span
        className={geom.rimClass}
        style={{ background: geom.rimBackground(color, hot) }}
      />
    </span>
  );
}
